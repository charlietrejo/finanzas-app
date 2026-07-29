create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('INCOME','EXPENSE')),
  parent_id uuid references public.categories(id) on delete set null,
  icon text,
  color text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists categories_user_id_idx
on public.categories (user_id);

create index if not exists categories_type_idx
on public.categories (type);

create index if not exists categories_parent_id_idx
on public.categories (parent_id);

alter table public.categories enable row level security;

drop policy if exists categories_select_all_for_authenticated on public.categories;
create policy categories_select_all_for_authenticated
on public.categories
for select
using (auth.role() = 'authenticated');

drop policy if exists categories_insert_own on public.categories;
create policy categories_insert_own
on public.categories
for insert
with check (auth.uid() = user_id or user_id is null);

drop policy if exists categories_update_own on public.categories;
create policy categories_update_own
on public.categories
for update
using (auth.uid() = user_id or user_id is null)
with check (auth.uid() = user_id or user_id is null);

drop policy if exists categories_delete_own on public.categories;
create policy categories_delete_own
on public.categories
for delete
using (auth.uid() = user_id or user_id is null);

insert into public.categories (id, user_id, name, type, icon, color, is_default)
values
  (gen_random_uuid(), null, 'Salario', 'INCOME', 'briefcase', '#2563eb', true),
  (gen_random_uuid(), null, 'Ingreso extra', 'INCOME', 'plus', '#16a34a', true),
  (gen_random_uuid(), null, 'Freelance', 'INCOME', 'computer', '#7c3aed', true),
  (gen_random_uuid(), null, 'Bonos', 'INCOME', 'gift', '#f59e0b', true),
  (gen_random_uuid(), null, 'Inversiones', 'INCOME', 'trending-up', '#0f766e', true),
  (gen_random_uuid(), null, 'Otros ingresos', 'INCOME', 'wallet', '#64748b', true),
  (gen_random_uuid(), null, 'Casa', 'EXPENSE', 'home', '#dc2626', true),
  (gen_random_uuid(), null, 'Trabajo', 'EXPENSE', 'briefcase', '#3b82f6', true),
  (gen_random_uuid(), null, 'Alimentación', 'EXPENSE', 'utensils', '#f97316', true),
  (gen_random_uuid(), null, 'Transporte', 'EXPENSE', 'car', '#8b5cf6', true),
  (gen_random_uuid(), null, 'Ocio', 'EXPENSE', 'party-popper', '#ec4899', true),
  (gen_random_uuid(), null, 'Diversión', 'EXPENSE', 'gamepad', '#14b8a6', true),
  (gen_random_uuid(), null, 'Finanzas', 'EXPENSE', 'coins', '#a16207', true),
  (gen_random_uuid(), null, 'Salud', 'EXPENSE', 'heart-pulse', '#ef4444', true),
  (gen_random_uuid(), null, 'Compras', 'EXPENSE', 'shopping-bag', '#4f46e5', true),
  (gen_random_uuid(), null, 'Otros', 'EXPENSE', 'more-horizontal', '#64748b', true)
on conflict do nothing;
