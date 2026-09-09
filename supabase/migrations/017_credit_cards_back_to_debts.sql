-- Sección 6 del doc ("de la iteración 2 a la final"): las tarjetas de
-- crédito NUNCA viven en `accounts` — vuelven a `debts` (única fuente de
-- verdad), y un gasto puede pagarse con una cuenta O directamente con una
-- tarjeta (`transactions.debt_id`), nunca ambas.

-- 1) debts: agrega lo que antes vivía en accounts para tarjetas
alter table debts
  add column if not exists credit_limit numeric(14, 2),
  add column if not exists bank_name text,
  add column if not exists cutoff_day int,
  add column if not exists payment_due_day int;

alter table debts drop constraint if exists debts_credit_day_range;
alter table debts add constraint debts_credit_day_range
  check (cutoff_day is null or cutoff_day between 1 and 31);

alter table debts drop constraint if exists debts_payment_day_range;
alter table debts add constraint debts_payment_day_range
  check (payment_due_day is null or payment_due_day between 1 and 31);

alter table debts drop constraint if exists debts_credit_fields_only_for_credit_card;
alter table debts add constraint debts_credit_fields_only_for_credit_card
  check (
    type = 'credit_card'
    or (credit_limit is null and bank_name is null and cutoff_day is null and payment_due_day is null)
  );

-- (el check de "due_day solo si no es credit_card" se agrega más abajo,
-- después de migrar los datos: las 2 deudas tarjeta archivadas de la
-- migración 016 todavía tienen due_day set y se limpian en ese paso)

-- 2) accounts: columna para archivar (nunca borrar) en vez de tipo credit
alter table accounts add column if not exists archived_at timestamptz;

-- 3) transactions: debt_id para gastos pagados directamente con tarjeta
alter table transactions add column if not exists debt_id uuid references debts (id) on delete cascade;
alter table transactions alter column account_id drop not null;
create index if not exists transactions_debt_id_idx on transactions (debt_id);

alter table transactions drop constraint if exists transactions_account_or_debt;
alter table transactions add constraint transactions_account_or_debt
  check (
    (type = 'expense' and ((account_id is not null) <> (debt_id is not null)))
    or (type <> 'expense' and account_id is not null and debt_id is null)
  );

-- RLS: el hardening de dueñidad (013) asumía account_id siempre no-nulo;
-- ahora debe tolerar null y validar debt_id igual que las demás FK.
alter policy "transactions_insert_own" on transactions
  with check (
    user_id = auth.uid()
    and (account_id is null or exists (select 1 from accounts a where a.id = account_id and a.user_id = auth.uid()))
    and (debt_id is null or exists (select 1 from debts d where d.id = debt_id and d.user_id = auth.uid()))
    and (to_account_id is null or exists (
      select 1 from accounts a where a.id = to_account_id and a.user_id = auth.uid()
    ))
    and (category_id is null or exists (
      select 1 from categories c where c.id = category_id and c.user_id = auth.uid()
    ))
  );

alter policy "transactions_update_own" on transactions
  with check (
    user_id = auth.uid()
    and (account_id is null or exists (select 1 from accounts a where a.id = account_id and a.user_id = auth.uid()))
    and (debt_id is null or exists (select 1 from debts d where d.id = debt_id and d.user_id = auth.uid()))
    and (to_account_id is null or exists (
      select 1 from accounts a where a.id = to_account_id and a.user_id = auth.uid()
    ))
    and (category_id is null or exists (
      select 1 from categories c where c.id = category_id and c.user_id = auth.uid()
    ))
  );

-- 4) migración de datos genérica (no hardcodea nombres/IDs reales): para
-- cada cuenta tipo crédito todavía activa, reusa una deuda archivada del
-- mismo nombre si existe (evita duplicar historial), o crea una nueva;
-- reasigna sus gastos (si tuviera) a debt_id y archiva la cuenta.
do $$
declare
  a record;
  matching_debt_id uuid;
