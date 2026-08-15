-- 014_rate_limit.sql
-- Rate limiting distribuido para operaciones autenticadas, SIN servicios
-- externos (Redis/KV). Vive en Postgres y usa auth.uid() como identidad,
-- por lo que es seguro en despliegues con múltiples instancias.
--
-- Diseño:
--   * Una fila por (user_id, bucket) con ventana deslizante simple.
--   * check_rate_limit() incrementa el contador atómicamente dentro de una
--     transacción SQL y lanza excepción si supera el máximo.
--   * La app llama a esta RPC al inicio de cada operación de escritura
--     sensible (transacciones, cuentas, deudas).

create table if not exists public.rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null default now(),
  hits integer not null default 1,
  primary key (user_id, bucket)
);

-- Limpieza opcional de ventanas viejas (no bloquea la lógica).
create index if not exists rate_limits_window_idx
  on public.rate_limits (window_start);

-- Función que valida y registra el intento. Devuelve void; lanza excepción
-- si se supera el límite. Todo en una transacción SQL atómica.
create or replace function public.check_rate_limit(
  p_bucket text,
  p_max integer,
  p_window_seconds integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_window interval := (p_window_seconds || ' seconds')::interval;
begin
  if v_uid is null then
    raise exception 'No hay una sesión activa.';
  end if;

  if p_max is null or p_max <= 0 then
    raise exception 'Configuración de rate limit inválida.';
  end if;

  -- Upsert atómico: si la ventana expiró, reinicia el contador; si no,
  -- lo incrementa. El lock de la fila evita condiciones de carrera.
  insert into public.rate_limits (user_id, bucket, window_start, hits)
  values (v_uid, p_bucket, v_now, 1)
  on conflict (user_id, bucket) do update
    set hits = case
                 when rate_limits.window_start < v_now - v_window
                   then 1
                 else rate_limits.hits + 1
               end,
        window_start = case
                         when rate_limits.window_start < v_now - v_window
                           then v_now
                         else rate_limits.window_start
                       end;

  -- Verificar después del upsert (la fila ya está actualizada).
  if (select hits from public.rate_limits
        where user_id = v_uid and bucket = p_bucket) > p_max then
    raise exception 'Has realizado demasiadas operaciones. Inténtalo de nuevo más tarde.';
  end if;
end;
$$;

-- Solo usuarios autenticados pueden invocarla (respeta auth.uid()).
revoke execute on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer) to authenticated;
