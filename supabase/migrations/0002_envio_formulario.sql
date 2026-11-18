-- =====================================================================
-- VOZ CABALLA · Migración 0002 · Envío del formulario
-- Ejecutar UNA sola vez en el SQL Editor de Supabase (después de la 0001).
-- Qué hace:
--   1. Ajusta los límites a tu diseño: testimonio 400, consecuencias 160.
--   2. Quita la casilla de veracidad de las obligatorias (ya no está en el formulario).
--   3. Añade columnas para las alertas automáticas y para detectar duplicados.
--   4. Crea la tabla que cuenta los envíos por persona (límite diario).
-- =====================================================================

-- 1. Límites de texto
alter table public.testimonios drop constraint testimonios_texto_valido;
alter table public.testimonios add constraint testimonios_texto_valido
  check (char_length(btrim(testimonio)) between 1 and 400);

alter table public.testimonios drop constraint testimonios_consecuencias_validas;
alter table public.testimonios add constraint testimonios_consecuencias_validas
  check (char_length(btrim(consecuencias)) between 1 and 160);

-- 2. Consentimientos: obligatorias solo publicación y privacidad.
--    (El derecho a aportar archivos lo exige la función de envío cuando hay archivos.)
alter table public.consentimientos drop constraint consentimientos_obligatorios;
alter table public.consentimientos alter column acepta_veracidad set default false;
alter table public.consentimientos add constraint consentimientos_obligatorios
  check (acepta_publicacion and acepta_privacidad);

-- 3. Alertas automáticas y huella del texto (detección de duplicados)
alter table public.testimonios
  add column alertas text[] not null default '{}',
  add column texto_hash text;

create index testimonios_texto_hash_idx on public.testimonios (texto_hash);

-- 4. Límite de envíos por persona (solo accesible desde la función de envío)
create table public.envios_limite (
  id        bigint generated always as identity primary key,
  ip_hash   text not null,
  creado_en timestamptz not null default now()
);

create index envios_limite_idx on public.envios_limite (ip_hash, creado_en);

alter table public.envios_limite enable row level security;
revoke all on public.envios_limite from anon, authenticated;
