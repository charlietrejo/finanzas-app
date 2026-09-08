create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  target_amount numeric(14, 2) not null check (target_amount > 0),
  current_amount numeric(14, 2) not null default 0 check (current_amount >= 0),
  target_date date not null,
  account_id uuid references accounts (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists goals_user_id_idx on goals (user_id);

alter table goals enable row level security;

create policy "goals_select_own" on goals for select
  using (user_id = auth.uid());

create policy "goals_insert_own" on goals for insert
  with check (user_id = auth.uid());

create policy "goals_update_own" on goals for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "goals_delete_own" on goals for delete
  using (user_id = auth.uid());
