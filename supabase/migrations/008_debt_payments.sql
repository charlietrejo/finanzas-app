create table if not exists debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  debt_id uuid not null references debts (id) on delete cascade,
  account_id uuid not null references accounts (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists debt_payments_user_id_idx on debt_payments (user_id);
create index if not exists debt_payments_debt_id_idx on debt_payments (debt_id);

alter table debt_payments enable row level security;

create policy "debt_payments_select_own" on debt_payments for select
  using (user_id = auth.uid());

create policy "debt_payments_insert_own" on debt_payments for insert
  with check (user_id = auth.uid());

create policy "debt_payments_delete_own" on debt_payments for delete
  using (user_id = auth.uid());
