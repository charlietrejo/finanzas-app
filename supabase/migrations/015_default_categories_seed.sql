-- Sección 3.8 del doc de requerimientos ("Categorías por defecto"): precarga
-- categorías de ingreso/gasto para que el usuario no arranque con la lista
-- vacía. Se aplica (1) retroactivamente a usuarios ya existentes y (2) hacia
-- adelante vía un trigger en cada alta nueva en auth.users. Es idempotente:
-- solo inserta las que falten por (user_id, name, type), así que no duplica
-- nada si el usuario ya creó manualmente una categoría con el mismo nombre.

create or replace function seed_default_categories(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into categories (user_id, name, type)
  select p_user_id, d.name, d.type
  from (values
    ('Nómina/Salario', 'income'),
    ('Freelance/Negocio propio', 'income'),
    ('Reembolsos', 'income'),
    ('Otros ingresos', 'income'),
    ('Comida y supermercado', 'expense'),
    ('Restaurantes y antojos', 'expense'),
    ('Transporte', 'expense'),
    ('Vivienda (renta/hipoteca)', 'expense'),
    ('Servicios (luz, agua, gas, internet)', 'expense'),
    ('Salud', 'expense'),
    ('Entretenimiento', 'expense'),
    ('Ropa y accesorios', 'expense'),
    ('Educación', 'expense'),
    ('Suscripciones', 'expense'),
    ('Pago de tarjetas/deudas', 'expense'),
    ('Ahorro e inversión', 'expense'),
    ('Mascotas', 'expense'),
    ('Regalos y donaciones', 'expense'),
    ('Otros gastos', 'expense')
  ) as d(name, type)
  where not exists (
    select 1 from categories c
    where c.user_id = p_user_id and c.name = d.name and c.type = d.type
  );
end;
$$;

-- Trigger: cada usuario nuevo recibe las categorías por defecto al registrarse.
create or replace function handle_new_user_default_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform seed_default_categories(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_seed_categories on auth.users;
create trigger on_auth_user_created_seed_categories
  after insert on auth.users
  for each row execute function handle_new_user_default_categories();

-- Backfill: usuarios que ya existen hoy (incluye al usuario real de la app)
-- y todavía no tienen estas categorías.
do $$
declare
  u record;
begin
  for u in select id from auth.users loop
    perform seed_default_categories(u.id);
  end loop;
end $$;
