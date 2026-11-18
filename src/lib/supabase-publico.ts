/**
 * VOZ CABALLA · lib/supabase-publico.ts
 * Lectura de testimonios PUBLICADOS desde el servidor (páginas con renderizado en servidor).
 * Usa solo la clave pública: la base de datos solo deja ver lo publicado y sus campos seguros.
 */
import { createClient } from '@supabase/supabase-js';
import type { ArchivoPublico, TestimonioPublico } from './testimonios';

const URL = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.PUBLIC_SUPABASE_KEY as string | undefined;

function cliente() {
  if (!URL || !KEY) throw new Error('Falta PUBLIC_SUPABASE_URL o PUBLIC_SUPABASE_KEY en el archivo .env');
  return createClient(URL, KEY, { auth: { persistSession: false } });
}

export interface ResultadoBusqueda {
  items: TestimonioPublico[];
  total: number;
}

/** Busca testimonios publicados (más recientes primero). */
export async function buscarTestimonios(opciones: {
  q?: string;
  categoria?: string;
  desde?: number;
  limite?: number;
}): Promise<ResultadoBusqueda> {
  const { data, error } = await cliente().rpc('buscar_testimonios', {
    p_q: opciones.q?.trim() || null,
    p_categoria: opciones.categoria || null,
    p_desde: opciones.desde ?? 0,
    p_limite: opciones.limite ?? 12,
  });
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as (TestimonioPublico & { total: number })[];
  return { items: filas, total: filas.length ? Number(filas[0].total) : 0 };
}

export async function obtenerTestimonio(numero: number): Promise<TestimonioPublico | null> {
  const { data, error } = await cliente()
    .from('testimonios_publicos')
    .select('*')
    .eq('numero_publico', numero)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TestimonioPublico | null) ?? null;
}

export async function archivosDelTestimonio(testimonioId: string): Promise<ArchivoPublico[]> {
  const { data, error } = await cliente()
    .from('archivos_publicos')
    .select('id, ruta_publica, tipo_mime')
    .eq('testimonio_id', testimonioId);
  if (error) throw new Error(error.message);
  return (data ?? []) as ArchivoPublico[];
}

/** Número de testimonios publicados (el contador de «voces»). */
export async function contarPublicados(): Promise<number> {
  const { count, error } = await cliente()
    .from('testimonios_publicos')
    .select('id', { count: 'exact', head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Dirección pública de un archivo aprobado. */
export function urlArchivoPublico(ruta: string): string {
  return `${URL}/storage/v1/object/public/documentos-publicos/${ruta}`;
}

/** Dirección de la imagen de vista previa de un testimonio (la crea el panel al publicar). */
export function urlImagenCompartir(numero: number, version: string): string {
  const nombre = String(numero).padStart(3, '0');
  return `${URL}/storage/v1/object/public/imagenes-compartir/og/${nombre}.png?v=${encodeURIComponent(version)}`;
}

/** ¿Existe esa imagen? (por si un testimonio se publicó sin generarla). */
export async function existeImagen(direccion: string): Promise<boolean> {
  try {
    const r = await fetch(direccion, { method: 'HEAD', signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}
