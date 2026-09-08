create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references categories (id) on delete cascade,
  month date not null,
  amount_limit numeric(14, 2) not null check (amount_limit > 0),
  alert_threshold_pct int not null default 80 check (alert_threshold_pct between 1 and 100),
  created_at timestamptz not null default now(),
  constraint month_is_first_of_month check (extract(day from month) = 1),
  unique (user_id, category_id, month)
);

create index if not exists budgets_user_id_idx on budgets (user_id);
create index if not exists budgets_month_idx on budgets (month);

alter table budgets enable row level security;

create policy "budgets_select_own" on budgets for select
  using (user_id = auth.uid());

create policy "budgets_insert_own" on budgets for insert
  with check (user_id = auth.uid());

create policy "budgets_update_own" on budgets for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "budgets_delete_own" on budgets for delete
  using (user_id = auth.uid());
