/**
 * VOZ CABALLA · Edge Function «enviar-testimonio»
 *
 * Recibe el formulario de Exprésate y lo guarda como «recibido» (pendiente de revisión).
 * Pasos, en este orden:
 *   1. Comprueba el origen (solo tu web) y valida los datos.
 *   2. Capa 1 antitroleo: campo trampa, tiempo mínimo, captcha y límite diario por persona.
 *   3. Capa 2: sin enlaces, sin duplicados; marca datos personales, insultos y temas sensibles.
 *   4. Guarda testimonio, consentimientos y archivos declarados.
 *   5. Devuelve direcciones firmadas para que el navegador suba los archivos directamente
 *      al almacenamiento PRIVADO (así no pasan por esta función ni hay límites de tamaño aquí).
 *
 * Secretos necesarios (se configuran con `supabase secrets set`):
 *   TURNSTILE_SECRET   clave secreta de Cloudflare Turnstile
 *   HASH_SECRET        texto aleatorio largo, para anonimizar las IP con hash
 *   ALLOWED_ORIGINS    webs autorizadas separadas por comas (p. ej. http://localhost:4321)
 * Los de Supabase (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) los pone Supabase solo.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  REGLAS,
  TIPOS_ARCHIVO,
  analizarTexto,
  proponerFrase,
  textoParaHash,
  validar,
} from './logica.ts';

const MAX_ENVIOS_POR_DIA = 3;

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------

function origenesPermitidos(): string[] {
  return (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:4321')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

function cabeceras(origen: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origen,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

function responder(cuerpo: unknown, estado: number, origen: string): Response {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: cabeceras(origen) });
}

function obtenerIp(req: Request): string | null {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null
  );
}

async function hex(buffer: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Hash con clave secreta: no se puede deshacer ni cotejar sin el secreto. */
async function hashConSecreto(valor: string): Promise<string> {
  const secreto = Deno.env.get('HASH_SECRET') ?? '';
  const clave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return hex(await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(valor)));
}

async function sha256(valor: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(valor)));
}


/** Pregunta a Cloudflare si el captcha es válido. Si algo falla, se rechaza (falla cerrado). */
async function captchaValido(token: string, ip: string | null): Promise<boolean> {
  const secreto = Deno.env.get('TURNSTILE_SECRET');
  if (!secreto || !token) return false;

  const datos = new URLSearchParams({
    secret: secreto,
    response: token,
  });

  if (ip) datos.set('remoteip', ip);

  try {
    const r = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        body: datos,
      },
    );

    if (!r.ok) return false;

    const j = await r.json();

    const dominiosPermitidos = [
      'localhost',
      'vozcaballa.com',
      'www.vozcaballa.com',
    ];

    return (
      j.success === true &&
      dominiosPermitidos.includes(j.hostname)
    );
  } catch {
    return false;
  }
}


// ---------------------------------------------------------------------
// Servidor
// ---------------------------------------------------------------------

