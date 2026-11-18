-- =====================================================================
-- VOZ CABALLA · Migración 0003 · Lectura pública de testimonios
-- Ejecutar UNA sola vez en el SQL Editor de Supabase (después de la 0002).
-- Qué hace:
--   1. Crea la función de búsqueda que usa la página de Testimonios
--      (ignora tildes y mayúsculas, filtra por categoría y pagina).
--   2. Permite archivos de vídeo en los adjuntos públicos (los añade el administrador).
-- =====================================================================

-- 1. Búsqueda sin tildes
create extension if not exists unaccent with schema extensions;

create or replace function public.buscar_testimonios(
  p_q         text default null,
  p_categoria text default null,
  p_desde     integer default 0,
  p_limite    integer default 12
)
returns table (
  id uuid,
  numero_publico integer,
  categoria public.categoria_testimonio,
  categoria_otra text,
  nombre_publico text,
  frase_destacada text,
  testimonio text,
  consecuencias text,
  contenido_sensible boolean,
  estado_documental text,
  publicado_en timestamptz,
  total bigint
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select v.id, v.numero_publico, v.categoria, v.categoria_otra, v.nombre_publico,
         v.frase_destacada, v.testimonio, v.consecuencias, v.contenido_sensible,
         v.estado_documental, v.publicado_en,
         count(*) over () as total
  from public.testimonios_publicos v
  where (p_categoria is null or p_categoria = '' or v.categoria::text = p_categoria)
    and (
      p_q is null or btrim(p_q) = ''
      or unaccent(lower(concat_ws(' ', v.frase_destacada, v.testimonio, v.consecuencias, v.nombre_publico)))
         like '%' || unaccent(lower(
              replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_')
            )) || '%' escape '\'
    )
  order by v.publicado_en desc, v.numero_publico desc
  offset greatest(p_desde, 0)
  limit least(greatest(p_limite, 1), 50)
$$;

grant execute on function public.buscar_testimonios(text, text, integer, integer) to anon, authenticated;

-- 2. Vídeos en adjuntos (solo los puede crear la administración)
alter table public.archivos drop constraint archivos_tipo_valido;
alter table public.archivos add constraint archivos_tipo_valido
  check (tipo_mime in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4', 'video/webm'));

update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4', 'video/webm'],
       file_size_limit = 52428800  -- 50 MB
 where id = 'documentos-publicos';

-- Los vídeos pueden pesar más de 10 MB (solo los sube la administración)
alter table public.archivos drop constraint archivos_tamano_valido;
alter table public.archivos add constraint archivos_tamano_valido
  check (tamano_bytes > 0 and tamano_bytes <= 52428800);
