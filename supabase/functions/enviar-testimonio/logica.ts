/**
 * VOZ CABALLA · enviar-testimonio/logica.ts
 * Reglas de validación y detección. Son funciones puras (sin red ni base de datos),
 * así se pueden probar fácilmente.
 *
 * IMPORTANTE: los límites de REGLAS deben coincidir con src/lib/formulario-reglas.ts.
 * Si cambias uno, cambia el otro.
 */

export const REGLAS = {
  testimonioMax: 400,
  testimonioMin: 120,
  consecuenciasMax: 160,
  consecuenciasMin: 30,
  categoriaOtraMax: 23,
  nombreMax: 60,
  apellidosMax: 80,
  contactoMax: 200,
  archivosMax: 5,
  archivoMaxBytes: 10 * 1024 * 1024,
  /** Tiempo mínimo para rellenar el formulario (milisegundos). Menos que esto = robot. */
  tiempoMinimoMs: 8000,
};

/** Categorías válidas y si permiten adjuntar archivos. */
export const CATEGORIAS: Record<string, boolean> = {
  economicos: true,
  materiales: true,
  laborales: true,
  familiares: false,
  psicologicas: false,
  inseguridad_violencia: true,
  otro: true,
};

/** Formatos de archivo permitidos y su extensión. */
export const TIPOS_ARCHIVO: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export interface ArchivoDeclarado {
  nombre: string;
  tipo: string;
  tamano: number;
}

export interface DatosValidados {
  anonimo: boolean;
  nombrePublico: string;
  contacto: string;
  categoria: string;
  categoriaOtra: string | null;
  testimonio: string;
  consecuencias: string;
  archivos: ArchivoDeclarado[];
  aceptaDerechoDocumentos: boolean;
  tiempoMs: number;
  honeypot: string;
  captcha: string;
}

export type Resultado =
  | { ok: true; datos: DatosValidados }
  | { ok: false; error: string; campo?: string };

// ---------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------

