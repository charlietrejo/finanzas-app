-- Bring the transactions table in line with the application model.
-- The code references transactions.debt_id (link to a debt for credit-card
-- purchases and debt payments) and the DEBT_PAYMENT transaction type, which
-- were not included in the original 004_transactions.sql migration.

-- 1) Add the debt_id column (nullable, references debts).
alter table public.transactions
add column if not exists debt_id uuid null references public.debts(id) on delete set null;

create index if not exists transactions_debt_id_idx
on public.transactions (debt_id);

-- 2) Extend the type check to allow DEBT_PAYMENT.
-- Inline CHECK constraints are auto-named <table>_<column>_check.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'transactions_type_check'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      drop constraint transactions_type_check;
  end if;
end $$;

alter table public.transactions
add constraint transactions_type_check
check (type in ('INCOME','EXPENSE','TRANSFER','DEBT_PAYMENT'));

-- No RLS changes are required: existing policies already restrict rows to the
-- owning user (auth.uid() = user_id). Both new column and new value are covered.
