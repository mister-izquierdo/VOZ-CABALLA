/**
 * VOZ CABALLA · lib/voces.ts
 * Cuenta los testimonios publicados desde el navegador (contador de «voces»).
 * Pregunta solo cuántos hay (petición HEAD): no descarga ningún testimonio.
 */
const URL = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.PUBLIC_SUPABASE_KEY as string | undefined;
const CLAVE_CACHE = 'voces-contador';
const VIGENCIA_MS = 60_000;

/** Último valor conocido (guardado un minuto) para que el número no parpadee al cambiar de página. */
export function vocesEnCache(): number | null {
  try {
    const bruto = sessionStorage.getItem(CLAVE_CACHE);
    if (!bruto) return null;
    const { n, t } = JSON.parse(bruto) as { n: number; t: number };
    return Date.now() - t < VIGENCIA_MS ? n : null;
  } catch {
    return null;
  }
}

export async function contarVoces(): Promise<number | null> {
  if (!URL || !KEY) return null;
  try {
    const r = await fetch(`${URL}/rest/v1/testimonios_publicos?select=id`, {
      method: 'HEAD',
      headers: { apikey: KEY, Prefer: 'count=exact', Range: '0-0' },
    });
    if (!r.ok && r.status !== 206) return null;
    const total = r.headers.get('content-range')?.split('/')[1];
    const n = total && total !== '*' ? Number(total) : NaN;
    if (!Number.isFinite(n)) return null;
    try {
      sessionStorage.setItem(CLAVE_CACHE, JSON.stringify({ n, t: Date.now() }));
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
    return n;
  } catch {
    return null;
  }
}
