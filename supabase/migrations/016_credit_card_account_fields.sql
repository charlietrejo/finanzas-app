-- Sección 6 del doc de requerimientos ("Corrección de diseño: tarjetas de
-- crédito"): las tarjetas de crédito viven solo en `accounts` (con sus
-- propios datos de deuda), no como registro duplicado en `debts`. `debts`
-- queda reservada para préstamos y deudas personales.

alter table accounts
  add column if not exists interest_rate numeric(6, 3),
  add column if not exists minimum_payment numeric(14, 2),
  add column if not exists cutoff_day int,
  add column if not exists payment_due_day int;

alter table accounts
  add constraint accounts_credit_day_range
    check (cutoff_day is null or cutoff_day between 1 and 31),
  add constraint accounts_payment_day_range
    check (payment_due_day is null or payment_due_day between 1 and 31),
  add constraint accounts_credit_fields_only_for_credit
    check (
      type = 'credit'
      or (interest_rate is null and minimum_payment is null and cutoff_day is null and payment_due_day is null)
    );

alter table debts
  add column if not exists archived_at timestamptz;

-- Amplía el tipo permitido: 'credit_card' se conserva solo como valor legacy
-- para filas archivadas (nunca se ofrece de nuevo en el formulario de
-- creación); 'person' se renombra a 'personal' para calzar con el doc — no
-- hay ninguna fila 'person' hoy, es un rename sin riesgo de dato.
alter table debts drop constraint if exists debts_type_check;
update debts set type = 'personal' where type = 'person';
alter table debts add constraint debts_type_check
  check (type in ('loan', 'personal', 'credit_card'));

-- Migración de datos genérica (no hardcodea nombres/IDs reales): para cada
-- deuda tipo tarjeta todavía no archivada, si existe una cuenta de crédito
-- del mismo usuario con el mismo nombre, le copia los datos de deuda; si no
-- existe ninguna, crea la cuenta nueva con credit_limit = current_balance
-- (regla acordada con el usuario cuando no se conoce el límite real — él lo
-- corrige después desde Cuentas → Editar). En ambos casos la deuda original
-- se archiva (archived_at = now()), nunca se borra.
do $$
declare
  d record;
  matching_account_id uuid;
begin
  for d in select * from debts where type = 'credit_card' and archived_at is null loop
    select id into matching_account_id
      from accounts
      where user_id = d.user_id and type = 'credit' and name = d.name
      limit 1;

    if matching_account_id is not null then
      update accounts set
        interest_rate = d.interest_rate,
        minimum_payment = d.minimum_payment,
        payment_due_day = d.due_day
      where id = matching_account_id;
    else
      insert into accounts (
        user_id, name, type, initial_balance, current_balance,
        credit_limit, interest_rate, minimum_payment, payment_due_day
      ) values (
        d.user_id, d.name, 'credit', -d.current_balance, -d.current_balance,
        d.current_balance, d.interest_rate, d.minimum_payment, d.due_day
      );
    end if;

    update debts set archived_at = now() where id = d.id;
  end loop;
end $$;
