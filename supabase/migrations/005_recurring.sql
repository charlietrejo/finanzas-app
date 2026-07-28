create table if not exists public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  type text not null check (type in ('INCOME','EXPENSE','TRANSFER')),
  amount numeric(12,2) not null check (amount > 0),
  description text not null,
  frequency text not null check (frequency in ('DAILY','WEEKLY','BIWEEKLY','MONTHLY','YEARLY')),
  start_date date not null,
  end_date date,
  next_occurrence date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recurring_transactions_user_id_idx on public.recurring_transactions (user_id);
create index if not exists recurring_transactions_next_occurrence_idx on public.recurring_transactions (next_occurrence);
create index if not exists recurring_transactions_active_idx on public.recurring_transactions (active);

alter table public.recurring_transactions enable row level security;

create policy if not exists recurring_select_own on public.recurring_transactions
  for select using (auth.uid() = user_id);

create policy if not exists recurring_insert_own on public.recurring_transactions
  for insert with check (auth.uid() = user_id);

create policy if not exists recurring_update_own on public.recurring_transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy if not exists recurring_delete_own on public.recurring_transactions
  for delete using (auth.uid() = user_id);
