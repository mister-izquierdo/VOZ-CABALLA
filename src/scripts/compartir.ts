/**
 * VOZ CABALLA · scripts/compartir.ts
 * Panel de compartir (se abre con el avión de papel de cualquier ficha).
 *
 * WhatsApp comparte el enlace con su vista previa; el resto comparte la imagen.
 *
 * Importante sobre cómo funciona compartir desde una web:
 *  - Una web NO puede abrir directamente Instagram, WhatsApp, X o Facebook con una imagen puesta.
 *    Lo único que permite el móvil es abrir SU menú de compartir («Enviar a…») con la imagen ya
 *    cargada; ahí la persona toca la app (un toque). Ese menú solo existe en conexiones seguras (https).
 *  - Por eso todos los botones intentan primero ese menú con la imagen. Si no está disponible
 *    (ordenador, o conexión sin https), cada botón usa su enlace de compartir clásico.
 */
import { diasTranscurridos } from '../lib/contadores';

interface Datos {
  numero: string;
  url: string;
  fecha: string;
  categoria: string;
  color: string;
  autor: string;
  frase: string;
  texto: string;
  sensible: boolean;
  imagenes: string[];
}

type Accion = 'stories' | 'estado' | 'whatsapp' | 'facebook' | 'x' | 'copiar' | 'descargar';

interface Imagen {
  blob: Blob;
  archivo: File;
}

const panel = document.getElementById('panel-compartir') as HTMLDialogElement | null;
if (panel) iniciar(panel);