/** Quita caracteres de control, unifica saltos de línea y recorta. */
export function limpiarTexto(valor: unknown): string {
  if (typeof valor !== 'string') return '';
  return valor
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

/** Para nombres y campos de una línea: además junta los espacios repetidos. */
export function limpiarLinea(valor: unknown): string {
  return limpiarTexto(valor).replace(/\s+/g, ' ');
}

/** Minúsculas y sin tildes, para comparar palabras. */
export function sinTildes(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Huella del texto para detectar el mismo mensaje enviado muchas veces. */
export function textoParaHash(texto: string): string {
  return sinTildes(texto).replace(/[^a-z0-9]/g, '');
}

function esCorreo(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

function esTelefono(v: string): boolean {
  if (!/^\+?[\d\s().-]+$/.test(v)) return false;
  const d = v.replace(/\D/g, '');
  return d.length >= 9 && d.length <= 15;
}

// ---------------------------------------------------------------------
// Detección en el texto del testimonio
// ---------------------------------------------------------------------

/** ¿Contiene enlaces? Los testimonios no deben llevar enlaces (se rechaza). */
export function contieneEnlace(texto: string): boolean {
  return /(https?:\/\/|www\.|\b[a-z0-9-]{2,}\.(com|es|net|org|info|io|me|ly|gl|xyz|top)\b)/i.test(texto);
}

/** Palabras que hacen saltar una alerta de contenido ofensivo (solo marca, no rechaza).
 *  Lista de partida: amplíala con las que veas pasar por el panel. */
const PALABRAS_OFENSIVAS = [
  'puta', 'puto', 'putas', 'putos', 'mierda', 'gilipollas', 'cabron', 'cabrones', 'imbecil',
  'subnormal', 'idiota', 'estupido', 'capullo', 'maricon', 'maricones', 'sudaca', 'negrata',
  'moraco', 'moracos', 'hdp',
];

/** Temas delicados: activan «contenido sensible» y la revisión reforzada. */
const TEMAS_SENSIBLES = [
  'violacion', 'violaron', 'violada', 'violado', 'agresion sexual', 'abuso sexual', 'abusaron',
  'acoso sexual', 'tocamientos', 'suicid', 'autolesion', 'quitarme la vida',
];

export interface Deteccion {
  alertas: string[];
  sensible: boolean;
}

export function analizarTexto(...textos: string[]): Deteccion {
  const junto = textos.join(' \n ');
  const norm = sinTildes(junto);
  const alertas: string[] = [];

  // Teléfonos, correos, DNI y matrículas (datos que hay que ocultar antes de publicar)
  const datoPersonal =
    /[^\s@]+@[^\s@]+\.[^\s@]{2,}/.test(junto) ||
    /(?<!\d)(?:\+?\d[\s.-]?){9,}(?!\d)/.test(junto) ||
    /\b\d{8}\s?-?\s?[a-z]\b/i.test(junto) ||
    /\b\d{4}\s?-?\s?[bcdfghjklmnprstvwxyz]{3}\b/i.test(junto) ||
    /\b[a-z]{1,2}\s?-?\s?\d{4}\s?-?\s?[a-z]{1,2}\b/i.test(junto);
  if (datoPersonal) alertas.push('dato_personal');

  const palabras = new Set(norm.split(/[^a-z0-9]+/).filter(Boolean));
  if (PALABRAS_OFENSIVAS.some((p) => palabras.has(p)) || /hijo(s)? de puta/.test(norm)) {
    alertas.push('ofensivo');
  }

  const letras = junto.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
  const mayus = junto.replace(/[^A-ZÁÉÍÓÚÜÑ]/g, '');
  if (letras.length > 40 && mayus.length / letras.length > 0.6) alertas.push('mayusculas');

  if (/(.)\1{5,}/.test(junto)) alertas.push('repeticion');

  const sensible = TEMAS_SENSIBLES.some((t) => norm.includes(t));
  if (sensible) alertas.push('sensible');

  return { alertas, sensible };
}

/** Frase destacada propuesta: la primera frase, de 90 caracteres como máximo. */
export function proponerFrase(texto: string, max = 90): string {
  const limpio = texto.replace(/\s+/g, ' ').trim();
  const primera = (limpio.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? limpio).replace(/[.]+$/, '').trim();
  if (primera.length <= max) return primera;
  const corte = primera.slice(0, max);
  const ultimoEspacio = corte.lastIndexOf(' ');
  return (ultimoEspacio > 40 ? corte.slice(0, ultimoEspacio) : corte).replace(/[,;:\s]+$/, '') + '…';
}

// ---------------------------------------------------------------------
// Validación de lo que llega del formulario
// ---------------------------------------------------------------------

export function validar(cuerpo: unknown): Resultado {
  if (typeof cuerpo !== 'object' || cuerpo === null) {
    return { ok: false, error: 'Datos no válidos.' };
  }
  const c = cuerpo as Record<string, unknown>;
  const fallo = (error: string, campo?: string): Resultado => ({ ok: false, error, campo });

  const anonimo = c.anonimo === true;
  const nombre = limpiarLinea(c.nombre).slice(0, REGLAS.nombreMax);
  const apellidos = limpiarLinea(c.apellidos).slice(0, REGLAS.apellidosMax);
  if (!anonimo && (nombre.length < 2 || apellidos.length < 2)) {
    return fallo('Escribe tu nombre y tus apellidos, o elige «Anónimo».', 'nombre');
  }

  const contacto = limpiarLinea(c.contacto);
  if (contacto.length > REGLAS.contactoMax || !(esCorreo(contacto) || esTelefono(contacto))) {
    return fallo('Escribe un correo o un teléfono de contacto válido.', 'contacto');
  }

  const categoria = typeof c.categoria === 'string' ? c.categoria : '';
  if (!(categoria in CATEGORIAS)) return fallo('Elige una categoría.', 'categoria');

  let categoriaOtra: string | null = null;
  if (categoria === 'otro') {
    categoriaOtra = limpiarLinea(c.categoria_otra);
    if (categoriaOtra.length < 1 || categoriaOtra.length > REGLAS.categoriaOtraMax) {
      return fallo(`Escribe la categoría (máximo ${REGLAS.categoriaOtraMax} caracteres).`, 'categoria_otra');
    }
  }

  const testimonio = limpiarTexto(c.testimonio);
  if (testimonio.length < REGLAS.testimonioMin || testimonio.length > REGLAS.testimonioMax) {
    return fallo(
      `El testimonio debe tener entre ${REGLAS.testimonioMin} y ${REGLAS.testimonioMax} caracteres.`,
      'testimonio',
    );
  }

  const consecuencias = limpiarTexto(c.consecuencias);
  if (consecuencias.length < REGLAS.consecuenciasMin || consecuencias.length > REGLAS.consecuenciasMax) {
    return fallo(
      `Las consecuencias deben tener entre ${REGLAS.consecuenciasMin} y ${REGLAS.consecuenciasMax} caracteres.`,
      'consecuencias',
    );
  }

  if (contieneEnlace(`${testimonio} ${consecuencias}`)) {
    return fallo('Por favor, no incluyas enlaces en tu testimonio.', 'testimonio');
  }

  // Archivos
  const lista = Array.isArray(c.archivos) ? c.archivos : [];
  if (lista.length > REGLAS.archivosMax) {
    return fallo(`Solo puedes adjuntar ${REGLAS.archivosMax} archivos.`, 'archivos');
  }
  if (lista.length > 0 && !CATEGORIAS[categoria]) {
    return fallo('En esta categoría no se pueden adjuntar archivos.', 'archivos');
  }
  const archivos: ArchivoDeclarado[] = [];
  for (const a of lista) {
    const x = (a ?? {}) as Record<string, unknown>;
    const tipo = typeof x.tipo === 'string' ? x.tipo : '';
    const tamano = typeof x.tamano === 'number' ? x.tamano : 0;
    if (!(tipo in TIPOS_ARCHIVO)) return fallo('Hay un archivo con un formato no admitido.', 'archivos');
    if (!Number.isFinite(tamano) || tamano <= 0 || tamano > REGLAS.archivoMaxBytes) {
      return fallo('Hay un archivo vacío o demasiado grande.', 'archivos');
    }
    archivos.push({ nombre: limpiarLinea(x.nombre).replace(/[\\/]/g, '_').slice(0, 120) || 'archivo', tipo, tamano });
  }

  // Consentimientos
  if (c.acepta_publicacion !== true || c.acepta_privacidad !== true) {
    return fallo('Debes aceptar la publicación y la política de privacidad.', 'consentimientos');
  }
  const aceptaDerecho = c.acepta_derecho_documentos === true;
  if (archivos.length > 0 && !aceptaDerecho) {
    return fallo('Debes confirmar que tienes derecho a aportar los archivos.', 'consentimientos');
  }

  const nombrePublico = anonimo ? 'Anónimo' : `${nombre} ${apellidos}`.slice(0, 120);

  return {
    ok: true,
    datos: {
      anonimo,
      nombrePublico,
      contacto,
      categoria,
      categoriaOtra,
      testimonio,
      consecuencias,
      archivos,
      aceptaDerechoDocumentos: aceptaDerecho,
      tiempoMs: typeof c.tiempo_ms === 'number' ? c.tiempo_ms : 0,
      honeypot: typeof c.sitio_web === 'string' ? c.sitio_web : '',
      captcha: typeof c.captcha === 'string' ? c.captcha : '',
    },
  };
}
