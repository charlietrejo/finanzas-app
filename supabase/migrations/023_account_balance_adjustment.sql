-- Sección 3.1 del doc ("Ajustar saldo — reconciliación manual"): el saldo
-- actual se mantiene incremental (apply_transaction_effect en cada
-- movimiento, no una suma recalculada al leer), así que puede desalinearse
-- de la realidad si algo no se capturó (comisión bancaria, cargo perdido,
-- etc.). Esta migración agrega is_adjustment a transactions (para poder
-- excluir estos movimientos de gasto hormiga/gastos esenciales/presupuestos
-- sin dejar de afectar el saldo calculado de la cuenta, que es el propósito
-- de la función) y la RPC que crea el movimiento de ajuste de forma atómica.

alter table transactions add column if not exists is_adjustment boolean not null default false;

comment on column transactions.is_adjustment is
  'true solo en movimientos creados por adjust_account_balance (sección 3.1 del doc) — se excluyen de gasto hormiga, gastos esenciales/no esenciales (Reportes) y del comparativo de Presupuestos, pero sí afectan el saldo calculado de la cuenta.';

-- "Ajuste de saldo" se agrega a la siembra de categorías por defecto, en
-- AMBOS tipos (el ajuste es ingreso o gasto según el signo de la diferencia,
-- a diferencia de "Préstamo" en 021_loans_given.sql que solo es gasto) —
-- mismo patrón de create-or-replace idempotente por (user_id, name, type).
create or replace function seed_default_categories(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into categories (user_id, name, type, is_essential)
  select p_user_id, d.name, d.type, d.is_essential
  from (values
    ('Nómina/Salario', 'income', false),
    ('Freelance/Negocio propio', 'income', false),
    ('Reembolsos', 'income', false),
    ('Otros ingresos', 'income', false),
    ('Ajuste de saldo', 'income', false),
    ('Vivienda (renta/hipoteca)', 'expense', true),
    ('Servicios (luz, agua, gas, internet)', 'expense', true),
    ('Salud', 'expense', true),
    ('Transporte', 'expense', true),
    ('Pago de tarjetas/deudas', 'expense', true),
    ('Comida y supermercado', 'expense', false),
    ('Restaurantes y antojos', 'expense', false),
    ('Entretenimiento', 'expense', false),
    ('Ropa y accesorios', 'expense', false),
    ('Educación', 'expense', false),
    ('Suscripciones', 'expense', false),
    ('Ahorro e inversión', 'expense', false),
    ('Mascotas', 'expense', false),
    ('Regalos y donaciones', 'expense', false),
    ('Préstamo', 'expense', false),
    ('Ajuste de saldo', 'expense', false),
    ('Otros gastos', 'expense', false)
  ) as d(name, type, is_essential)
  where not exists (
    select 1 from categories c
    where c.user_id = p_user_id and c.name = d.name and c.type = d.type
  );
end;
$$;

-- Backfill: usuarios ya existentes reciben las 2 categorías nuevas (mismo
-- mecanismo idempotente que 015/021/022 — no duplica lo que ya tienen).
do $$
declare
  r record;
begin
  for r in select id from auth.users loop
    perform seed_default_categories(r.id);
  end loop;
end $$;

-- RPC: ajusta el saldo de una cuenta a un valor real capturado por el
-- usuario, creando de forma atómica el movimiento de ajuste que reconcilia
-- la diferencia (ingreso si el saldo real es mayor al calculado, gasto si es
-- menor). Reusa apply_transaction_effect (mismo camino que create_transaction
-- / create_loan_given) para que el efecto de saldo sea idéntico al de un
-- movimiento normal — incluida la garantía de "no saldo negativo", que aquí
-- nunca se dispara porque el saldo resultante es exactamente p_real_balance,
-- ya validado >= 0 arriba.
create or replace function adjust_account_balance(
  p_account_id uuid,
  p_real_balance numeric
) returns transactions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_account accounts;
  v_diff numeric;
  v_type text;
  v_amount numeric;
  v_category_id uuid;
  v_transaction transactions;
begin
  if p_real_balance < 0 then
    raise exception 'El saldo no puede ser negativo';
  end if;

  select * into v_account from accounts where id = p_account_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Cuenta no encontrada';
  end if;

  v_diff := p_real_balance - v_account.current_balance;
  if v_diff = 0 then
    raise exception 'El saldo capturado ya coincide con el saldo calculado; no hay nada que ajustar';
  end if;

  v_type := case when v_diff > 0 then 'income' else 'expense' end;
  v_amount := abs(v_diff);

  select id into v_category_id from categories
    where user_id = auth.uid() and name = 'Ajuste de saldo' and type = v_type
    limit 1;

  perform apply_transaction_effect(p_account_id, null, v_type, v_amount, null);

  insert into transactions (
    user_id, account_id, category_id, type, amount, date, note, tags, is_recurring, is_adjustment
  ) values (
    auth.uid(), p_account_id, v_category_id, v_type, v_amount, current_date,
    'Ajuste de saldo: saldo real capturado ' || to_char(p_real_balance, 'FM999999999.00'),
    '{}', false, true
  )
  returning * into v_transaction;

  return v_transaction;
end;
$$;
