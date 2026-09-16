-- Secciones 3.6/3.7/3.8 del doc: cada categoría de gasto se marca como
-- esencial o no, editable desde Cuenta > Categorías, y usada en Reportes
-- para "Gastos esenciales del mes".

alter table categories add column if not exists is_essential boolean not null default false;

-- Backfill de categorías ya existentes (usuarios de antes de esta migración):
-- los 5 defaults documentados en 3.8 se marcan esenciales por nombre; el
-- resto se queda en el default (false, ya aplicado por la columna nueva).
update categories set is_essential = true
where type = 'expense' and name in (
  'Vivienda (renta/hipoteca)',
  'Servicios (luz, agua, gas, internet)',
  'Salud',
  'Transporte',
  'Pago de tarjetas/deudas'
);

-- create or replace (no una migración nueva de la función, mismo patrón que
-- 021 con "Préstamo"): de aquí en adelante, todo usuario nuevo siembra sus
-- categorías ya con el is_essential correcto desde el principio.
create or replace function seed_default_categories(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into categories (user_id, name, type, is_essential)
  select p_user_id, d.name, d.type, d.is_essential
  from (values
    ('Nómina/Salario', 'income', false),
    ('Freelance/Negocio propio', 'income', false),
    ('Reembolsos', 'income', false),
    ('Otros ingresos', 'income', false),
    ('Vivienda (renta/hipoteca)', 'expense', true),
    ('Servicios (luz, agua, gas, internet)', 'expense', true),
    ('Salud', 'expense', true),
    ('Transporte', 'expense', true),
    ('Pago de tarjetas/deudas', 'expense', true),
    ('Comida y supermercado', 'expense', false),
    ('Restaurantes y antojos', 'expense', false),
    ('Entretenimiento', 'expense', false),
    ('Ropa y accesorios', 'expense', false),
    ('Educación', 'expense', false),
    ('Suscripciones', 'expense', false),
    ('Ahorro e inversión', 'expense', false),
    ('Mascotas', 'expense', false),
    ('Regalos y donaciones', 'expense', false),
    ('Préstamo', 'expense', false),
    ('Otros gastos', 'expense', false)
  ) as d(name, type, is_essential)
  where not exists (
    select 1 from categories c
    where c.user_id = p_user_id and c.name = d.name and c.type = d.type
  );
end;
$$;