function iniciar(panel: HTMLDialogElement): void {
  const numero = panel.querySelector<HTMLElement>('[data-panel-numero]')!;
  const estado = panel.querySelector<HTMLElement>('[data-panel-estado]')!;
  const botones = Array.from(panel.querySelectorAll<HTMLButtonElement>('[data-accion]'));
  let datos: Datos | null = null;
  // La imagen se prepara al abrir el panel, para que al pulsar un botón ya esté lista
  // (el móvil exige compartir justo después del toque).
  let imagenLista: Promise<Imagen> | null = null;

  const esMovil = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const urlAbsoluta = (): string => new URL(datos!.url, location.origin).href;
  const titulo = (): string => `${datos!.numero} · ${datos!.frase || 'Testimonio en VOZ CABALLA'}`;

  function mensaje(texto: string): void {
    estado.hidden = texto === '';
    estado.replaceChildren(texto);
  }

  function leerDatos(boton: HTMLElement): Datos {
    const d = boton.dataset;
    let imagenes: string[] = [];
    try {
      imagenes = d.imagenes ? (JSON.parse(d.imagenes) as string[]) : [];
    } catch {
      imagenes = [];
    }
    return {
      numero: d.numero ?? '',
      url: d.url ?? '/',
      fecha: d.fecha ?? '',
      categoria: d.categoria ?? '',
      color: d.color ?? '--cat-otro',
      autor: d.autor ?? '',
      frase: d.frase ?? '',
      texto: d.texto ?? '',
      sensible: d.sensible === 'si',
      imagenes,
    };
  }

  // ---------- Imagen 9:16 ----------
  async function crearImagen(d: Datos): Promise<Imagen> {
    const { generarImagenHistoria } = await import('../lib/imagen-historia');
    const color = getComputedStyle(document.documentElement).getPropertyValue(d.color).trim() || '#ededed';
    const voces = Number(document.querySelector('[data-counter-voices]')?.textContent ?? '0') || 0;
    const blob = await generarImagenHistoria({
      numero: d.numero,
      fecha: d.fecha,
      categoria: d.categoria,
      color,
      frase: d.frase,
      autor: d.autor,
      texto: d.texto,
      sensible: d.sensible,
      imagenes: d.imagenes,
      dias: diasTranscurridos(),
      voces,
    });
    const archivo = new File([blob], `voz-caballa-${d.numero.replace('#', '')}.png`, { type: 'image/png' });
    return { blob, archivo };
  }

  // Abrir desde cualquier avión de papel (también los de fichas cargadas después)
  document.addEventListener('click', (e) => {
    const boton = (e.target as HTMLElement).closest<HTMLElement>('[data-compartir]');
    if (!boton) return;
    e.preventDefault();
    datos = leerDatos(boton);
    numero.textContent = datos.numero;
    mensaje('');
    imagenLista = crearImagen(datos);
    imagenLista.catch(() => undefined); // el error se muestra cuando se pulse un botón
    panel.showModal();
  });

  panel.querySelector('[data-panel-cerrar]')?.addEventListener('click', () => panel.close());
  panel.addEventListener('click', (e) => {
    if (e.target === panel) panel.close(); // clic en el fondo oscuro
  });

  // ---------- Copiar enlace ----------
  async function copiarTexto(texto: string): Promise<boolean> {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(texto);
        return true;
      } catch {
        /* se prueba el método alternativo */
      }
    }
    // Método alternativo (conexiones sin https, móviles antiguos). El campo temporal va DENTRO del
    // panel: mientras el panel está abierto, todo lo que hay fuera de él queda bloqueado.
    const campo = document.createElement('textarea');
    campo.value = texto;
    campo.setAttribute('aria-hidden', 'true');
    campo.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px';
    panel!.append(campo);
    campo.focus({ preventScroll: true });
    campo.setSelectionRange(0, texto.length); // necesario en iPhone
    campo.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    campo.remove();
    return ok;
  }

  async function copiarEnlace(silencioso = false): Promise<boolean> {
    const enlace = urlAbsoluta();
    const ok = await copiarTexto(enlace);
    if (ok) {
      if (!silencioso) mensaje('Enlace copiado.');
      return true;
    }
    if (!silencioso) {
      // Último recurso: se muestra el enlace seleccionado para copiarlo a mano
      const campo = document.createElement('input');
      campo.readOnly = true;
      campo.value = enlace;
      campo.style.cssText = 'width:100%;margin-top:8px;padding:10px;font-size:16px;border:1px solid #000;border-radius:10px';
      campo.addEventListener('focus', () => campo.select());
      estado.hidden = false;
      estado.replaceChildren('No hemos podido copiarlo automáticamente. Mantén pulsado el enlace para copiarlo:', campo);
      campo.focus();
      campo.select();
    }
    return false;
  }

  // ---------- Compartir ----------
  function abrirVentana(direccion: string): void {
    window.open(direccion, '_blank', 'noopener,noreferrer');
  }

  function descargar(imagen: Imagen): void {
    const direccion = URL.createObjectURL(imagen.blob);
    const a = document.createElement('a');
    a.href = direccion;
    a.download = imagen.archivo.name;
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(direccion), 10_000);
  }

  /** Abre el menú de compartir del móvil con la imagen. Devuelve true si se pudo (o la persona lo cerró). */
  async function compartirConImagen(accion: Accion, imagen: Imagen): Promise<boolean> {
    if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;

    // X lleva también el texto con el enlace; Stories, estados y Facebook solo la imagen
    const conTexto = accion === 'x';
    const opciones: ShareData[] = conTexto
      ? [{ files: [imagen.archivo], text: `${titulo()}\n${urlAbsoluta()}` }, { files: [imagen.archivo] }]
      : [{ files: [imagen.archivo] }];

    const valida = opciones.find((o) => navigator.canShare(o));
    if (!valida) return false;
    try {
      await navigator.share(valida);
      return true;
    } catch (error) {
      return (error as DOMException).name === 'AbortError'; // la persona cerró el menú: no es un fallo
    }
  }

  function enlaceClasico(accion: Accion): void {
    const enlace = encodeURIComponent(urlAbsoluta());
    const texto = encodeURIComponent(`${titulo()}\n${urlAbsoluta()}`);
    switch (accion) {
      case 'whatsapp':
        // En móvil abre WhatsApp directamente (sin página intermedia); en ordenador, WhatsApp Web
        if (esMovil) window.location.href = `whatsapp://send?text=${texto}`;
        else abrirVentana(`https://wa.me/?text=${texto}`);
        break;
      case 'facebook':
        abrirVentana(`https://www.facebook.com/sharer/sharer.php?u=${enlace}`);
        break;
      case 'x':
        abrirVentana(`https://x.com/intent/post?text=${encodeURIComponent(titulo())}&url=${enlace}`);
        break;
    }
  }

  async function ejecutar(accion: Accion): Promise<void> {
    if (!datos) return;
    if (accion === 'copiar') {
      await copiarEnlace();
      return;
    }

    // WhatsApp: se envía el ENLACE (sin imagen adjunta) para que WhatsApp muestre la vista previa
    // del testimonio: imagen, título, descripción y dominio.
    if (accion === 'whatsapp') {
      const texto = `${titulo()}\n${urlAbsoluta()}`;
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ text: texto });
          return;
        } catch (error) {
          if ((error as DOMException).name === 'AbortError') return;
        }
      }
      enlaceClasico('whatsapp');
      return;
    }

    botones.forEach((b) => (b.disabled = true));
    mensaje('Preparando la imagen…');
    try {
      const imagen = await (imagenLista ?? crearImagen(datos));

      if (accion === 'descargar') {
        descargar(imagen);
        mensaje('Imagen guardada.');
        return;
      }

      if (await compartirConImagen(accion, imagen)) {
        mensaje('');
        return;
      }

      // Sin menú de compartir del móvil
      const nota = window.isSecureContext
        ? ''
        : ' Para compartir la imagen directamente hace falta una conexión segura (https); esta web de pruebas no la tiene.';
      if (accion === 'whatsapp' || accion === 'facebook' || accion === 'x') {
        enlaceClasico(accion);
        mensaje(esMovil ? `Se abre la app con el enlace.${nota}` : '');
        return;
      }
      descargar(imagen);
      const copiado = await copiarEnlace(true);
      const donde =
        accion === 'stories'
          ? 'Instagram: crea una historia con la imagen y añade el sticker de enlace'
          : 'WhatsApp: ve a Estados y añade la imagen';
      mensaje(`Imagen guardada. En ${donde}${copiado ? ' (el enlace ya está copiado para pegarlo)' : ''}.${nota}`);
    } catch (error) {
      console.error('Error al compartir:', error);
      mensaje('No hemos podido crear la imagen. Inténtalo de nuevo.');
    } finally {
      botones.forEach((b) => (b.disabled = false));
    }
  }

  panel.addEventListener('click', (e) => {
    const boton = (e.target as HTMLElement).closest<HTMLElement>('[data-accion]');
    if (boton?.dataset.accion) void ejecutar(boton.dataset.accion as Accion);
  });
}