begin
  for a in select * from accounts where type = 'credit' and archived_at is null loop
    select id into matching_debt_id
      from debts
      where user_id = a.user_id and name = a.name
      limit 1;

    if matching_debt_id is not null then
      update debts set
        type = 'credit_card',
        principal = greatest(0, -a.current_balance),
        current_balance = greatest(0, -a.current_balance),
        credit_limit = a.credit_limit,
        bank_name = a.bank_name,
        interest_rate = coalesce(a.interest_rate, 0),
        minimum_payment = coalesce(a.minimum_payment, 0),
        cutoff_day = a.cutoff_day,
        payment_due_day = a.payment_due_day,
        due_day = null,
        archived_at = null
      where id = matching_debt_id;
    else
      insert into debts (
        user_id, name, type, principal, current_balance, credit_limit, bank_name,
        interest_rate, minimum_payment, cutoff_day, payment_due_day
      ) values (
        a.user_id, a.name, 'credit_card', greatest(0, -a.current_balance), greatest(0, -a.current_balance),
        a.credit_limit, a.bank_name, coalesce(a.interest_rate, 0), coalesce(a.minimum_payment, 0),
        a.cutoff_day, a.payment_due_day
      )
      returning id into matching_debt_id;
    end if;

    update transactions
      set debt_id = matching_debt_id, account_id = null
      where account_id = a.id and type = 'expense';

    update accounts set archived_at = now() where id = a.id;
  end loop;
end $$;

alter table debts drop constraint if exists debts_due_day_only_for_non_credit_card;
alter table debts add constraint debts_due_day_only_for_non_credit_card
  check (type <> 'credit_card' or due_day is null);

-- 5) limpieza de accounts: ya archivadas las de tipo credit, se puede quitar
-- lo que solo aplicaba a tarjetas y endurecer los constraints.
alter table accounts drop constraint if exists accounts_credit_day_range;
alter table accounts drop constraint if exists accounts_payment_day_range;
alter table accounts drop constraint if exists accounts_credit_fields_only_for_credit;
alter table accounts drop constraint if exists credit_limit_only_for_credit;
alter table accounts drop constraint if exists no_negative_balance_unless_credit;

alter table accounts drop column if exists interest_rate;
alter table accounts drop column if exists minimum_payment;
alter table accounts drop column if exists cutoff_day;
alter table accounts drop column if exists payment_due_day;
alter table accounts drop column if exists credit_limit;

-- accounts_type_check (allows 'credit') se deja intacto para no romper las
-- filas ya archivadas; en su lugar se prohíbe que una cuenta 'credit' esté
-- activa (archived_at is null).
alter table accounts add constraint accounts_no_active_credit
  check (type <> 'credit' or archived_at is not null);

-- Las cuentas archivadas conservan su saldo histórico (puede ser negativo
-- si eran de crédito); solo las activas deben respetar "no saldo negativo".
alter table accounts add constraint accounts_no_negative_balance
  check (archived_at is not null or current_balance >= 0);

-- 6) RPC: apply/reverse_transaction_effect ganan un parámetro p_debt_id, y
-- create_transaction/update_transaction uno más al final — como Postgres
-- identifica una función por su lista de tipos de parámetros, un cambio de
-- aridad NO reemplaza la versión anterior con `create or replace`, la deja
-- huérfana (y con código muerto que referencia columnas que este mismo
-- archivo borra más arriba). Se elimina explícitamente la firma vieja antes
-- de crear la nueva.
drop function if exists apply_transaction_effect(uuid, text, numeric, uuid);
drop function if exists reverse_transaction_effect(uuid, text, numeric, uuid);
drop function if exists create_transaction(uuid, text, numeric, date, uuid, uuid, uuid, text, text[], boolean, jsonb);
drop function if exists update_transaction(uuid, uuid, text, numeric, date, uuid, uuid, uuid, text, text[], boolean, jsonb);

