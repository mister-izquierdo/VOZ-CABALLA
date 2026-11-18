/**
 * VOZ CABALLA · lib/testimonios.ts
 * Tipos y funciones para mostrar testimonios (sin acceso a la base de datos).
 */
import { CATEGORIAS } from './categorias';

/** Una fila de la vista pública «testimonios_publicos». */
export interface TestimonioPublico {
  id: string;
  numero_publico: number;
  categoria: string;
  categoria_otra: string | null;
  nombre_publico: string;
  frase_destacada: string;
  testimonio: string;
  consecuencias: string;
  contenido_sensible: boolean;
  estado_documental: 'documentacion_revisada' | 'sin_documentacion';
  publicado_en: string;
}

export interface ArchivoPublico {
  id: string;
  ruta_publica: string;
  tipo_mime: string;
}

/** «#002» */
export function numeroTexto(n: number): string {
  return '#' + String(n).padStart(3, '0');
}

/** Ruta de la ficha individual: /testimonio/002 */
export function rutaFicha(n: number): string {
  return '/testimonio/' + String(n).padStart(3, '0');
}

/** Texto de la categoría. En «Otro» se usa la categoría que escribió la persona. */
export function etiquetaCategoria(valor: string, otra: string | null): string {
  if (valor === 'otro' && otra) return otra;
  return CATEGORIAS.find((c) => c.valor === valor)?.etiqueta ?? valor;
}

/** Nombre de la variable CSS con el color de la categoría. */
export function variableColor(valor: string): string {
  return CATEGORIAS.find((c) => c.valor === valor)?.colorVar ?? '--cat-otro';
}

const ZONA = 'Europe/Madrid';

/** 07/11/2026 */
export function fechaCorta(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(iso));
}

/** 7 de noviembre de 2026 */
export function fechaLarga(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: ZONA, day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(iso));
}

/** Recorta un texto en una palabra y añade «…». */
export function extracto(texto: string, max = 130): string {
  const limpio = texto.replace(/\s+/g, ' ').trim();
  if (limpio.length <= max) return limpio;
  const corte = limpio.slice(0, max);
  const espacio = corte.lastIndexOf(' ');
  return (espacio > max * 0.6 ? corte.slice(0, espacio) : corte).replace(/[,;:.\s]+$/, '') + '…';
}

/** Escapa texto para meterlo en HTML sin riesgo. */
export function esc(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
