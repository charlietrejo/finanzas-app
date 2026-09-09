-- Sección 3.2 actualizada del doc ("Formulario dinámico según tipo de
-- movimiento") + sección 4: reemplaza el `recurring_rule` jsonb genérico por
-- columnas explícitas (recurring_frequency/recurring_interval_days/
-- recurring_end_date), y endurece a nivel de BD qué campos aplican a cada
-- tipo de movimiento (categoría no aplica a transfer; comercio/etiquetas
-- solo aplican a expense; recurrente no aplica a transfer).

alter table transactions
  add column if not exists recurring_frequency text,
  add column if not exists recurring_interval_days int,
  add column if not exists recurring_end_date date;

-- Migra cualquier recurring_rule existente (jsonb: {frequency, interval,
-- next_date}) a las columnas nuevas. El formulario anterior solo ofrecía
-- daily/weekly/monthly con interval siempre en 1, así que el mapeo es
-- directo; "next_date" se descarta (el ancla de la recurrencia pasa a ser
-- la propia columna `date` de la transacción).
update transactions set
  recurring_frequency = case
    when recurring_rule->>'frequency' = 'monthly' and coalesce((recurring_rule->>'interval')::int, 1) = 1 then 'monthly'
    when recurring_rule->>'frequency' = 'weekly' and coalesce((recurring_rule->>'interval')::int, 1) = 1 then 'weekly'
    when recurring_rule is not null then 'custom'
    else null
  end,
  recurring_interval_days = case
    when recurring_rule->>'frequency' = 'monthly' and coalesce((recurring_rule->>'interval')::int, 1) = 1 then null
    when recurring_rule->>'frequency' = 'weekly' and coalesce((recurring_rule->>'interval')::int, 1) = 1 then null
    when recurring_rule->>'frequency' = 'daily' then coalesce((recurring_rule->>'interval')::int, 1)
    when recurring_rule->>'frequency' = 'weekly' then coalesce((recurring_rule->>'interval')::int, 1) * 7
    when recurring_rule->>'frequency' = 'monthly' then coalesce((recurring_rule->>'interval')::int, 1) * 30
    else null
  end
where recurring_rule is not null;

alter table transactions drop column if exists recurring_rule;

alter table transactions drop constraint if exists transactions_recurring_frequency_check;
alter table transactions add constraint transactions_recurring_frequency_check
  check (recurring_frequency is null or recurring_frequency in ('weekly', 'monthly', 'annual', 'custom'));

alter table transactions drop constraint if exists transactions_recurring_requires_frequency;
alter table transactions add constraint transactions_recurring_requires_frequency
  check (is_recurring or (recurring_frequency is null and recurring_interval_days is null and recurring_end_date is null));

alter table transactions drop constraint if exists transactions_recurring_frequency_needs_flag;
alter table transactions add constraint transactions_recurring_frequency_needs_flag
  check (not is_recurring or recurring_frequency is not null);

alter table transactions drop constraint if exists transactions_recurring_interval_only_for_custom;
alter table transactions add constraint transactions_recurring_interval_only_for_custom
  check (recurring_frequency = 'custom' or recurring_interval_days is null);

alter table transactions drop constraint if exists transactions_recurring_interval_positive;
alter table transactions add constraint transactions_recurring_interval_positive
  check (recurring_interval_days is null or recurring_interval_days > 0);

alter table transactions drop constraint if exists transactions_transfer_not_recurring;
alter table transactions add constraint transactions_transfer_not_recurring
  check (type <> 'transfer' or not is_recurring);

-- Sección 3.2: categoría no aplica a transfer; comercio/etiquetas solo a expense.
alter table transactions drop constraint if exists transactions_category_not_for_transfer;
alter table transactions add constraint transactions_category_not_for_transfer
  check (type <> 'transfer' or category_id is null);

alter table transactions drop constraint if exists transactions_merchant_only_for_expense;
alter table transactions add constraint transactions_merchant_only_for_expense
  check (type = 'expense' or merchant_id is null);

alter table transactions drop constraint if exists transactions_tags_only_for_expense;
alter table transactions add constraint transactions_tags_only_for_expense
  check (type = 'expense' or tags = '{}'::text[]);

-- create_transaction/update_transaction cambian de firma (quitan
-- p_recurring_rule jsonb, agregan los 3 parámetros nuevos) — mismo problema
-- de aridad que en 017: hay que eliminar la firma vieja explícitamente.
drop function if exists create_transaction(uuid, text, numeric, date, uuid, uuid, uuid, text, text[], boolean, jsonb, uuid);
drop function if exists update_transaction(uuid, uuid, text, numeric, date, uuid, uuid, uuid, text, text[], boolean, jsonb, uuid);

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
  p_debt_id uuid default null,
  p_recurring_frequency text default null,
  p_recurring_interval_days int default null,
  p_recurring_end_date date default null
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
    type, amount, date, note, tags, is_recurring,
    recurring_frequency, recurring_interval_days, recurring_end_date
  ) values (
    auth.uid(), p_account_id, p_debt_id, p_to_account_id, p_category_id, p_merchant_id,
    p_type, p_amount, p_date, p_note, coalesce(p_tags, '{}'), p_is_recurring,
    p_recurring_frequency, p_recurring_interval_days, p_recurring_end_date
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
  p_debt_id uuid default null,
  p_recurring_frequency text default null,
  p_recurring_interval_days int default null,
  p_recurring_end_date date default null
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
    recurring_frequency = p_recurring_frequency,
    recurring_interval_days = p_recurring_interval_days,
    recurring_end_date = p_recurring_end_date
  where id = p_id and user_id = auth.uid()
  returning * into v_transaction;

  return v_transaction;
end;
$$;
