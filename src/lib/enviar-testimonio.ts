/**
 * VOZ CABALLA · lib/enviar-testimonio.ts
 * Envía el testimonio a la función de Supabase y sube los archivos al almacenamiento privado.
 *
 * Flujo:
 *  1. POST con los datos (y la lista de archivos, sin su contenido) a la función «enviar-testimonio».
 *  2. La función guarda el testimonio y devuelve direcciones firmadas para cada archivo.
 *  3. Este código sube cada archivo directamente a Supabase Storage con esa dirección.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.PUBLIC_SUPABASE_KEY as string | undefined;

export interface DatosEnvio {
  anonimo: boolean;
  nombre: string;
  apellidos: string;
  contacto: string;
  categoria: string;
  categoria_otra: string;
  testimonio: string;
  consecuencias: string;
  acepta_publicacion: boolean;
  acepta_privacidad: boolean;
  acepta_derecho_documentos: boolean;
  sitio_web: string; // campo trampa
  tiempo_ms: number;
  captcha: string;
}

export type ResultadoEnvio =
  | { ok: true; fallosSubida: string[] }
  | { ok: false; error: string; campo?: string };

/** ¿Están configuradas las direcciones y claves en el archivo .env? */
export function envioConfigurado(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

export async function enviarTestimonio(
  datos: DatosEnvio,
  archivos: File[],
  alProgreso?: (subidos: number, total: number) => void,
): Promise<ResultadoEnvio> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { ok: false, error: 'El envío todavía no está configurado en esta web.' };
  }

  // 1. Datos del testimonio
  const control = new AbortController();
  const limite = window.setTimeout(() => control.abort(), 30_000);
  let respuesta: Response;
  try {
    respuesta = await fetch(`${SUPABASE_URL}/functions/v1/enviar-testimonio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...datos,
        archivos: archivos.map((f) => ({ nombre: f.name, tipo: f.type, tamano: f.size })),
      }),
      signal: control.signal,
    });
  } catch {
    return { ok: false, error: 'No hemos podido conectar. Revisa tu conexión e inténtalo de nuevo.' };
  } finally {
    window.clearTimeout(limite);
  }

  let cuerpo: { ok?: boolean; error?: string; campo?: string; subidas?: { indice: number; ruta: string; token: string }[] };
  try {
    cuerpo = await respuesta.json();
  } catch {
    return { ok: false, error: 'Respuesta inesperada del servidor. Inténtalo de nuevo.' };
  }
  if (!respuesta.ok || !cuerpo.ok) {
    return { ok: false, error: cuerpo.error ?? 'No se pudo enviar el testimonio.', campo: cuerpo.campo };
  }

  // 2. Archivos (si los hay)
  const subidas = cuerpo.subidas ?? [];
  const fallos: string[] = [];
  if (subidas.length > 0) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
    let hechos = 0;
    for (const s of subidas) {
      const archivo = archivos[s.indice];
      const { error } = await supabase.storage
        .from('documentos-privados')
        .uploadToSignedUrl(s.ruta, s.token, archivo, { contentType: archivo.type });
      if (error) fallos.push(archivo.name);
      hechos++;
      alProgreso?.(hechos, subidas.length);
    }
  }

  return { ok: true, fallosSubida: fallos };
}
