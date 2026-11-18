/**
 * VOZ CABALLA · lib/imagen-historia.ts
 * Dibuja la imagen vertical 9:16 (1080×1920) para Instagram Stories y estados de WhatsApp,
 * con el diseño de tus plantillas COMPARTIR.svg y COMPARTIR_CON_IMAGENES.svg.
 * Se genera en el navegador de quien comparte: no cuesta nada en el servidor.
 * Las medidas están en píxeles del lienzo de 1080 × 1920, como en tu diseño.
 */
import { SITIO } from './sitio';
import { etiquetaDias, etiquetaVoces } from './contadores';

export interface DatosHistoria {
  numero: string; // «#002»
  fecha: string; // «07/11/2026»
  categoria: string; // texto de la categoría
  color: string; // color de la categoría (#RRGGBB)
  frase: string;
  autor: string;
  texto: string; // testimonio completo (vacío si es sensible)
  sensible: boolean;
  imagenes: string[]; // direcciones de imágenes públicas (máximo 4)
  dias: number;
  voces: number;
}

const ANCHO = 1080;
const ALTO = 1920;
const FUENTE = '"Inter Variable", Inter, system-ui, sans-serif';
const NEGRO = '#000000';
const GRIS = '#717171';

/** Lee un espaciado de letras de tokens.css (en em), para que la imagen siga a la web. */
function tracking(nombre: string, porDefecto: number): number {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  const n = Number.parseFloat(valor);
  return Number.isFinite(n) ? n : porDefecto;
}

/** Herramienta de texto con espaciado entre letras. */
class Pintor {
  private ctx: CanvasRenderingContext2D;
  private nativo: boolean;
  private px = 0;
  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.nativo = 'letterSpacing' in ctx;
  }

  estilo(tamano: number, peso: number, color: string, trackingEm: number): void {
    this.ctx.font = `${peso} ${tamano}px ${FUENTE}`;
    this.ctx.fillStyle = color;
    this.ctx.textBaseline = 'alphabetic';
    this.ctx.textAlign = 'left';
    this.px = trackingEm * tamano;
    if (this.nativo) (this.ctx as unknown as { letterSpacing: string }).letterSpacing = `${this.px}px`;
  }

  ancho(texto: string): number {
    const w = this.ctx.measureText(texto).width;
    return this.nativo ? w : w + this.px * texto.length;
  }

  texto(t: string, x: number, y: number, alinear: 'left' | 'center' | 'right' = 'left'): void {
    const w = this.ancho(t);
    const x0 = alinear === 'left' ? x : alinear === 'center' ? x - w / 2 : x - w;
    if (this.nativo) {
      this.ctx.fillText(t, x0, y);
      return;
    }
    let cursor = x0;
    for (const letra of t) {
      this.ctx.fillText(letra, cursor, y);
      cursor += this.ctx.measureText(letra).width + this.px;
    }
  }

  /** Reparte el texto en líneas que caben en `max` píxeles. */
  envolver(texto: string, max: number): string[] {
    const lineas: string[] = [];
    let actual = '';
    for (const palabra of texto.replace(/\s+/g, ' ').trim().split(' ')) {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      if (actual && this.ancho(prueba) > max) {
        lineas.push(actual);
        actual = palabra;
      } else {
        actual = prueba;
      }
    }
    if (actual) lineas.push(actual);
    return lineas;
  }
}

