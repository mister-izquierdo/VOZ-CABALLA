import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

const SITE = 'https://vozcaballa.com';
const STATIC_PATHS = [
  '/',
  '/testimonios',
  '/expresate',
];

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export const GET: APIRoute = async () => {
  const urls: { loc: string; lastmod?: string }[] = STATIC_PATHS.map((path) => ({ loc: `${SITE}${path}` }));
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseKey = import.meta.env.PUBLIC_SUPABASE_KEY;

  // Include only public, published testimony pages. If Supabase is temporarily
  // unavailable, still return a valid sitemap for the core public pages.
  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
      const pageSize = 500;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase
          .from('testimonios_publicos')
          .select('numero_publico, publicado_en, contenido_sensible')
          .order('numero_publico', { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        for (const item of data ?? []) {
          if (item.contenido_sensible) continue;
          const number = Number(item.numero_publico);
          if (Number.isInteger(number) && number > 0) {
            const lastmod = item.publicado_en ? new Date(item.publicado_en).toISOString() : undefined;
            urls.push({ loc: `${SITE}/testimonio/${String(number).padStart(3, '0')}`, lastmod });
          }
        }
        if (!data || data.length < pageSize) break;
      }
    } catch (error) {
      console.error('No se pudieron incluir todos los testimonios en el sitemap:', error);
    }
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(({ loc, lastmod }) => `  <url><loc>${xmlEscape(loc)}</loc>${lastmod ? `<lastmod>${xmlEscape(lastmod)}</lastmod>` : ''}</url>`).join('\n') +
    `\n</urlset>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=300',
    },
  });
};
