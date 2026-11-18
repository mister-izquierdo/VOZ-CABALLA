/**
 * VOZ CABALLA · lib/plantillas.ts
 * Genera el HTML de las fichas de la lista. Lo usan la página de Testimonios y el
 * endpoint que carga más fichas, así las dos salen siempre idénticas.
 * Todo el texto de las personas pasa por esc() para que nunca se pueda inyectar código.
 */
import {
  type TestimonioPublico,
  esc, etiquetaCategoria, extracto, fechaCorta, numeroTexto, rutaFicha, variableColor,
} from './testimonios';

/** Avión de papel de tu diseño (vectorizado). El dibujo está definido una vez en Layout.astro. */
export const ICONO_COMPARTIR = `<svg class="icono-compartir" viewBox="0 0 96.40 88.10" aria-hidden="true" focusable="false"><use href="#icono-avion"></use></svg>`;

/** Atributos data-* que necesita el panel de compartir para generar la imagen y los enlaces. */
export function atributosCompartir(t: TestimonioPublico, imagenes: string[] = []): string {
  const sensible = t.contenido_sensible;
  const datos: Record<string, string> = {
    numero: numeroTexto(t.numero_publico),
    url: rutaFicha(t.numero_publico),
    fecha: fechaCorta(t.publicado_en),
    categoria: etiquetaCategoria(t.categoria, t.categoria_otra),
    color: variableColor(t.categoria),
    autor: t.nombre_publico,
    // En contenido sensible no se incluye el texto en ningún sitio de la lista
    frase: sensible ? '' : t.frase_destacada,
    texto: sensible ? '' : t.testimonio,
    sensible: sensible ? 'si' : 'no',
    documentacion: t.estado_documental,
  };
  if (imagenes.length) datos.imagenes = JSON.stringify(imagenes);
  return Object.entries(datos).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
}

export function botonCompartirHtml(t: TestimonioPublico, imagenes: string[] = []): string {
  const num = numeroTexto(t.numero_publico);
  return `<button type="button" class="btn-compartir" data-compartir aria-label="Compartir testimonio ${esc(num)}" ${atributosCompartir(t, imagenes)}>${ICONO_COMPARTIR}</button>`;
}

/** Ficha resumida de la lista. */
export function tarjetaHtml(t: TestimonioPublico): string {
  const num = numeroTexto(t.numero_publico);
  const etiqueta = etiquetaCategoria(t.categoria, t.categoria_otra);
  const sensible = t.contenido_sensible;

  const etiquetas =
    `<span class="etiqueta etiqueta--cat" style="--cat: var(${esc(variableColor(t.categoria))})">${esc(etiqueta)}</span>` +
    (sensible ? `<span class="etiqueta etiqueta--sensible">Contenido sensible</span>` : '');

  const titulo = sensible ? 'Contenido sensible' : t.frase_destacada;
  const cuerpo = sensible
    ? 'Este testimonio contiene contenido sensible. Ábrelo con precaución.'
    : extracto(t.testimonio, 110);

  return `<article class="tarjeta" data-numero="${esc(String(t.numero_publico))}">
  <div class="tarjeta__cabecera">
    <p class="tarjeta__meta">${esc(num)} · ${esc(fechaCorta(t.publicado_en))}</p>
    ${botonCompartirHtml(t)}
  </div>
  <p class="tarjeta__etiquetas">${etiquetas}</p>
  <h2 class="tarjeta__frase"><a class="tarjeta__enlace" href="${rutaFicha(t.numero_publico)}">${esc(titulo)}</a></h2>
  <p class="tarjeta__autor">${esc(t.nombre_publico)}</p>
  <p class="tarjeta__extracto">${esc(cuerpo)} <span class="tarjeta__mas">más</span></p>
</article>`;
}

export function listaHtml(items: TestimonioPublico[]): string {
  return items.map(tarjetaHtml).join('\n');
}
