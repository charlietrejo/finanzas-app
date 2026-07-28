create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  type text not null check (type in ('INCOME','EXPENSE','TRANSFER')),
  amount numeric(12,2) not null check (amount > 0),
  description text not null,
  notes text,
  transaction_date date not null,
  destination_account_id uuid references public.accounts(id) on delete set null,
  transfer_group_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactions_user_id_idx on public.transactions (user_id);
create index if not exists transactions_transaction_date_idx on public.transactions (transaction_date);
create index if not exists transactions_category_id_idx on public.transactions (category_id);
create index if not exists transactions_account_id_idx on public.transactions (account_id);
create index if not exists transactions_type_idx on public.transactions (type);

alter table public.transactions enable row level security;

create policy if not exists transactions_select_own on public.transactions
  for select using (auth.uid() = user_id);

create policy if not exists transactions_insert_own on public.transactions
  for insert with check (auth.uid() = user_id);

create policy if not exists transactions_update_own on public.transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy if not exists transactions_delete_own on public.transactions
  for delete using (auth.uid() = user_id);