function rectRedondeado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function cargarImagen(src: string, remota = false): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (remota) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function generarImagenHistoria(d: DatosHistoria): Promise<Blob> {
  await Promise.all(['400', '500', '600'].map((p) => document.fonts.load(`${p} 40px "Inter Variable"`).catch(() => [])));

  const [logo, bandera, ...fotosCargadas] = await Promise.all([
    cargarImagen('/logo.svg'),
    cargarImagen('/ceuta-bandera.png'),
    ...d.imagenes.slice(0, 4).map((u) => cargarImagen(u, true)),
  ]);
  const fotos = fotosCargadas.filter((f): f is HTMLImageElement => f !== null);
  const conFotos = fotos.length > 0 && !d.sensible;

  const lienzo = document.createElement('canvas');
  lienzo.width = ANCHO;
  lienzo.height = ALTO;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('No se pudo preparar la imagen');
  const p = new Pintor(ctx);

  const trCuerpo = tracking('--tracking-cuerpo', -0.099);
  const trPequeno = tracking('--tracking-pequeno', -0.071);
  const trTitulo = tracking('--tracking-titulo', -0.085);
  const trNumero = tracking('--tracking-numero', -0.12);
  const trEtiqueta = tracking('--tracking-etiqueta', -0.11);

  // Con imágenes, todo lo de arriba sube 170 para hacer sitio
  const dy = conFotos ? -170 : 0;

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, ANCHO, ALTO);

  // ---------- Logotipo y contadores ----------
  if (logo) ctx.drawImage(logo, (ANCHO - 622.5) / 2, 314 + dy, 622.5, 96);

  p.estilo(99, 400, NEGRO, trNumero);
  p.texto(String(d.dias), 413.5, 559 + dy, 'center');
  p.texto(String(d.voces), 661.5, 559 + dy, 'center');
  p.estilo(42.6, 400, GRIS, trEtiqueta);
  p.texto(etiquetaDias(d.dias), 413.5, 620 + dy, 'center');
  p.texto(etiquetaVoces(d.voces), 661.5, 620 + dy, 'center');
  ctx.fillStyle = NEGRO;
  ctx.fillRect(539, 483 + dy, 2, 129);

  const topTarjeta = 727.5 + dy;

  // ---------- Contenido de la tarjeta (se mide antes de dibujar) ----------
  const anchoUtil = 734;
  const xTexto = 173;

  p.estilo(42, 500, NEGRO, trCuerpo);
  const titulo = d.sensible ? 'Contenido sensible' : d.frase;
  const lineasFrase = p.envolver(titulo, anchoUtil).slice(0, 3);
  const extraFrase = (lineasFrase.length - 1) * 50;

  p.estilo(32, 500, NEGRO, trCuerpo);
  const textoCuerpo = d.sensible ? 'Este testimonio contiene contenido sensible. Léelo con precaución.' : d.texto;
  let lineasCuerpo = p.envolver(textoCuerpo, anchoUtil);
  let hayMas = false;
  if (lineasCuerpo.length > 3) {
    hayMas = true;
    lineasCuerpo = lineasCuerpo.slice(0, 3);
    let ultima = lineasCuerpo[2];
    while (ultima && p.ancho(`${ultima}…más`) > anchoUtil) ultima = ultima.slice(0, ultima.lastIndexOf(' ') > 0 ? ultima.lastIndexOf(' ') : -1);
    lineasCuerpo[2] = ultima.replace(/[,;:.\s]+$/, '');
  }

  const baseCuerpo = 422.5 + extraFrase;
  const ultimaBase = baseCuerpo + (lineasCuerpo.length - 1) * 38;
  const altoFotos = 230;
  const altoTarjeta = conFotos ? ultimaBase + 36 + altoFotos + 27.5 : ultimaBase + 43.5;

  // ---------- Tarjeta ----------
  ctx.fillStyle = '#fff';
  rectRedondeado(ctx, 140.5, topTarjeta, 799, altoTarjeta, 27.5);
  ctx.fill();
  ctx.save();
  rectRedondeado(ctx, 140.5, topTarjeta, 799, altoTarjeta, 27.5);
  ctx.clip();
  ctx.fillStyle = NEGRO;
  ctx.fillRect(140.5, topTarjeta, 799, 134.5);
  ctx.restore();
  ctx.lineWidth = 3;
  ctx.strokeStyle = NEGRO;
  rectRedondeado(ctx, 140.5, topTarjeta, 799, altoTarjeta, 27.5);
  ctx.stroke();

  p.estilo(77, 500, '#fff', trTitulo);
  p.texto('SU HISTORIA IMPORTA', 540, topTarjeta + 99.5, 'center');

  p.estilo(40, 500, GRIS, trPequeno);
  p.texto(`${d.numero} · ${d.fecha}`, xTexto, topTarjeta + 201.5);

  p.estilo(24, 500, NEGRO, trPequeno);
  const anchoChip = p.ancho(d.categoria) + 34;
  ctx.fillStyle = d.color;
  rectRedondeado(ctx, xTexto, topTarjeta + 213.5, anchoChip, 34, 17);
  ctx.fill();
  p.estilo(24, 500, NEGRO, trPequeno);
  p.texto(d.categoria, xTexto + 17, topTarjeta + 213.5 + 24.5);

  p.estilo(42, 500, NEGRO, trCuerpo);
  lineasFrase.forEach((l, i) => p.texto(l, xTexto, topTarjeta + 293.5 + i * 50));

  p.estilo(32, 500, GRIS, trPequeno);
  p.texto(d.autor, xTexto, topTarjeta + 337.5 + extraFrase);

  p.estilo(32, 500, '#1b1b1b', trCuerpo);
  lineasCuerpo.forEach((l, i) => {
    const y = topTarjeta + baseCuerpo + i * 38;
    const esUltima = i === lineasCuerpo.length - 1;
    p.estilo(32, 500, '#1b1b1b', trCuerpo);
    if (hayMas && esUltima) {
      p.texto(`${l}…`, xTexto, y);
      const ancho = p.ancho(`${l}…`);
      p.estilo(32, 500, GRIS, trCuerpo);
      p.texto('más', xTexto + ancho, y);
    } else {
      p.texto(l, xTexto, y);
    }
  });

  // ---------- Pastilla y cuenta ----------
  ctx.fillStyle = '#fff';
  rectRedondeado(ctx, 92.5, 691.5 + dy, 584, 60, 23.5);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = NEGRO;
  ctx.stroke();
  let tamPastilla = 38;
  p.estilo(tamPastilla, 500, NEGRO, trCuerpo);
  while (p.ancho(SITIO.rotuloHistoria) > 584 - 44 && tamPastilla > 22) {
    tamPastilla -= 1;
    p.estilo(tamPastilla, 500, NEGRO, trCuerpo);
  }
  p.texto(SITIO.rotuloHistoria, 92.5 + 292, 735 + dy, 'center');
  p.estilo(40, 500, NEGRO, trCuerpo);
  p.texto(SITIO.instagram, 909, 707 + dy, 'right');

  // ---------- Imágenes adjuntas ----------
  if (conFotos) {
    const y0 = topTarjeta + ultimaBase + 36;
    const n = fotos.length;
    const hueco = 20;
    const ancho = (anchoUtil - hueco * (n - 1)) / n;
    fotos.forEach((img, i) => {
      const x = xTexto + i * (ancho + hueco);
      ctx.save();
      rectRedondeado(ctx, x, y0, ancho, altoFotos, 14.5);
      ctx.clip();
      const escala = Math.max(ancho / img.naturalWidth, altoFotos / img.naturalHeight);
      const w = img.naturalWidth * escala;
      const h = img.naturalHeight * escala;
      ctx.drawImage(img, x + (ancho - w) / 2, y0 + (altoFotos - h) / 2, w, h);
      ctx.restore();
    });
  }

  // ---------- Pie ----------
  const finTarjeta = topTarjeta + altoTarjeta;
  p.estilo(26, 500, GRIS, trPequeno);
  const lineasRespeto = p.envolver(SITIO.avisoRespeto, 790);
  lineasRespeto.forEach((l, i) => p.texto(l, 540, finTarjeta + 105.5 + i * 31, 'center'));
  const baseUltimaRespeto = finTarjeta + 105.5 + (lineasRespeto.length - 1) * 31;

  p.estilo(40, 500, NEGRO, trCuerpo);
  p.texto(SITIO.dominio, 540, baseUltimaRespeto + 111, 'center');
  if (bandera) ctx.drawImage(bandera, 460, baseUltimaRespeto + 111 + 58, 160, 107);

  return new Promise<Blob>((resolve, reject) => {
    lienzo.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/png');
  });
}

