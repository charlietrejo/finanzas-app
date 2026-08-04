alter table public.accounts
add column if not exists debt_id uuid null references public.debts(id) on delete set null;

create index if not exists accounts_debt_id_idx
on public.accounts (debt_id);

-- No changes to row level security policies are required because existing policies
-- already restrict operations to the owning user (auth.uid() = user_id).
-- This column is nullable and will not affect existing accounts.
