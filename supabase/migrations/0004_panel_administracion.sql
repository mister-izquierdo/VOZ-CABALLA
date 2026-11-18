-- =====================================================================
-- VOZ CABALLA · Migración 0004 · Panel de administración
-- Ejecutar UNA sola vez en el SQL Editor de Supabase (después de la 0003).
-- Qué hace:
--   1. Obliga a usar la verificación en dos pasos (MFA) para todo lo de administración.
--   2. Añade una función para saber si alguien es administrador antes de pasar el MFA.
--   3. Permite a la administración añadir archivos (por ejemplo vídeos) a un testimonio.
--   4. Crea el almacenamiento público de las imágenes de vista previa.
--
-- SALIDA DE EMERGENCIA, si te quedas sin acceso por el MFA: ejecuta esto, entra,
-- y vuelve a ejecutar esta migración (solo la parte 1):
--   create or replace function public.es_admin() returns boolean language sql security definer stable
--   set search_path = public as $$ select exists (select 1 from public.administradores where user_id = (select auth.uid())) $$;
-- =====================================================================

-- 1. es_admin() exige sesión con verificación en dos pasos (aal2)
create or replace function public.es_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.administradores where user_id = (select auth.uid())
  )
  and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2';
$$;

-- 2. ¿Está en la lista de administradores? (sin exigir todavía el MFA; el panel lo usa para guiar el acceso)
create or replace function public.es_admin_sin_mfa()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.administradores where user_id = (select auth.uid())
  );
$$;

revoke execute on function public.es_admin_sin_mfa() from public, anon;
grant execute on function public.es_admin_sin_mfa() to authenticated;

-- 3. La administración puede añadir archivos a un testimonio
grant insert on public.archivos to authenticated;

-- 4. Imágenes de vista previa de los enlaces (públicas; solo la administración las escribe)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagenes-compartir', 'imagenes-compartir', true, 3145728, array['image/png'])
on conflict (id) do nothing;

create policy "admin gestiona imagenes compartir" on storage.objects
  for all to authenticated
  using (bucket_id = 'imagenes-compartir' and public.es_admin())
  with check (bucket_id = 'imagenes-compartir' and public.es_admin());