// =====================================================================
// Imagen de vista previa del enlace (1200 × 630)
// Es la que se ve al pegar el enlace de un testimonio en WhatsApp, X o Facebook.
// La genera el panel de administración al publicar y se guarda en el almacenamiento público.
// =====================================================================

export interface DatosVistaPrevia {
  numero: string;
  fecha: string;
  categoria: string;
  color: string;
  frase: string;
  autor: string;
  sensible: boolean;
}

export async function generarImagenVistaPrevia(d: DatosVistaPrevia): Promise<Blob> {
  await Promise.all(['400', '500', '600'].map((p) => document.fonts.load(`${p} 40px "Inter Variable"`).catch(() => [])));
  const logo = await cargarImagen('/logo.svg');

  const lienzo = document.createElement('canvas');
  lienzo.width = 1200;
  lienzo.height = 630;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('No se pudo preparar la imagen');
  const p = new Pintor(ctx);

  const trCuerpo = tracking('--tracking-cuerpo', -0.099);
  const trPequeno = tracking('--tracking-pequeno', -0.071);
  const trTitulo = tracking('--tracking-titulo', -0.085);

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 1200, 630);

  // Cabecera: logotipo y número
  if (logo) ctx.drawImage(logo, 60, 44, 330, (330 * 96) / 622.5);
  p.estilo(32, 500, GRIS, trPequeno);
  p.texto(`${d.numero} · ${d.fecha}`, 1140, 88, 'right');

  // Categoría
  p.estilo(28, 500, NEGRO, trPequeno);
  const anchoChip = p.ancho(d.categoria) + 44;
  ctx.fillStyle = d.color;
  rectRedondeado(ctx, 60, 148, anchoChip, 46, 23);
  ctx.fill();
  p.estilo(28, 500, NEGRO, trPequeno);
  p.texto(d.categoria, 82, 180);

  // Frase destacada: el tamaño baja hasta que ocupa como mucho hasta la altura 450 (deja sitio al autor)
  const titulo = d.sensible ? 'Testimonio con contenido sensible' : d.frase;
  const LIMITE = 450;
  let tamano = 72;
  let lineas: string[] = [];
  for (const prueba of [72, 64, 56, 48, 44]) {
    tamano = prueba;
    p.estilo(tamano, 500, NEGRO, trTitulo);
    lineas = p.envolver(titulo, 1080);
    if (290 + (lineas.length - 1) * Math.round(tamano * 1.16) <= LIMITE) break;
  }
  const paso = Math.round(tamano * 1.16);
  const maxLineas = Math.floor((LIMITE - 290) / paso) + 1;
  if (lineas.length > maxLineas) {
    lineas = lineas.slice(0, maxLineas);
    lineas[maxLineas - 1] = lineas[maxLineas - 1].replace(/[,;:.\s]+$/, '') + '…';
  }
  p.estilo(tamano, 500, NEGRO, trTitulo);
  lineas.forEach((l, i) => p.texto(l, 60, 290 + i * paso));

  if (!d.sensible) {
    p.estilo(34, 500, GRIS, trCuerpo);
    p.texto(d.autor, 60, 290 + (lineas.length - 1) * paso + 62);
  }

  // Pie: dominio, lema y banda azul
  ctx.fillStyle = '#0017e8';
  ctx.fillRect(0, 590, 1200, 40);
  p.estilo(34, 500, NEGRO, trCuerpo);
  p.texto(SITIO.dominio, 60, 556);
  p.estilo(30, 500, GRIS, trPequeno);
  p.texto(SITIO.lema, 1140, 556, 'right');

  return new Promise<Blob>((resolve, reject) => {
    lienzo.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/png');
  });
}
