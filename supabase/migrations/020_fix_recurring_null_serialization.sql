-- Fix de un bug real encontrado al correr scripts/verify-recurring-cron.mjs
-- contra la BD (los 3 casos de prueba de la Fase 8): generate_recurring_occurrence
-- devolvía `transactions` (tipo compuesto). Cuando el valor real es SQL NULL
-- (nada que generar), PostgREST expande esa fila NULL como un objeto JSON
-- con TODAS las columnas en null — NO como JSON null — porque expone
-- funciones que retornan un row type ejecutándolas en un FROM, y Postgres
-- expande NULL::compuesto ahí como una fila de columnas null, no como
-- ausencia de fila. Efecto: en src/app/api/cron/generate-recurring/route.ts,
-- `if (data) { generated++ } else { skipped++ }` contaba TODO como
-- "generated", incluso lo que el motor correctamente omitió por idempotencia
-- o por no estar vencido — confirmado por los 3 asserts que comparaban
-- `xRun === null` fallando pese a que la idempotencia real (sin duplicar
-- filas) sí funcionaba.
--
-- Solución: cambiar el tipo de retorno a jsonb. Un jsonb NULL es un valor
-- escalar, no un row source expandible por FROM — PostgREST lo serializa
-- como JSON null real cuando la función retorna null::jsonb.

drop function if exists generate_recurring_occurrence(uuid, date);

create or replace function generate_recurring_occurrence(
  p_template_id uuid,
  p_next_occurrence_date date
) returns jsonb
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

  if v_new.id is null then
    return null;
  end if;
  return to_jsonb(v_new);
end;
$$;

revoke all on function generate_recurring_occurrence(uuid, date) from public;
revoke all on function generate_recurring_occurrence(uuid, date) from anon, authenticated;
grant execute on function generate_recurring_occurrence(uuid, date) to service_role;
