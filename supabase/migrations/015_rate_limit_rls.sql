-- 015_rate_limit_rls.sql
-- Corrige M1 de la auditoría de seguridad pre-producción:
-- la tabla rate_limits era accesible directamente desde el cliente
-- autenticado (SELECT/INSERT eludían la RPC check_rate_limit), permitiendo
-- evadir el límite y filtrar metadatos de uso.
--
-- Modelo mínimo (tabla interna usada solo por la RPC SECURITY DEFINER):
--   1) Habilitar RLS para que, si hubiera acceso directo, quede acotado a
--      los registros propios (auth.uid() = user_id).
--   2) Revocar TODO acceso directo de los roles de cliente sobre la tabla.
--      La RPC check_rate_limit es SECURITY DEFINER (search_path=public) y se
--      ejecuta con los privilegios de su dueño, por lo que sigue funcionando
--      aunque el rol authenticated no tenga permisos directos sobre la tabla.
--   3) Conservar únicamente GRANT EXECUTE sobre la función para authenticated.

alter table public.rate_limits enable row level security;

-- Política defensiva: un usuario solo podría ver/modificar sus propias filas
-- en caso de que algún grant futuro lo permita. No abre acceso por sí sola.
drop policy if exists rate_limits_owner_select on public.rate_limits;
create policy rate_limits_owner_select
  on public.rate_limits
  for select
  using (auth.uid() = user_id);

drop policy if exists rate_limits_owner_delete on public.rate_limits;
create policy rate_limits_owner_delete
  on public.rate_limits
  for delete
  using (auth.uid() = user_id);

-- Revocar acceso directo de los roles de cliente sobre la tabla.
-- (La función check_rate_limit conserva su GRANT EXECUTE; al ser
--  SECURITY DEFINER no depende de estos privilegios de tabla.)
revoke all on public.rate_limits from anon;
revoke all on public.rate_limits from authenticated;
revoke all on public.rate_limits from public;

-- Reafirmar que solo la función es invocable por el cliente autenticado.
grant execute on function public.check_rate_limit(text, integer, integer) to authenticated;
