-- 011_security_isolation.sql
-- PRIORIDAD 1 / 3 DE SEGURIDAD: aislamiento estricto por usuario.
--
-- Script AUTOCONTENIDO y IDEMPOTENTE. Seguro de pegar directamente en el
-- SQL Editor de Supabase (Dashboard -> SQL -> New query). No requiere las
-- migraciones previas; si ya existen las policies, las reemplaza.
--
-- Cierra dos brechas de autorización SIN tocar la lógica de la aplicación:
--   1) categories: el SELECT era `auth.role() = 'authenticated'`, lo que permitía
--      a cualquier usuario autenticado leer las categorías PRIVADAS de otros
--      usuarios (fuga de datos y habilitaba referencias cruzadas).
--   2) Referencias cruzadas: transactions / recurring_transactions / budgets /
--      accounts permitían referenciar IDs (account_id, category_id, debt_id,
--      destination_account_id, accounts.debt_id) de OTRO usuario.
--
-- Se refuerzan las políticas INSERT/UPDATE con WITH CHECK que validan que las
-- claves foráneas pertenezcan al usuario autenticado (o sean categorías
-- compartidas con user_id IS NULL). No se duplican políticas: se recrean las
-- existentes con el mismo nombre y chequeos adicionales (DROP POLICY IF EXISTS
-- + CREATE POLICY).

-- Asegura RLS activado en las tablas afectadas (no-op si ya lo está).
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.recurring_transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.accounts enable row level security;

-- 1) categories: restringir SELECT a propias + compartidas (user_id IS NULL)
drop policy if exists categories_select_all_for_authenticated on public.categories;
create policy categories_select_own
on public.categories
for select
using (auth.uid() = user_id or user_id is null);

-- 2) transactions: validar referencias en INSERT/UPDATE
drop policy if exists transactions_insert_own on public.transactions;
create policy transactions_insert_own
on public.transactions
for insert
with check (
  auth.uid() = user_id
  and exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  and (category_id is null or exists (select 1 from public.categories c where c.id = category_id and (c.user_id = auth.uid() or c.user_id is null)))
  and (debt_id is null or exists (select 1 from public.debts d where d.id = debt_id and d.user_id = auth.uid()))
  and (destination_account_id is null or exists (select 1 from public.accounts a2 where a2.id = destination_account_id and a2.user_id = auth.uid()))
);

drop policy if exists transactions_update_own on public.transactions;
create policy transactions_update_own
on public.transactions
for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  and (category_id is null or exists (select 1 from public.categories c where c.id = category_id and (c.user_id = auth.uid() or c.user_id is null)))
  and (debt_id is null or exists (select 1 from public.debts d where d.id = debt_id and d.user_id = auth.uid()))
  and (destination_account_id is null or exists (select 1 from public.accounts a2 where a2.id = destination_account_id and a2.user_id = auth.uid()))
);

-- 3) recurring_transactions: validar account_id y category_id
drop policy if exists recurring_insert_own on public.recurring_transactions;
create policy recurring_insert_own
on public.recurring_transactions
for insert
with check (
  auth.uid() = user_id
  and exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  and (category_id is null or exists (select 1 from public.categories c where c.id = category_id and (c.user_id = auth.uid() or c.user_id is null)))
);

drop policy if exists recurring_update_own on public.recurring_transactions;
create policy recurring_update_own
on public.recurring_transactions
for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  and (category_id is null or exists (select 1 from public.categories c where c.id = category_id and (c.user_id = auth.uid() or c.user_id is null)))
);

-- 4) budgets: validar category_id
drop policy if exists budgets_insert_own on public.budgets;
create policy budgets_insert_own
on public.budgets
for insert
with check (
  auth.uid() = user_id
  and exists (select 1 from public.categories c where c.id = category_id and (c.user_id = auth.uid() or c.user_id is null))
);

drop policy if exists budgets_update_own on public.budgets;
create policy budgets_update_own
on public.budgets
for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (select 1 from public.categories c where c.id = category_id and (c.user_id = auth.uid() or c.user_id is null))
);

-- 5) accounts: validar debt_id (cuenta enlazada a deuda propia)
drop policy if exists accounts_insert_own on public.accounts;
create policy accounts_insert_own
on public.accounts
for insert
with check (
  auth.uid() = user_id
  and (debt_id is null or exists (select 1 from public.debts d where d.id = debt_id and d.user_id = auth.uid()))
);

drop policy if exists accounts_update_own on public.accounts;
create policy accounts_update_own
on public.accounts
for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (debt_id is null or exists (select 1 from public.debts d where d.id = debt_id and d.user_id = auth.uid()))
);
