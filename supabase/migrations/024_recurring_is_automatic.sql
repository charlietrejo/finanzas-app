-- Secciones 3.2/3.4.1/Fase 8 del doc: hasta ahora toda transacción
-- recurrente se trataba como domiciliada/automática (el cron de la Fase 8
-- la generaba solo). Esta migración distingue domiciliado/automático de
-- manual: una plantilla manual NUNCA se genera sola — solo aparece como
-- recordatorio en el Dashboard (sección 3.4.1) con un botón "Registrar
-- ahora" (confirm_recurring_occurrence, más abajo) que la confirma a mano.
--
-- Default true: toda recurrencia creada antes de esta migración seguía
-- generándose sola vía el cron, así que "automático" es el comportamiento
-- que ya tenían — el default preserva ese comportamiento sin backfill.
alter table transactions add column if not exists recurring_is_automatic boolean not null default true;

comment on column transactions.recurring_is_automatic is
  'Solo aplica si is_recurring=true (sección 3.2 del doc). true = domiciliado/automático, el cron de generate-recurring la genera sola. false = manual, el cron la ignora — solo aparece como recordatorio "Registrar ahora" en el Dashboard (sección 3.4.1), y su next_occurrence_date solo avanza cuando el usuario confirma vía confirm_recurring_occurrence.';

