-- Aplica el efecto de una aportación a meta NUEVA: reutiliza
-- apply_transaction_effect tratando la aportación como "expense" sobre la
-- cuenta de origen (misma validación de saldo), y suma goals.current_amount
-- (sin tope: superar la meta es válido).
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

  perform apply_transaction_effect(p_account_id, 'expense', p_amount, null);

  update goals set current_amount = current_amount + p_amount
    where id = p_goal_id and user_id = auth.uid();
end;
$$;

-- Revierte el efecto de una aportación EXISTENTE (antes de borrarla).
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
  perform reverse_transaction_effect(p_account_id, 'expense', p_amount, null);

  update goals set current_amount = greatest(current_amount - p_amount, 0)
    where id = p_goal_id and user_id = auth.uid();
end;
$$;

create or replace function create_goal_contribution(
  p_goal_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_date date,
  p_note text default null
) returns goal_contributions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_contribution goal_contributions;
begin
  if p_amount <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;

  perform apply_goal_contribution_effect(p_goal_id, p_account_id, p_amount);

  insert into goal_contributions (user_id, goal_id, account_id, amount, date, note)
  values (auth.uid(), p_goal_id, p_account_id, p_amount, p_date, p_note)
  returning * into v_contribution;

  return v_contribution;
end;
$$;

create or replace function delete_goal_contribution(p_id uuid) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_old goal_contributions;
begin
  select * into v_old from goal_contributions where id = p_id and user_id = auth.uid();
  if not found then
    raise exception 'Aportación no encontrada';
  end if;

  perform reverse_goal_contribution_effect(v_old.goal_id, v_old.account_id, v_old.amount);

  delete from goal_contributions where id = p_id and user_id = auth.uid();
end;
$$;
