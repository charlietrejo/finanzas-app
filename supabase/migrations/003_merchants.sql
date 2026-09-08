-- Catálogo compartido de comercios (México). No tiene user_id: es de solo lectura
-- para todos los usuarios autenticados, usado para autocompletar y sugerir categoría.
-- default_category_name es texto libre (no FK a categories.id) porque categories
-- es una tabla por-usuario y este catálogo es global.
create table if not exists merchants (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_category_name text,
  created_at timestamptz not null default now()
);

alter table merchants enable row level security;

create policy "merchants_select_authenticated" on merchants for select
  to authenticated
  using (true);

insert into merchants (name, default_category_name) values
  ('Walmart', 'Supermercado'),
  ('Soriana', 'Supermercado'),
  ('Chedraui', 'Supermercado'),
  ('La Comer', 'Supermercado'),
  ('Bodega Aurrerá', 'Supermercado'),
  ('Oxxo', 'Conveniencia'),
  ('7-Eleven', 'Conveniencia'),
  ('Extra', 'Conveniencia'),
  ('Farmacias del Ahorro', 'Salud'),
  ('Farmacias Guadalajara', 'Salud'),
  ('Similares', 'Salud'),
  ('Rappi', 'Restaurantes'),
  ('Uber Eats', 'Restaurantes'),
  ('Didi Food', 'Restaurantes'),
  ('Uber', 'Transporte'),
  ('Didi', 'Transporte'),
  ('Metro/Metrobús', 'Transporte'),
  ('Netflix', 'Suscripciones'),
  ('Spotify', 'Suscripciones'),
  ('Disney+', 'Suscripciones'),
  ('Amazon Prime', 'Suscripciones'),
  ('Telcel', 'Telecomunicaciones'),
  ('AT&T México', 'Telecomunicaciones'),
  ('Movistar', 'Telecomunicaciones'),
  ('Izzi', 'Telecomunicaciones'),
  ('Totalplay', 'Telecomunicaciones')
on conflict (name) do nothing;