Deno.serve(async (req) => {
  const origen = req.headers.get('origin') ?? '';
  const permitidos = origenesPermitidos();

  if (!permitidos.includes(origen)) {
    return new Response(JSON.stringify({ ok: false, error: 'Origen no autorizado.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cabeceras(origen) });
  if (req.method !== 'POST') return responder({ ok: false, error: 'Método no permitido.' }, 405, origen);

  // 1. Leer y validar
  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return responder({ ok: false, error: 'Datos no válidos.' }, 400, origen);
  }

  // Campo trampa: los robots lo rellenan. Se finge éxito para no darles pistas.
  const trampa = (cuerpo as { sitio_web?: unknown })?.sitio_web;
  if (typeof trampa === 'string' && trampa.trim() !== '') {
    return responder({ ok: true, subidas: [] }, 200, origen);
  }

  const v = validar(cuerpo);
  if (!v.ok) return responder({ ok: false, error: v.error, campo: v.campo }, 400, origen);
  const d = v.datos;

  // 2. Capa 1: tiempo mínimo, captcha y límite diario
  if (d.tiempoMs < REGLAS.tiempoMinimoMs) {
    return responder(
      { ok: false, error: 'Has enviado el formulario demasiado rápido. Revísalo e inténtalo de nuevo.' },
      400,
      origen,
    );
  }

  const ip = obtenerIp(req);
  if (!(await captchaValido(d.captcha, ip))) {
    return responder(
      { ok: false, error: 'No hemos podido comprobar que eres una persona. Inténtalo de nuevo.' },
      403,
      origen,
    );
  }

  const ipHash = ip ? await hashConSecreto(ip) : 'desconocida';
  const hace24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count: envios } = await admin
    .from('envios_limite')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('creado_en', hace24h);
  if ((envios ?? 0) >= MAX_ENVIOS_POR_DIA) {
    return responder(
      { ok: false, error: 'Has alcanzado el máximo de envíos por hoy. Vuelve a intentarlo mañana.' },
      429,
      origen,
    );
  }

  // 3. Capa 2: duplicados y análisis del texto
  const textoHash = await sha256(textoParaHash(d.testimonio));
  const { count: repetidos } = await admin
    .from('testimonios')
    .select('id', { count: 'exact', head: true })
    .eq('texto_hash', textoHash);
  if ((repetidos ?? 0) > 0) {
    return responder({ ok: false, error: 'Este testimonio ya se había recibido.' }, 409, origen);
  }

  const { alertas, sensible } = analizarTexto(d.testimonio, d.consecuencias);

  // 4. Guardar
  const { data: fila, error: errorTestimonio } = await admin
    .from('testimonios')
    .insert({
      categoria: d.categoria,
      categoria_otra: d.categoriaOtra,
      es_anonimo: d.anonimo,
      nombre_publico: d.nombrePublico,
      contacto: d.contacto,
      testimonio: d.testimonio,
      consecuencias: d.consecuencias,
      frase_destacada: proponerFrase(d.testimonio),
      contenido_sensible: sensible,
      alertas,
      texto_hash: textoHash,
      ip_hash: ipHash,
      pais_ip: req.headers.get('cf-ipcountry'),
    })
    .select('id')
    .single();

  if (errorTestimonio || !fila) {
    console.error('Error al guardar el testimonio:', errorTestimonio);
    return responder({ ok: false, error: 'No hemos podido guardar tu testimonio. Inténtalo de nuevo.' }, 500, origen);
  }

  const deshacer = async () => {
    await admin.from('testimonios').delete().eq('id', fila.id); // borra también consentimientos y archivos
  };

  const { error: errorConsentimiento } = await admin.from('consentimientos').insert({
    testimonio_id: fila.id,
    acepta_publicacion: true,
    acepta_privacidad: true,
    acepta_derecho_documentos: d.aceptaDerechoDocumentos,
    acepta_entrevista_difusion: false,
    version_politica: 'pendiente-de-redactar',
  });
  if (errorConsentimiento) {
    console.error('Error al guardar el consentimiento:', errorConsentimiento);
    await deshacer();
    return responder({ ok: false, error: 'No hemos podido guardar tu testimonio. Inténtalo de nuevo.' }, 500, origen);
  }

  // 5. Archivos: se registran y se devuelven direcciones firmadas para subirlos
  const subidas: { indice: number; ruta: string; token: string }[] = [];
  for (let i = 0; i < d.archivos.length; i++) {
    const a = d.archivos[i];
    const ruta = `${fila.id}/${crypto.randomUUID()}.${TIPOS_ARCHIVO[a.tipo]}`;

    const { error: errorArchivo } = await admin.from('archivos').insert({
      testimonio_id: fila.id,
      ruta_privada: ruta,
      nombre_original: a.nombre,
      tipo_mime: a.tipo,
      tamano_bytes: a.tamano,
    });
    const { data: firmada, error: errorFirma } = await admin.storage
      .from('documentos-privados')
      .createSignedUploadUrl(ruta);

    if (errorArchivo || errorFirma || !firmada) {
      console.error('Error al preparar un archivo:', errorArchivo ?? errorFirma);
      await deshacer();
      return responder({ ok: false, error: 'No hemos podido preparar los archivos. Inténtalo de nuevo.' }, 500, origen);
    }
    subidas.push({ indice: i, ruta, token: firmada.token });
  }

  // Cuenta este envío y limpia registros antiguos
  await admin.from('envios_limite').insert({ ip_hash: ipHash });
  await admin
    .from('envios_limite')
    .delete()
    .lt('creado_en', new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString());

  return responder({ ok: true, subidas }, 200, origen);
});