-- create_transaction/update_transaction ganan un parámetro más
-- (p_recurring_is_automatic) — mismo problema de aridad que en
-- 017/018/019: Postgres identifica una función por su lista de tipos, así
-- que hay que eliminar la firma vieja explícitamente antes de crear la nueva.
drop function if exists create_transaction(uuid, text, numeric, date, uuid, uuid, uuid, text, text[], boolean, uuid, text, int, date, date);
drop function if exists update_transaction(uuid, uuid, text, numeric, date, uuid, uuid, uuid, text, text[], boolean, uuid, text, int, date, date);

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
  p_recurring_end_date date default null,
  p_next_occurrence_date date default null,
  p_recurring_is_automatic boolean default true
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
    recurring_frequency, recurring_interval_days, recurring_end_date, next_occurrence_date,
    recurring_is_automatic
  ) values (
    auth.uid(), p_account_id, p_debt_id, p_to_account_id, p_category_id, p_merchant_id,
    p_type, p_amount, p_date, p_note, coalesce(p_tags, '{}'), p_is_recurring,
    p_recurring_frequency, p_recurring_interval_days, p_recurring_end_date, p_next_occurrence_date,
    coalesce(p_recurring_is_automatic, true)
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
  p_recurring_end_date date default null,
  p_next_occurrence_date date default null,
  p_recurring_is_automatic boolean default true
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
    recurring_end_date = p_recurring_end_date,
    next_occurrence_date = p_next_occurrence_date,
    recurring_is_automatic = coalesce(p_recurring_is_automatic, true)
  where id = p_id and user_id = auth.uid()
  returning * into v_transaction;

  return v_transaction;
end;
$$;

-- Defensa adicional dentro de la propia RPC (además del filtro que ya hace
-- la ruta del cron, generate-recurring/route.ts): si algo alguna vez llama
-- esta función para una plantilla manual, no debe generar nada — mismo
-- criterio que ya usa para next_occurrence_date/recurring_end_date vencidos.
--
-- DROP + CREATE (no CREATE OR REPLACE): el ALTER TABLE de arriba cambió el
-- tipo fila de `transactions` (agregó recurring_is_automatic), y esta
-- función declara `returns transactions` — Postgres rechaza un REPLACE que
-- cambiaría el tipo de retorno de una función ya existente ("cannot change
-- return type of existing function"), mismo problema ya resuelto abajo para
-- create_transaction/update_transaction, aquí con la misma firma de siempre
-- (no hay cambio de aridad, así que no hacía falta un DROP hasta ahora).
drop function if exists generate_recurring_occurrence(uuid, date);

create function generate_recurring_occurrence(
  p_template_id uuid,
  p_next_occurrence_date date
) returns transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template transactions;
  v_account accounts;
  v_debt debts;
  v_new_balance numeric;
  v_exists boolean;
  v_new transactions;
begin
  if auth.role() <> 'service_role' then
    raise exception 'No autorizado';
  end if;

  select * into v_template from transactions where id = p_template_id for update;
  if not found then
    return null;
  end if;

  if not v_template.is_recurring
     or not v_template.recurring_is_automatic
     or v_template.next_occurrence_date is null
     or v_template.next_occurrence_date > current_date
     or (v_template.recurring_end_date is not null and v_template.recurring_end_date < current_date)
  then
    return null;
  end if;

  select exists (
    select 1 from transactions t
    where t.user_id = v_template.user_id
      and t.is_recurring = false
      and t.date = v_template.next_occurrence_date
      and t.type = v_template.type
      and t.amount = v_template.amount
      and t.account_id is not distinct from v_template.account_id
      and t.debt_id is not distinct from v_template.debt_id
      and t.to_account_id is not distinct from v_template.to_account_id
      and t.category_id is not distinct from v_template.category_id
      and t.merchant_id is not distinct from v_template.merchant_id
      and coalesce(t.note, '') = coalesce(v_template.note, '')
  ) into v_exists;

  if not v_exists then
    if v_template.type = 'expense' and v_template.debt_id is not null then
      select * into v_debt from debts where id = v_template.debt_id for update;
      v_new_balance := v_debt.current_balance + v_template.amount;
      if v_debt.credit_limit is not null and v_new_balance > v_debt.credit_limit then
        raise exception 'El gasto excede el límite de crédito de "%"', v_debt.name;
      end if;
      update debts set current_balance = v_new_balance where id = v_debt.id;
    elsif v_template.type = 'expense' then
      select * into v_account from accounts where id = v_template.account_id for update;
      v_new_balance := v_account.current_balance - v_template.amount;
      if v_new_balance < 0 then
        raise exception 'Saldo insuficiente en la cuenta "%"', v_account.name;
      end if;
      update accounts set current_balance = v_new_balance where id = v_account.id;
    elsif v_template.type = 'income' then
      update accounts set current_balance = current_balance + v_template.amount where id = v_template.account_id;
    end if;
    -- 'transfer' no aplica: transactions_transfer_not_recurring garantiza
    -- que una plantilla (is_recurring=true) nunca es de ese tipo.

    insert into transactions (
      user_id, account_id, debt_id, to_account_id, category_id, merchant_id,
      type, amount, date, note, tags, is_recurring
    ) values (
      v_template.user_id, v_template.account_id, v_template.debt_id, v_template.to_account_id,
      v_template.category_id, v_template.merchant_id, v_template.type, v_template.amount,
      v_template.next_occurrence_date, v_template.note, v_template.tags, false
    )
    returning * into v_new;
  end if;

  update transactions set next_occurrence_date = p_next_occurrence_date where id = v_template.id;

  return v_new;
end;
$$;

-- RPC: confirma a mano la ocurrencia de una plantilla recurrente MANUAL
-- (sección 3.2/3.4.1 del doc, botón "Registrar ahora"). Atómica: aplica el
-- efecto de saldo normal (misma apply_transaction_effect que create_transaction),
-- inserta la transacción real (is_recurring=false, es solo una ocurrencia), y
-- avanza next_occurrence_date de la plantilla al valor ya calculado por el
-- llamador (mismo patrón que generate_recurring_occurrence: la aritmética de
-- fechas vive en TypeScript, src/lib/recurring.ts, no aquí). A diferencia del
-- cron, esta sí corre como el usuario autenticado (security invoker) porque
-- el usuario mismo la dispara desde el formulario.
create or replace function confirm_recurring_occurrence(
  p_template_id uuid,
  p_next_occurrence_date date,
  p_account_id uuid,
  p_debt_id uuid,
  p_type text,
  p_amount numeric,
  p_date date,
  p_category_id uuid default null,
  p_merchant_id uuid default null,
  p_note text default null,
  p_tags text[] default '{}'
) returns transactions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_template transactions;
  v_new transactions;
begin
  select * into v_template from transactions
    where id = p_template_id and user_id = auth.uid()
    for update;
  if not found or not v_template.is_recurring or v_template.recurring_is_automatic then
    raise exception 'Plantilla recurrente manual no encontrada';
  end if;

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

  perform apply_transaction_effect(p_account_id, p_debt_id, p_type, p_amount, null);

  insert into transactions (
    user_id, account_id, debt_id, category_id, merchant_id,
    type, amount, date, note, tags, is_recurring
  ) values (
    auth.uid(), p_account_id, p_debt_id, p_category_id, p_merchant_id,
    p_type, p_amount, p_date, p_note, coalesce(p_tags, '{}'), false
  )
  returning * into v_new;

  update transactions set next_occurrence_date = p_next_occurrence_date where id = v_template.id;

  return v_new;
end;
$$;
