create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (
    type in ('CASH','BANK','CREDIT_CARD','SAVINGS','INVESTMENT','OTHER')
  ),
  initial_balance numeric(12,2) not null default 0,
  current_balance numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accounts_user_id_idx
on public.accounts (user_id);

create index if not exists accounts_type_idx
on public.accounts (type);

alter table public.accounts enable row level security;

drop policy if exists accounts_select_own on public.accounts;
create policy accounts_select_own
on public.accounts
for select
using (auth.uid() = user_id);

drop policy if exists accounts_insert_own on public.accounts;
create policy accounts_insert_own
on public.accounts
for insert
with check (auth.uid() = user_id);

drop policy if exists accounts_update_own on public.accounts;
create policy accounts_update_own
on public.accounts
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists accounts_delete_own on public.accounts;
create policy accounts_delete_own
on public.accounts
for delete
using (auth.uid() = user_id);
