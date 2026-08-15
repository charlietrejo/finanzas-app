-- 017_idempotency_key.sql
-- Cierra WARNING #11: doble-submit / reintento de transacciones.
-- Agrega idempotencia a nivel de BD para createTransaction.
--
-- Diseño:
--   * Columna idempotency_key uuid (nullable).
--   * Unique compuesto (user_id, idempotency_key) SOLO cuando la key no es NULL
--     (índice parcial). Esto:
--       - permite múltiples NULL => transacciones históricas intactas;
--       - aísla por usuario: A y B pueden reusar la misma key sin conflicto,
--         y B no puede recuperar la transacción de A usando su propia key;
--       - la restricción UNIQUE de Postgres es la autoridad final contra
--         carreras (no depende de SELECT-then-INSERT).
--
-- El flujo en createTransaction (finance.ts):
--   INSERT con idempotency_key.
--   Si hay conflicto UNIQUE (23505), se recupera la fila existente y se
--   devuelve SIN volver a ejecutar applyTransactionEffect().

alter table public.transactions
  add column if not exists idempotency_key uuid;

drop index if exists transactions_idempotency_key_idx;
create unique index transactions_idempotency_key_idx
  on public.transactions (user_id, idempotency_key)
  where idempotency_key is not null;
