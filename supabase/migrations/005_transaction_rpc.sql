-- Aplica el efecto de saldo de una transacción NUEVA sobre las cuentas involucradas,
-- validando la regla de "no saldo negativo" (excepto crédito, hasta credit_limit).
-- Lanza una excepción (y por lo tanto revierte toda la función que la llama) si la
-- operación dejaría un saldo inválido.
create or replace function apply_transaction_effect(
  p_account_id uuid,
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
  v_new_balance numeric;
begin
  select * into v_account from accounts where id = p_account_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Cuenta no encontrada';
  end if;

  if p_type = 'income' then
    update accounts set current_balance = current_balance + p_amount where id = v_account.id;

  elsif p_type = 'expense' then
    v_new_balance := v_account.current_balance - p_amount;
    if v_account.type <> 'credit' and v_new_balance < 0 then
      raise exception 'Saldo insuficiente en la cuenta "%"', v_account.name;
    end if;
    if v_account.type = 'credit' and v_new_balance < -coalesce(v_account.credit_limit, 0) then
      raise exception 'El gasto excede el límite de crédito de "%"', v_account.name;
    end if;
    update accounts set current_balance = v_new_balance where id = v_account.id;

  elsif p_type = 'transfer' then
    if p_to_account_id is null then
      raise exception 'Se requiere cuenta destino para una transferencia';
    end if;
    select * into v_to_account from accounts where id = p_to_account_id and user_id = auth.uid() for update;
    if not found then
      raise exception 'Cuenta destino no encontrada';
    end if;

    v_new_balance := v_account.current_balance - p_amount;
    if v_account.type <> 'credit' and v_new_balance < 0 then
      raise exception 'Saldo insuficiente en la cuenta de origen "%"', v_account.name;
    end if;
    if v_account.type = 'credit' and v_new_balance < -coalesce(v_account.credit_limit, 0) then
      raise exception 'La transferencia excede el límite de crédito de "%"', v_account.name;
    end if;

    update accounts set current_balance = v_new_balance where id = v_account.id;
    update accounts set current_balance = current_balance + p_amount where id = v_to_account.id;

  else
    raise exception 'Tipo de transacción inválido: %', p_type;
  end if;
end;
$$;

-- Revierte el efecto de saldo de una transacción EXISTENTE (usado antes de borrar
-- o antes de re-aplicar en un update). No valida saldo negativo: siempre debe ser
-- posible deshacer una operación que sí se ejecutó.
create or replace function reverse_transaction_effect(
  p_account_id uuid,
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
    update accounts set current_balance = current_balance + p_amount
      where id = p_account_id and user_id = auth.uid();

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
  p_recurring_rule jsonb default null
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

  perform apply_transaction_effect(p_account_id, p_type, p_amount, p_to_account_id);

  insert into transactions (
    user_id, account_id, to_account_id, category_id, merchant_id,
    type, amount, date, note, tags, is_recurring, recurring_rule
  ) values (
    auth.uid(), p_account_id, p_to_account_id, p_category_id, p_merchant_id,
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
  p_recurring_rule jsonb default null
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

  select * into v_old from transactions where id = p_id and user_id = auth.uid();
  if not found then
    raise exception 'Transacción no encontrada';
  end if;

  perform reverse_transaction_effect(v_old.account_id, v_old.type, v_old.amount, v_old.to_account_id);
  perform apply_transaction_effect(p_account_id, p_type, p_amount, p_to_account_id);

  update transactions set
    account_id = p_account_id,
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

  perform reverse_transaction_effect(v_old.account_id, v_old.type, v_old.amount, v_old.to_account_id);

  delete from transactions where id = p_id and user_id = auth.uid();
end;
$$;
