create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  currency text not null default 'MXN',
  locale text not null default 'es-MX',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_user_id_idx
on public.profiles (id);

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own
on public.profiles
for delete
using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();
