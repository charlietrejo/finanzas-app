-- 016_debts_account_ownership.sql
-- Cierra FAIL #4 de la pentest: debts.account_id podía apuntar a una cuenta
-- perteneciente a OTRO usuario (referencia cruzada cross-user).
--
-- La política RLS de debts (011) filtra por user_id = auth.uid(), pero el
-- campo account_id (FK a accounts) solo validaba que el ID existiera, no su
-- propiedad. Esto permitía a un usuario B crear/modificar una deuda B que
-- referenciara la cuenta bancaria de A.
--
-- Solución (Opción A, defensa en BD, no evadible desde el cliente):
-- trigger BEFORE INSERT/UPDATE que garantiza:
--   debts.user_id = accounts.user_id  cuando  debts.account_id IS NOT NULL
--
-- Permite: deuda B -> cuenta B, deuda A -> cuenta A, deuda sin account_id (NULL).
-- Bloquea: deuda B -> cuenta A (INSERT y UPDATE).
-- El error es claro y la operación no se aplica (todo-o-nada).

create or replace function public.check_debt_account_ownership()
returns trigger
language plpgsql
as $$
begin
  if NEW.account_id is not null then
    if not exists (
      select 1
        from public.accounts a
       where a.id = NEW.account_id
         and a.user_id = NEW.user_id
    ) then
      raise exception 'La cuenta seleccionada no pertenece al usuario de la deuda.';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_debt_account_ownership on public.debts;
create trigger trg_debt_account_ownership
  before insert or update on public.debts
  for each row
  execute function public.check_debt_account_ownership();
