/**
 * VOZ CABALLA · lib/contadores.ts
 * Lógica de los contadores. La usan tanto el servidor (valor inicial)
 * como el navegador (actualización en directo).
 */

/** Día 1 del contador: 29 de julio de 2026. */
export const FECHA_INICIO = { year: 2026, month: 7, day: 29 };

/** Ceuta usa la hora de Madrid: el contador cambia a medianoche en esa zona. */
export const ZONA_HORARIA = 'Europe/Madrid';

/** Fecha de hoy (año, mes, día) en Ceuta, sin depender de la hora del dispositivo. */
function fechaEnCeuta(ahora: Date): { year: number; month: number; day: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ahora);
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
  return { year: valor('year'), month: valor('month'), day: valor('day') };
}

/**
 * Días transcurridos contando el 29 de julio como día 1.
 * Ejemplo: el 11 de noviembre de 2026 devuelve 106.
 */
export function diasTranscurridos(ahora: Date = new Date()): number {
  const hoy = fechaEnCeuta(ahora);
  const msHoy = Date.UTC(hoy.year, hoy.month - 1, hoy.day);
  const msInicio = Date.UTC(FECHA_INICIO.year, FECHA_INICIO.month - 1, FECHA_INICIO.day);
  const dias = Math.floor((msHoy - msInicio) / 86_400_000) + 1;
  return Math.max(0, dias);
}

export function etiquetaDias(n: number): string {
  return n === 1 ? 'DÍA' : 'DÍAS';
}

export function etiquetaVoces(n: number): string {
  return n === 1 ? 'VOZ' : 'VOCES';
}
