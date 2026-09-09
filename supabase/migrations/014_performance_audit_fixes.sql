-- Auditoría de rendimiento: dos hallazgos de alta prioridad.

-- 1) Índice compuesto para la query más repetida de la app (Dashboard,
-- Presupuestos y Reportes calculan gasto por categoría/mes con
-- `type = 'expense' and date >= X and date < Y`, filtrado además por
-- user_id vía RLS). Los índices existentes son de una sola columna
-- (user_id, account_id, date) — ninguno cubre `type` ni la combinación.
create index if not exists transactions_user_type_date_idx
  on transactions (user_id, type, date);

-- 2) `merchants` es un catálogo compartido y de solo lectura (sección 3.8
-- del doc): no tiene datos de usuario, así que no hay razón para exigir
-- autenticación para leerlo. Se abre a `anon` además de `authenticated`
-- para poder cachearlo (Next.js unstable_cache) con un cliente de
-- Supabase sin cookies/sesión — antes se re-consultaba completo en cada
-- carga de /transactions.
drop policy if exists "merchants_select_authenticated" on merchants;

create policy "merchants_select_public" on merchants for select
  to anon, authenticated
  using (true);
