/**
 * VOZ CABALLA · pages/api/testimonios.ts
 * Devuelve fichas de la lista (HTML ya preparado) para «Ver más testimonios» y la búsqueda en vivo.
 * Ejemplo: /api/testimonios?q=ventas&categoria=economicos&pagina=2
 */
import type { APIRoute } from 'astro';
import { CATEGORIAS } from '../../lib/categorias';
import { listaHtml } from '../../lib/plantillas';
import { SITIO } from '../../lib/sitio';
import { buscarTestimonios } from '../../lib/supabase-publico';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const q = (url.searchParams.get('q') ?? '').slice(0, 80).trim();
  const categoria = url.searchParams.get('categoria') ?? '';
  const pagina = Math.min(200, Math.max(1, Number.parseInt(url.searchParams.get('pagina') ?? '1', 10) || 1));
  const categoriaValida = CATEGORIAS.some((c) => c.valor === categoria) ? categoria : '';

  try {
    const { items, total } = await buscarTestimonios({
      q,
      categoria: categoriaValida,
      desde: (pagina - 1) * SITIO.porPagina,
      limite: SITIO.porPagina,
    });
    const hayMas = pagina * SITIO.porPagina < total;
    return new Response(JSON.stringify({ html: listaHtml(items), hayMas, siguiente: pagina + 1, total }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=30' },
    });
  } catch (error) {
    console.error('Error al buscar testimonios:', error);
    return new Response(JSON.stringify({ error: 'No hemos podido cargar los testimonios.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
};