create or replace function apply_transaction_effect(
  p_account_id uuid,
  p_debt_id uuid,
  p_type text,
  p_amount numeric,
  p_to_account_id uuid
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_account accounts;
  v_to_account accounts;
  v_debt debts;
  v_new_balance numeric;
begin
  if p_type = 'income' then
    select * into v_account from accounts where id = p_account_id and user_id = auth.uid() for update;
    if not found then
      raise exception 'Cuenta no encontrada';
    end if;
    update accounts set current_balance = current_balance + p_amount where id = v_account.id;

  elsif p_type = 'expense' then
    if p_debt_id is not null then
      select * into v_debt from debts where id = p_debt_id and user_id = auth.uid() for update;
      if not found then
        raise exception 'Tarjeta no encontrada';
      end if;
      v_new_balance := v_debt.current_balance + p_amount;
      if v_debt.credit_limit is not null and v_new_balance > v_debt.credit_limit then
        raise exception 'El gasto excede el límite de crédito de "%"', v_debt.name;
      end if;
      update debts set current_balance = v_new_balance where id = v_debt.id;
    else
      select * into v_account from accounts where id = p_account_id and user_id = auth.uid() for update;
      if not found then
        raise exception 'Cuenta no encontrada';
      end if;
      v_new_balance := v_account.current_balance - p_amount;
      if v_new_balance < 0 then
        raise exception 'Saldo insuficiente en la cuenta "%"', v_account.name;
      end if;
      update accounts set current_balance = v_new_balance where id = v_account.id;
    end if;

  elsif p_type = 'transfer' then
    if p_to_account_id is null then
      raise exception 'Se requiere cuenta destino para una transferencia';
    end if;
    select * into v_account from accounts where id = p_account_id and user_id = auth.uid() for update;
    if not found then
      raise exception 'Cuenta no encontrada';
    end if;
    select * into v_to_account from accounts where id = p_to_account_id and user_id = auth.uid() for update;
    if not found then
      raise exception 'Cuenta destino no encontrada';
    end if;

    v_new_balance := v_account.current_balance - p_amount;
    if v_new_balance < 0 then
      raise exception 'Saldo insuficiente en la cuenta de origen "%"', v_account.name;
    end if;

    update accounts set current_balance = v_new_balance where id = v_account.id;
    update accounts set current_balance = current_balance + p_amount where id = v_to_account.id;

  else
    raise exception 'Tipo de transacción inválido: %', p_type;
  end if;
end;
$$;

create or replace function reverse_transaction_effect(
  p_account_id uuid,
  p_debt_id uuid,
  p_type text,
  p_amount numeric,
  p_to_account_id uuid
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_type = 'income' then
    update accounts set current_balance = current_balance - p_amount
      where id = p_account_id and user_id = auth.uid();

  elsif p_type = 'expense' then
    if p_debt_id is not null then
      update debts set current_balance = current_balance - p_amount
        where id = p_debt_id and user_id = auth.uid();
    else
      update accounts set current_balance = current_balance + p_amount
        where id = p_account_id and user_id = auth.uid();
    end if;

  elsif p_type = 'transfer' then
    update accounts set current_balance = current_balance + p_amount
      where id = p_account_id and user_id = auth.uid();
    update accounts set current_balance = current_balance - p_amount
      where id = p_to_account_id and user_id = auth.uid();
  end if;
end;
$$;

create or replace function create_transaction(
  p_account_id uuid,
  p_type text,
  p_amount numeric,
  p_date date,
  p_category_id uuid default null,
  p_merchant_id uuid default null,
  p_to_account_id uuid default null,
  p_note text default null,
  p_tags text[] default '{}',
  p_is_recurring boolean default false,
  p_recurring_rule jsonb default null,
  p_debt_id uuid default null
) returns transactions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_transaction transactions;
begin
  if p_amount <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;

  if p_type = 'expense' then
    if (p_account_id is not null) = (p_debt_id is not null) then
      raise exception 'Elige una cuenta o una tarjeta para el gasto, no ambas ni ninguna';
    end if;
  elsif p_debt_id is not null then
    raise exception 'Solo un gasto puede pagarse con tarjeta';
  end if;

  perform apply_transaction_effect(p_account_id, p_debt_id, p_type, p_amount, p_to_account_id);

  insert into transactions (
    user_id, account_id, debt_id, to_account_id, category_id, merchant_id,
    type, amount, date, note, tags, is_recurring, recurring_rule
  ) values (
    auth.uid(), p_account_id, p_debt_id, p_to_account_id, p_category_id, p_merchant_id,
    p_type, p_amount, p_date, p_note, coalesce(p_tags, '{}'), p_is_recurring, p_recurring_rule
  )
  returning * into v_transaction;

  return v_transaction;
end;
$$;

create or replace function update_transaction(
  p_id uuid,
  p_account_id uuid,
  p_type text,
  p_amount numeric,
  p_date date,
  p_category_id uuid default null,
  p_merchant_id uuid default null,
  p_to_account_id uuid default null,
  p_note text default null,
  p_tags text[] default '{}',
  p_is_recurring boolean default false,
  p_recurring_rule jsonb default null,
  p_debt_id uuid default null
) returns transactions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_old transactions;
  v_transaction transactions;
begin
  if p_amount <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;

  if p_type = 'expense' then
    if (p_account_id is not null) = (p_debt_id is not null) then
      raise exception 'Elige una cuenta o una tarjeta para el gasto, no ambas ni ninguna';
    end if;
  elsif p_debt_id is not null then
    raise exception 'Solo un gasto puede pagarse con tarjeta';
  end if;

  select * into v_old from transactions where id = p_id and user_id = auth.uid();
  if not found then
    raise exception 'Transacción no encontrada';
  end if;

  perform reverse_transaction_effect(v_old.account_id, v_old.debt_id, v_old.type, v_old.amount, v_old.to_account_id);
  perform apply_transaction_effect(p_account_id, p_debt_id, p_type, p_amount, p_to_account_id);

  update transactions set
    account_id = p_account_id,
    debt_id = p_debt_id,
    to_account_id = p_to_account_id,
    category_id = p_category_id,
    merchant_id = p_merchant_id,
    type = p_type,
    amount = p_amount,
    date = p_date,
    note = p_note,
    tags = coalesce(p_tags, '{}'),
    is_recurring = p_is_recurring,
    recurring_rule = p_recurring_rule
  where id = p_id and user_id = auth.uid()
  returning * into v_transaction;

  return v_transaction;
end;
$$;

create or replace function delete_transaction(p_id uuid) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_old transactions;
begin
  select * into v_old from transactions where id = p_id and user_id = auth.uid();
  if not found then
    raise exception 'Transacción no encontrada';
  end if;

  perform reverse_transaction_effect(v_old.account_id, v_old.debt_id, v_old.type, v_old.amount, v_old.to_account_id);

  delete from transactions where id = p_id and user_id = auth.uid();
end;
$$;

-- create_debt_payment (009_debt_payment_rpc.sql) llama a apply/reverse_transaction_effect
-- con la firma vieja de 4 argumentos posicionales — su propia firma no cambia,
-- así que un `create or replace` normal la reemplaza en el mismo lugar.
create or replace function apply_debt_payment_effect(
  p_debt_id uuid,
  p_account_id uuid,
  p_amount numeric
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_debt debts;
begin
  select * into v_debt from debts where id = p_debt_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Deuda no encontrada';
  end if;

  if p_amount > v_debt.current_balance then
    raise exception 'El pago excede el saldo de la deuda "%"', v_debt.name;
  end if;

  perform apply_transaction_effect(p_account_id, null, 'expense', p_amount, null);

  update debts set current_balance = current_balance - p_amount
    where id = p_debt_id and user_id = auth.uid();
end;
$$;

create or replace function reverse_debt_payment_effect(
  p_debt_id uuid,
  p_account_id uuid,
  p_amount numeric
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform reverse_transaction_effect(p_account_id, null, 'expense', p_amount, null);

  update debts set current_balance = current_balance + p_amount
    where id = p_debt_id and user_id = auth.uid();
end;
$$;

-- create_goal_contribution (012_goal_contribution_rpc.sql) tiene la misma
-- dependencia de la firma vieja de 4 argumentos; mismo fix.
create or replace function apply_goal_contribution_effect(
  p_goal_id uuid,
  p_account_id uuid,
  p_amount numeric
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_goal goals;
begin
  select * into v_goal from goals where id = p_goal_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Meta no encontrada';
  end if;

  perform apply_transaction_effect(p_account_id, null, 'expense', p_amount, null);

  update goals set current_amount = current_amount + p_amount
    where id = p_goal_id and user_id = auth.uid();
end;
$$;

create or replace function reverse_goal_contribution_effect(
  p_goal_id uuid,
  p_account_id uuid,
  p_amount numeric
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform reverse_transaction_effect(p_account_id, null, 'expense', p_amount, null);

  update goals set current_amount = greatest(current_amount - p_amount, 0)
    where id = p_goal_id and user_id = auth.uid();
end;
$$;
