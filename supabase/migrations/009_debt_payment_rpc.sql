-- Aplica el efecto de un pago de deuda NUEVO: reutiliza apply_transaction_effect
-- (005_transaction_rpc.sql) tratando el pago como un "expense" sobre la cuenta
-- de origen (misma validación de saldo negativo/credit_limit), y además reduce
-- debts.current_balance. Rechaza si el pago excede el saldo de la deuda.
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

  perform apply_transaction_effect(p_account_id, 'expense', p_amount, null);

  update debts set current_balance = current_balance - p_amount
    where id = p_debt_id and user_id = auth.uid();
end;
$$;

-- Revierte el efecto de un pago EXISTENTE (antes de borrarlo).
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
  perform reverse_transaction_effect(p_account_id, 'expense', p_amount, null);

  update debts set current_balance = current_balance + p_amount
    where id = p_debt_id and user_id = auth.uid();
end;
$$;

create or replace function create_debt_payment(
  p_debt_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_date date,
  p_note text default null
) returns debt_payments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment debt_payments;
begin
  if p_amount <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;

  perform apply_debt_payment_effect(p_debt_id, p_account_id, p_amount);

  insert into debt_payments (user_id, debt_id, account_id, amount, date, note)
  values (auth.uid(), p_debt_id, p_account_id, p_amount, p_date, p_note)
  returning * into v_payment;

  return v_payment;
end;
$$;

create or replace function delete_debt_payment(p_id uuid) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_old debt_payments;
begin
  select * into v_old from debt_payments where id = p_id and user_id = auth.uid();
  if not found then
    raise exception 'Pago no encontrado';
  end if;

  perform reverse_debt_payment_effect(v_old.debt_id, v_old.account_id, v_old.amount);

  delete from debt_payments where id = p_id and user_id = auth.uid();
end;
$$;
