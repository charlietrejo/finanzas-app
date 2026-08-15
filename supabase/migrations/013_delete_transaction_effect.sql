-- 013_delete_transaction_effect.sql
-- RPC atómica para eliminar una transacción Y revertir su efecto financiero
-- dentro de una misma transacción SQL, eliminando la ventana de inconsistencia
-- que existía en el flujo cliente (borrar fila -> revertir efecto por separado).
--
-- Garantías:
--   * usa auth.uid() (no confía en el user_id del cliente),
--   * valida que la transacción pertenezca al usuario,
--   * recalcula el reverso internamente (NO acepta deltas libres),
--   * borra la fila solo si la reversión fue exitosa (todo o nada).
--
-- Equivale a revertTransactionEffect() + DELETE en una sola operación atómica.

create or replace function public.delete_transaction_effect(
  p_id uuid,
  p_user_id uuid,
  p_account_id uuid,
  p_type text,
  p_amount numeric,
  p_debt_id uuid,
  p_destination_account_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_acc record;
  v_dest record;
  v_debt record;
  v_amount numeric;
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa.';
  end if;

  if v_uid <> p_user_id then
    raise exception 'No tienes permiso para esta operación.';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount <> floor(p_amount * 100) / 100 then
    raise exception 'El monto debe ser un número positivo con máximo 2 decimales.';
  end if;

  -- La reversión es el espejo del apply: resta lo que el apply sumó.
  v_amount := p_amount;

  -- Validar que la cuenta de origen pertenezca al usuario.
  select id, type, debt_id, current_balance
    into v_acc
    from public.accounts
   where id = p_account_id and user_id = v_uid
   for update;

  if v_acc.id is null then
    raise exception 'No se encontró la cuenta.';
  end if;

  if p_type = 'INCOME' then
    update public.accounts
       set current_balance = current_balance - v_amount,
           updated_at = now()
     where id = v_acc.id;

  elsif p_type = 'EXPENSE' then
    if v_acc.type = 'CREDIT_CARD' then
      if p_debt_id is null then
        update public.accounts
           set current_balance = current_balance - v_amount,
               updated_at = now()
         where id = v_acc.id;
      else
        select id, current_balance, initial_amount
          into v_debt
          from public.debts
         where id = p_debt_id and user_id = v_uid
         for update;

        if v_debt.id is null then
          raise exception 'No se encontró la deuda asociada a la tarjeta.';
        end if;

        -- Al revertir una compra, la deuda nunca debe bajar de 0.
        if v_debt.current_balance < v_amount then
          raise exception 'La reversión dejaría la deuda con saldo negativo.';
        end if;

        update public.debts
           set current_balance = current_balance - v_amount,
               updated_at = now()
         where id = v_debt.id;
      end if;
    else
      update public.accounts
         set current_balance = current_balance + v_amount,
             updated_at = now()
       where id = v_acc.id;
    end if;

  elsif p_type = 'TRANSFER' then
    if p_destination_account_id is null then
      raise exception 'Selecciona la cuenta de destino para la transferencia.';
    end if;
    if p_destination_account_id = p_account_id then
      raise exception 'La cuenta de origen y destino no pueden ser la misma.';
    end if;

    select id, current_balance
      into v_dest
      from public.accounts
     where id = p_destination_account_id and user_id = v_uid
     for update;

    if v_dest.id is null then
      raise exception 'No se encontró la cuenta de destino.';
    end if;

    update public.accounts
       set current_balance = current_balance + v_amount,
           updated_at = now()
     where id = v_acc.id;

    update public.accounts
       set current_balance = current_balance - v_amount,
           updated_at = now()
     where id = v_dest.id;

  elsif p_type = 'DEBT_PAYMENT' then
    if p_debt_id is null then
      raise exception 'Selecciona la deuda que deseas pagar.';
    end if;

    select id, current_balance, initial_amount
      into v_debt
      from public.debts
     where id = p_debt_id and user_id = v_uid
     for update;

    if v_debt.id is null then
      raise exception 'No se encontró la deuda que deseas pagar.';
    end if;

    -- Al revertir un pago, la deuda no debe superar su límite inicial.
    if v_debt.current_balance + v_amount > v_debt.initial_amount then
      raise exception 'La reversión excede el límite de la deuda.';
    end if;

    update public.accounts
       set current_balance = current_balance + v_amount,
           updated_at = now()
     where id = v_acc.id;

    update public.debts
       set current_balance = current_balance + v_amount,
           updated_at = now()
     where id = v_debt.id;

  else
    raise exception 'Tipo de transacción no válido.';
  end if;

  -- Solo después de revertir los saldos, borramos la fila. Todo en la misma
  -- transacción SQL: si algo falló arriba, la fila nunca se borra.
  delete from public.transactions
   where id = p_id and user_id = v_uid;

  if not found then
    raise exception 'No se encontró la transacción a eliminar.';
  end if;
end;
$$;

-- Permitir a los usuarios autenticados ejecutar la RPC (respeta auth.uid()).
revoke execute on function public.delete_transaction_effect(uuid,uuid,uuid,text,numeric,uuid,uuid) from public;
grant execute on function public.delete_transaction_effect(uuid,uuid,uuid,text,numeric,uuid,uuid) to authenticated;
