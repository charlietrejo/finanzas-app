create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  period text not null check (period in ('MONTHLY','WEEKLY','YEARLY')),
  start_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists budgets_user_id_idx
on public.budgets (user_id);

create index if not exists budgets_category_id_idx
on public.budgets (category_id);

create index if not exists budgets_start_date_idx
on public.budgets (start_date);

alter table public.budgets enable row level security;

drop policy if exists budgets_select_own on public.budgets;
create policy budgets_select_own
on public.budgets
for select
using (auth.uid() = user_id);

drop policy if exists budgets_insert_own on public.budgets;
create policy budgets_insert_own
on public.budgets
for insert
with check (auth.uid() = user_id);

drop policy if exists budgets_update_own on public.budgets;
create policy budgets_update_own
on public.budgets
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists budgets_delete_own on public.budgets;
create policy budgets_delete_own
on public.budgets
for delete
using (auth.uid() = user_id);
