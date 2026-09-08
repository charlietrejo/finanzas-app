create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  parent_id uuid references categories (id) on delete set null,
  type text not null check (type in ('income', 'expense')),
  icon text,
  color text,
  created_at timestamptz not null default now()
);

create index if not exists categories_user_id_idx on categories (user_id);

alter table categories enable row level security;

create policy "categories_select_own" on categories for select
  using (user_id = auth.uid());

create policy "categories_insert_own" on categories for insert
  with check (user_id = auth.uid());

create policy "categories_update_own" on categories for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "categories_delete_own" on categories for delete
  using (user_id = auth.uid());
