create table if not exists debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null check (type in ('credit_card', 'loan', 'person')),
  principal numeric(14, 2) not null check (principal >= 0),
  interest_rate numeric(6, 3) not null default 0 check (interest_rate >= 0),
  minimum_payment numeric(14, 2) not null default 0 check (minimum_payment >= 0),
  due_day int check (due_day between 1 and 31),
  current_balance numeric(14, 2) not null default 0 check (current_balance >= 0),
  created_at timestamptz not null default now()
);

create index if not exists debts_user_id_idx on debts (user_id);

alter table debts enable row level security;

create policy "debts_select_own" on debts for select
  using (user_id = auth.uid());

create policy "debts_insert_own" on debts for insert
  with check (user_id = auth.uid());

create policy "debts_update_own" on debts for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "debts_delete_own" on debts for delete
  using (user_id = auth.uid());
