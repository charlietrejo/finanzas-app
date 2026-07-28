create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(12,2) not null check (target_amount > 0),
  current_amount numeric(12,2) not null default 0 check (current_amount >= 0),
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists goals_user_id_idx on public.goals (user_id);
create index if not exists goals_target_date_idx on public.goals (target_date);

alter table public.goals enable row level security;

create policy if not exists goals_select_own on public.goals
  for select using (auth.uid() = user_id);

create policy if not exists goals_insert_own on public.goals
  for insert with check (auth.uid() = user_id);

create policy if not exists goals_update_own on public.goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy if not exists goals_delete_own on public.goals
  for delete using (auth.uid() = user_id);
