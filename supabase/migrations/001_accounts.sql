create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null check (type in ('cash', 'debit', 'credit', 'investment', 'savings')),
  bank_name text,
  initial_balance numeric(14, 2) not null default 0,
  current_balance numeric(14, 2) not null default 0,
  credit_limit numeric(14, 2),
  created_at timestamptz not null default now(),
  constraint credit_limit_only_for_credit check (type = 'credit' or credit_limit is null),
  constraint no_negative_balance_unless_credit check (
    (type <> 'credit' and current_balance >= 0)
    or (type = 'credit' and current_balance >= -coalesce(credit_limit, 0))
  )
);

create index if not exists accounts_user_id_idx on accounts (user_id);

alter table accounts enable row level security;

create policy "accounts_select_own" on accounts for select
  using (user_id = auth.uid());

create policy "accounts_insert_own" on accounts for insert
  with check (user_id = auth.uid());

create policy "accounts_update_own" on accounts for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "accounts_delete_own" on accounts for delete
  using (user_id = auth.uid());
