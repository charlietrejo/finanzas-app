create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references accounts (id) on delete cascade,
  to_account_id uuid references accounts (id) on delete cascade,
  category_id uuid references categories (id) on delete set null,
  merchant_id uuid references merchants (id) on delete set null,
  type text not null check (type in ('income', 'expense', 'transfer')),
  amount numeric(14, 2) not null check (amount > 0),
  date date not null default current_date,
  note text,
  tags text[] not null default '{}',
  is_recurring boolean not null default false,
  recurring_rule jsonb,
  created_at timestamptz not null default now(),
  constraint transfer_requires_to_account check (
    (type = 'transfer' and to_account_id is not null)
    or (type <> 'transfer' and to_account_id is null)
  )
);

create index if not exists transactions_user_id_idx on transactions (user_id);
create index if not exists transactions_account_id_idx on transactions (account_id);
create index if not exists transactions_date_idx on transactions (date);

alter table transactions enable row level security;

create policy "transactions_select_own" on transactions for select
  using (user_id = auth.uid());

-- Insert/update/delete directos deshabilitados: las mutaciones pasan por las
-- funciones RPC atómicas (005_transaction_rpc.sql) para mantener accounts.current_balance
-- consistente. Las RPC son security invoker, así que igual respetan RLS.
create policy "transactions_insert_own" on transactions for insert
  with check (user_id = auth.uid());

create policy "transactions_update_own" on transactions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "transactions_delete_own" on transactions for delete
  using (user_id = auth.uid());
