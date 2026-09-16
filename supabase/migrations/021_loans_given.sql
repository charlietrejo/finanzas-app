-- Sección 3.4.2 del doc ("Préstamos otorgados"): dinero que el usuario le
-- presta a alguien más — lo opuesto a `debts`. "Préstamo" es una categoría
-- especial de gasto (sección 3.8) que, al elegirse en el formulario de
-- movimientos, dispara los campos extra (a quién, fecha esperada) y crea el
-- registro de seguimiento de forma atómica junto con la transacción.

-- 1) "Préstamo" se agrega a la siembra de categorías por defecto (015). Es
-- create or replace (no una migración nueva de la función): el backfill de
-- abajo vuelve a llamar seed_default_categories para cada usuario ya
-- existente, y como es idempotente (NOT EXISTS por nombre+tipo), solo
-- inserta la categoría nueva, no duplica las demás.
create or replace function seed_default_categories(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into categories (user_id, name, type)
  select p_user_id, d.name, d.type
  from (values
    ('Nómina/Salario', 'income'),
    ('Freelance/Negocio propio', 'income'),
    ('Reembolsos', 'income'),
    ('Otros ingresos', 'income'),
    ('Comida y supermercado', 'expense'),
    ('Restaurantes y antojos', 'expense'),
    ('Transporte', 'expense'),
    ('Vivienda (renta/hipoteca)', 'expense'),
    ('Servicios (luz, agua, gas, internet)', 'expense'),
    ('Salud', 'expense'),
    ('Entretenimiento', 'expense'),
    ('Ropa y accesorios', 'expense'),
    ('Educación', 'expense'),
    ('Suscripciones', 'expense'),
    ('Pago de tarjetas/deudas', 'expense'),
    ('Ahorro e inversión', 'expense'),
    ('Mascotas', 'expense'),
    ('Regalos y donaciones', 'expense'),
    ('Préstamo', 'expense'),
    ('Otros gastos', 'expense')
  ) as d(name, type)
  where not exists (
    select 1 from categories c
    where c.user_id = p_user_id and c.name = d.name and c.type = d.type
  );
end;
$$;

do $$
declare
  r record;
begin
  for r in select id from auth.users loop
    perform seed_default_categories(r.id);
  end loop;
end $$;

-- 2) Tablas (sección 4 del doc / modelo de datos).
create table if not exists loans_given (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_id uuid not null references transactions (id) on delete cascade,
  borrower_name text not null,
  expected_return_date date,
  current_balance numeric(14, 2) not null check (current_balance >= 0),
  status text not null default 'active' check (status in ('active', 'paid')),
  created_at timestamptz not null default now()
);

create index if not exists loans_given_user_id_idx on loans_given (user_id);
create index if not exists loans_given_transaction_id_idx on loans_given (transaction_id);

create table if not exists loan_repayments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  loan_given_id uuid not null references loans_given (id) on delete cascade,
  transaction_id uuid not null references transactions (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  date date not null,
  created_at timestamptz not null default now()
);

create index if not exists loan_repayments_user_id_idx on loan_repayments (user_id);
create index if not exists loan_repayments_loan_given_id_idx on loan_repayments (loan_given_id);

alter table loans_given enable row level security;
alter table loan_repayments enable row level security;

-- Mismo patrón de "ownership hardening" que 013: RLS no reemplaza la
-- atomicidad de las RPC de abajo (create_loan_given/create_loan_repayment
-- siguen siendo la única vía que también aplica el efecto de saldo), pero sí
-- cierra el camino directo por la API REST para asociar filas propias a un
-- transaction_id/loan_given_id ajeno.
create policy "loans_given_select_own" on loans_given for select
  using (user_id = auth.uid());
create policy "loans_given_insert_own" on loans_given for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from transactions t where t.id = transaction_id and t.user_id = auth.uid())
  );
create policy "loans_given_update_own" on loans_given for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "loans_given_delete_own" on loans_given for delete
  using (user_id = auth.uid());

create policy "loan_repayments_select_own" on loan_repayments for select
  using (user_id = auth.uid());
create policy "loan_repayments_insert_own" on loan_repayments for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from loans_given l where l.id = loan_given_id and l.user_id = auth.uid())
    and exists (select 1 from transactions t where t.id = transaction_id and t.user_id = auth.uid())
  );
create policy "loan_repayments_delete_own" on loan_repayments for delete
  using (user_id = auth.uid());

-- 3) RPC: crear un préstamo otorgado. Atómico: aplica el efecto de gasto
-- normal (reusa apply_transaction_effect, la misma función que create_transaction
-- — cuenta o tarjeta, valida saldo/límite de crédito), inserta la transacción,
-- e inserta loans_given con el monto total como saldo pendiente inicial.
create or replace function create_loan_given(
  p_account_id uuid,
  p_debt_id uuid,
  p_amount numeric,
  p_date date,
  p_category_id uuid,
  p_borrower_name text,
  p_expected_return_date date default null,
  p_note text default null
) returns loans_given
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_transaction transactions;
  v_loan loans_given;
begin
  if p_amount <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;
  if (p_account_id is not null) = (p_debt_id is not null) then
    raise exception 'Elige una cuenta o una tarjeta para el préstamo, no ambas ni ninguna';
  end if;
  if trim(coalesce(p_borrower_name, '')) = '' then
    raise exception 'Indica a quién se le prestó';
  end if;

  perform apply_transaction_effect(p_account_id, p_debt_id, 'expense', p_amount, null);

  insert into transactions (
    user_id, account_id, debt_id, category_id, type, amount, date, note, tags, is_recurring
  ) values (
    auth.uid(), p_account_id, p_debt_id, p_category_id, 'expense', p_amount, p_date, p_note, '{}', false
  )
  returning * into v_transaction;

  insert into loans_given (user_id, transaction_id, borrower_name, expected_return_date, current_balance, status)
  values (auth.uid(), v_transaction.id, trim(p_borrower_name), p_expected_return_date, p_amount, 'active')
  returning * into v_loan;

  return v_loan;
end;
$$;

-- 4) RPC: registrar un cobro (total o parcial). Atómico: aplica el efecto de
-- ingreso normal, inserta la transacción, reduce loans_given.current_balance,
-- y marca status='paid' si llega a 0.
create or replace function create_loan_repayment(
  p_loan_given_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_date date,
  p_note text default null
) returns loan_repayments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_loan loans_given;
  v_transaction transactions;
  v_repayment loan_repayments;
  v_new_balance numeric;
begin
  if p_amount <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;

  select * into v_loan from loans_given where id = p_loan_given_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Préstamo no encontrado';
  end if;
  if v_loan.status = 'paid' then
    raise exception 'Este préstamo ya está pagado';
  end if;
  if p_amount > v_loan.current_balance then
    raise exception 'El cobro excede el saldo pendiente del préstamo';
  end if;

  perform apply_transaction_effect(p_account_id, null, 'income', p_amount, null);

  insert into transactions (user_id, account_id, type, amount, date, note, tags, is_recurring)
  values (auth.uid(), p_account_id, 'income', p_amount, p_date, p_note, '{}', false)
  returning * into v_transaction;

  v_new_balance := v_loan.current_balance - p_amount;

  update loans_given
  set current_balance = v_new_balance,
      status = case when v_new_balance <= 0 then 'paid' else 'active' end
  where id = v_loan.id;

  insert into loan_repayments (user_id, loan_given_id, transaction_id, amount, date)
  values (auth.uid(), v_loan.id, v_transaction.id, p_amount, p_date)
  returning * into v_repayment;

  return v_repayment;
end;
$$;
