-- 012_transaction_effects_rpc.sql
-- RPC transaccional para aplicar/revertir efectos financieros de forma atómica.
-- Centraliza en PostgreSQL la lógica de saldos de accounts/debts, eliminando
-- la inconsistencia por fallo a medias que ocurría al hacer múltiples
-- .update() separados desde el cliente.
--
-- La función:
--   * usa auth.uid() (no confía en user_id del cliente),
--   * valida pertenencia de account_id / debt_id / destination_account_id al usuario,
--   * recalcula los deltas internamente (NO acepta deltas libres),
--   * rechaza montos inválidos y saldos insuficientes con mensajes claros,
--   * garantiza que el saldo de deuda nunca quede por debajo de 0,
--   * ejecuta todo dentro de una transacción SQL (BEGIN..COMMIT).

create or replace function public.apply_transaction_effect(
  p_action text,                 -- 'apply' | 'revert'
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
  v_amount numeric;
  v_mult int;
  v_acc record;
  v_dest record;
  v_debt record;
  v_sign int;
begin
  -- Solo el usuario autenticado puede ejecutar sobre sus propios datos.
  if v_uid is null then
    raise exception 'No hay una sesión activa.';
  end if;

  if p_action is distinct from 'apply' and p_action is distinct from 'revert' then
    raise exception 'Acción no válida.';
  end if;

  -- Validación de monto (la BD también lo exige, pero damos mensaje claro).
  if p_amount is null or p_amount <= 0 or p_amount <> floor(p_amount * 100) / 100 then
    raise exception 'El monto debe ser un número positivo con máximo 2 decimales.';
  end if;

  -- La función opera siempre sobre los datos del usuario autenticado.
  if v_uid <> p_user_id then
    raise exception 'No tienes permiso para esta operación.';
  end if;

  -- apply suma el efecto; revert lo resta (espejo).
  v_mult := case when p_action = 'apply' then 1 else -1 end;
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
       set current_balance = current_balance + (v_mult * v_amount),
           updated_at = now()
     where id = v_acc.id;

  elsif p_type = 'EXPENSE' then
    if v_acc.type = 'CREDIT_CARD' then
      if p_debt_id is null then
        -- Tarjeta sin deuda enlazada: el saldo de la cuenta es la deuda misma.
        update public.accounts
           set current_balance = current_balance + (v_mult * v_amount),
               updated_at = now()
         where id = v_acc.id;
      else
        -- Compra con tarjeta enlazada a deuda: afecta la deuda.
        select id, current_balance, initial_amount
          into v_debt
          from public.debts
         where id = p_debt_id and user_id = v_uid
         for update;

        if v_debt.id is null then
          raise exception 'No se encontró la deuda asociada a la tarjeta.';
        end if;

        if v_mult = 1 then
          -- Aplicar compra: la deuda actual no puede superar el límite.
          if (v_debt.current_balance + v_amount) > v_debt.initial_amount then
            raise exception 'La compra excede el límite de la tarjeta.';
          end if;
        end if;

        update public.debts
           set current_balance = current_balance + (v_mult * v_amount),
               updated_at = now()
         where id = v_debt.id;
      end if;
    else
      -- Cuenta bancaria: el gasto no puede dejar saldo negativo.
      if v_mult = 1 then
        if v_acc.current_balance < v_amount then
          raise exception 'No tienes saldo suficiente en esta cuenta para realizar este gasto.';
        end if;
      end if;

      update public.accounts
         set current_balance = current_balance - (v_mult * v_amount),
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

    if v_mult = 1 then
      if v_acc.current_balance < v_amount then
        raise exception 'Saldo insuficiente en la cuenta de origen para realizar la transferencia.';
      end if;
    end if;

    update public.accounts
       set current_balance = current_balance - (v_mult * v_amount),
           updated_at = now()
     where id = v_acc.id;

    update public.accounts
       set current_balance = current_balance + (v_mult * v_amount),
           updated_at = now()
     where id = v_dest.id;

  elsif p_type = 'DEBT_PAYMENT' then
    if p_debt_id is null then
      raise exception 'Selecciona la deuda que deseas pagar.';
    end if;

    select id, current_balance
      into v_debt
      from public.debts
     where id = p_debt_id and user_id = v_uid
     for update;

    if v_debt.id is null then
      raise exception 'No se encontró la deuda que deseas pagar.';
    end if;

    if v_mult = 1 then
      -- Aplicar pago: la cuenta debe cubrirlo y la deuda no bajar de 0.
      if v_acc.current_balance < v_amount then
        raise exception 'No tienes saldo suficiente en esta cuenta para realizar este pago.';
      end if;
      if v_debt.current_balance < v_amount then
        raise exception 'El pago no puede ser mayor a la deuda actual.';
      end if;
    end if;

    update public.accounts
       set current_balance = current_balance - (v_mult * v_amount),
           updated_at = now()
     where id = v_acc.id;

    update public.debts
       set current_balance = current_balance - (v_mult * v_amount),
           updated_at = now()
     where id = v_debt.id;

  else
    raise exception 'Tipo de transacción no válido.';
  end if;
end;
$$;

-- Permitir a los usuarios autenticados ejecutar la RPC (respeta auth.uid()).
revoke execute on function public.apply_transaction_effect(text,uuid,uuid,uuid,text,numeric,uuid,uuid) from public;
grant execute on function public.apply_transaction_effect(text,uuid,uuid,uuid,text,numeric,uuid,uuid) to authenticated;
