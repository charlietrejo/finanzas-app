-- Fase 8 del doc ("Motor de recurrencias automáticas"): hasta ahora
-- recurring_frequency/recurring_end_date eran puro metadato — nada generaba
-- la transacción del siguiente periodo. Un Vercel Cron Job diario llama a
-- una ruta protegida que usa esta infraestructura para generar las
-- ocurrencias vencidas de forma atómica e idempotente.
--
-- La aritmética de fechas (avanzar un periodo según recurring_frequency)
-- vive en TypeScript (src/lib/recurring.ts), no aquí — este archivo solo
-- hace lo que debe ser atómico: verificar elegibilidad, chequear
-- idempotencia, aplicar el efecto de saldo, insertar la ocurrencia y
-- avanzar next_occurrence_date al valor ya calculado por el llamador.

alter table transactions add column if not exists next_occurrence_date date;

alter table transactions drop constraint if exists transactions_next_occurrence_only_if_recurring;
alter table transactions add constraint transactions_next_occurrence_only_if_recurring
  check (is_recurring or next_occurrence_date is null);

-- Backfill genérico (no hardcodea IDs): las transacciones recurrentes
-- creadas antes de esta migración no tienen next_occurrence_date — se
-- calcula avanzando UN periodo desde su propia `date`, igual que
-- src/lib/recurring.ts::advanceRecurringDate (mismo clamp de día para
-- monthly/annual).
do $$
declare
  r record;
  v_year int;
  v_month int; -- 0-indexed
  v_day int;
  v_month_step int;
  v_total_months int;
  v_last_day date;
  v_result date;
begin
  for r in select * from transactions where is_recurring and next_occurrence_date is null loop
    if r.recurring_frequency in ('monthly', 'annual') then
      v_month_step := case when r.recurring_frequency = 'annual' then 12 else 1 end;
      v_total_months := extract(year from r.date)::int * 12 + (extract(month from r.date)::int - 1) + v_month_step;
      v_year := v_total_months / 12;
      v_month := v_total_months % 12;
      v_last_day := (make_date(v_year, v_month + 1, 1) + interval '1 month')::date - 1;
      v_day := least(extract(day from r.date)::int, extract(day from v_last_day)::int);
      v_result := make_date(v_year, v_month + 1, v_day);
    elsif r.recurring_frequency = 'weekly' then
      v_result := r.date + 7;
    else
      v_result := r.date + greatest(coalesce(r.recurring_interval_days, 1), 1);
    end if;

    update transactions set next_occurrence_date = v_result where id = r.id;
  end loop;
end $$;

alter table transactions drop constraint if exists transactions_recurring_requires_next_occurrence;
alter table transactions add constraint transactions_recurring_requires_next_occurrence
  check (not is_recurring or next_occurrence_date is not null);

create index if not exists transactions_recurring_due_idx on transactions (next_occurrence_date)
  where is_recurring;

-- create_transaction/update_transaction ganan un parámetro más
-- (p_next_occurrence_date) — mismo problema de aridad que en 017/018:
-- Postgres identifica una función por su lista de tipos, así que hay que
-- eliminar la firma vieja explícitamente antes de crear la nueva.
drop function if exists create_transaction(uuid, text, numeric, date, uuid, uuid, uuid, text, text[], boolean, uuid, text, int, date);
drop function if exists update_transaction(uuid, uuid, text, numeric, date, uuid, uuid, uuid, text, text[], boolean, uuid, text, int, date);

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
  p_next_occurrence_date date default null
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
    recurring_frequency, recurring_interval_days, recurring_end_date, next_occurrence_date
  ) values (
    auth.uid(), p_account_id, p_debt_id, p_to_account_id, p_category_id, p_merchant_id,
    p_type, p_amount, p_date, p_note, coalesce(p_tags, '{}'), p_is_recurring,
    p_recurring_frequency, p_recurring_interval_days, p_recurring_end_date, p_next_occurrence_date
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
  p_next_occurrence_date date default null
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
    next_occurrence_date = p_next_occurrence_date
  where id = p_id and user_id = auth.uid()
  returning * into v_transaction;

  return v_transaction;
end;
$$;

-- Genera UNA ocurrencia real de una plantilla recurrente vencida. Se llama
-- exclusivamente desde la ruta del cron (service role, sin sesión de
-- usuario) — por eso NO reusa apply_transaction_effect (que filtra por
-- auth.uid(), NULL en una llamada de service role: fallaría silenciosamente
-- para todas las cuentas/tarjetas). En su lugar aplica el efecto de saldo
-- inlineado, usando el user_id de la propia plantilla. security definer +
-- el chequeo de auth.role() + los revoke/grant de abajo garantizan que
-- ningún usuario autenticado ni anónimo pueda invocarla vía la API pública.
create or replace function generate_recurring_occurrence(
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

revoke all on function generate_recurring_occurrence(uuid, date) from public;
revoke all on function generate_recurring_occurrence(uuid, date) from anon, authenticated;
grant execute on function generate_recurring_occurrence(uuid, date) to service_role;
