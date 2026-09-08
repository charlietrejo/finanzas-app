create table if not exists goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null references goals (id) on delete cascade,
  account_id uuid not null references accounts (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists goal_contributions_user_id_idx on goal_contributions (user_id);
create index if not exists goal_contributions_goal_id_idx on goal_contributions (goal_id);

alter table goal_contributions enable row level security;

create policy "goal_contributions_select_own" on goal_contributions for select
  using (user_id = auth.uid());

create policy "goal_contributions_insert_own" on goal_contributions for insert
  with check (user_id = auth.uid());

create policy "goal_contributions_delete_own" on goal_contributions for delete
  using (user_id = auth.uid());
