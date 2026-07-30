create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  name text not null,

  type text not null check (
    type in ('CREDIT_CARD','LOAN','MORTGAGE','OTHER')
  ),

  initial_amount numeric(12,2) not null default 0,
  current_balance numeric(12,2) not null default 0,

  due_date date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create index if not exists debts_user_id_idx
on public.debts(user_id);


alter table public.debts enable row level security;


create policy debts_select_own
on public.debts
for select
using (auth.uid() = user_id);


create policy debts_insert_own
on public.debts
for insert
with check (auth.uid() = user_id);


create policy debts_update_own
on public.debts
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


create policy debts_delete_own
on public.debts
for delete
using (auth.uid() = user_id);