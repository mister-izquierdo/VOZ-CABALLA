
/**
 * VOZ CABALLA · scripts/formulario.ts
 * Comportamiento del formulario de Exprésate:
 *  - Anónimo / con nombre (bloquea o activa nombre y apellidos)
 *  - Categoría «Otro» y apartado de archivos según la categoría
 *  - Contadores de caracteres
 *  - Archivos: tipo, tamaño y cantidad; arrastrar y soltar; quitar
 *  - Validación y mensajes de error
 *  - Captcha (Cloudflare Turnstile), campo trampa y envío a Supabase
 *  - Eventos anónimos de Microsoft Clarity
 */
import { CATEGORIAS } from '../lib/categorias';
import { REGLAS, esContactoValido, formatearBytes } from '../lib/formulario-reglas';
import { enviarTestimonio, envioConfigurado } from '../lib/enviar-testimonio';

declare global {
  interface Window {
    // API de Cloudflare Turnstile
    turnstile?: {
      render: (contenedor: HTMLElement, opciones: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };

    // API de Microsoft Clarity
    clarity?: (...args: unknown[]) => void;
  }
}

// ---------- Analítica: eventos sin datos personales ----------
function registrarEventoClarity(nombre: string): void {
  if (typeof window.clarity === 'function') {
    window.clarity('event', nombre);
  }
}

const form = document.querySelector<HTMLFormElement>('#form-testimonio');
if (form) iniciar(form);

function iniciar(form: HTMLFormElement): void {
  const $ = <T extends HTMLElement>(id: string): T => {
    const el = form.querySelector<T>('#' + id) ?? document.getElementById(id);
    if (!el) throw new Error('Falta el elemento #' + id);
    return el as T;
  };

  const nombre = $<HTMLInputElement>('nombre');
  const apellidos = $<HTMLInputElement>('apellidos');
  const contacto = $<HTMLInputElement>('contacto');
  const categoria = $<HTMLSelectElement>('categoria');
  const grupoOtra = $<HTMLElement>('grupo-otra');
  const categoriaOtra = $<HTMLInputElement>('categoria_otra');
  const testimonio = $<HTMLTextAreaElement>('testimonio');
  const consecuencias = $<HTMLTextAreaElement>('consecuencias');
  const divisorArchivos = $<HTMLElement>('divisor-archivos');
  const seccionArchivos = $<HTMLElement>('seccion-archivos');
  const inputArchivos = $<HTMLInputElement>('archivos');
  const zonaArchivos = $<HTMLElement>('zona-archivos');
  const listaArchivos = $<HTMLElement>('lista-archivos');
  const checkArchivos = $<HTMLElement>('check-archivos');
  const grupoConsentimientos = $<HTMLElement>('consentimientos');
  const estado = $<HTMLElement>('form-estado');
  const botonEnviar = form.querySelector<HTMLButtonElement>('.form-submit')!;
  const trampa = form.querySelector<HTMLInputElement>('[name="sitio_web"]')!;
  const gracias = document.getElementById('gracias');
  const graciasAviso = document.getElementById('gracias-aviso');
  const radios = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="anonimato"]'));
  const aceptaPublicacion = form.querySelector<HTMLInputElement>('[name="acepta_publicacion"]')!;
  const aceptaPrivacidad = form.querySelector<HTMLInputElement>('[name="acepta_privacidad"]')!;
  const aceptaDerecho = form.querySelector<HTMLInputElement>('[name="acepta_derecho_documentos"]')!;

  let archivos: File[] = [];
  let enviando = false;
  let tokenCaptcha = '';
  let idCaptcha: string | undefined;
  const inicio = performance.now();

  // ---------- Mensajes de error ----------
  function mostrarError(id: string, mensaje: string): void {
    const caja = document.getElementById(id + '-error');
    const campo = document.getElementById(id);
    if (caja) {
      caja.textContent = mensaje;
      caja.hidden = false;
    }
    campo?.setAttribute('aria-invalid', 'true');
  }

  function limpiarError(id: string): void {
    const caja = document.getElementById(id + '-error');
    const campo = document.getElementById(id);
    if (caja) {
      caja.textContent = '';
      caja.hidden = true;
    }
    campo?.removeAttribute('aria-invalid');
  }

  // ---------- Anónimo o con nombre ----------
  function esAnonimo(): boolean {
    return radios.find((r) => r.checked)?.value !== 'nombre';
  }

  function actualizarAnonimato(): void {
    const anonimo = esAnonimo();
    for (const campo of [nombre, apellidos]) {
      campo.disabled = anonimo;
      if (anonimo) campo.value = '';
      limpiarError(campo.id);
    }
    nombre.placeholder = anonimo ? 'Anónimo' : 'Tu nombre';
    apellidos.placeholder = anonimo ? 'Anónimo' : 'Tus apellidos';
  }

  // ---------- Categoría ----------
  function categoriaElegida() {
    return CATEGORIAS.find((c) => c.valor === categoria.value);
  }

  function mostrarArchivos(): boolean {
    const c = categoriaElegida();
    return c ? c.permiteArchivos : true;
  }

  function actualizarCategoria(): void {
    categoria.classList.toggle('is-filled', categoria.value !== '');
    const esOtro = categoria.value === 'otro';
    grupoOtra.hidden = !esOtro;
    if (!esOtro) {
      categoriaOtra.value = '';
      limpiarError('categoria_otra');
    }

    const visible = mostrarArchivos();
    seccionArchivos.hidden = !visible;
    divisorArchivos.hidden = !visible;
    checkArchivos.hidden = !visible;
    if (!visible) {
      archivos = [];
      sincronizarArchivos();
      aceptaDerecho.checked = false;
      limpiarError('archivos');
    }
  }

  // ---------- Contadores ----------
  function actualizarContador(campo: HTMLTextAreaElement, max: number): void {
    const contador = form!.querySelector<HTMLElement>(`[data-contador="${campo.id}"]`);
    if (!contador) return;
    contador.textContent = `${campo.value.length}/${max}`;
    contador.classList.toggle('is-full', campo.value.length >= max);
  }

  // ---------- Archivos ----------
  function sincronizarArchivos(): void {
    const lote = new DataTransfer();
    archivos.forEach((f) => lote.items.add(f));
    inputArchivos.files = lote.files;

    listaArchivos.replaceChildren(
      ...archivos.map((f, i) => {
        const li = document.createElement('li');
        const n = document.createElement('span');
        n.className = 'upload-list__nombre';
        n.textContent = f.name;
        const peso = document.createElement('span');
        peso.className = 'upload-list__peso';
        peso.textContent = formatearBytes(f.size);
        const quitar = document.createElement('button');
        quitar.type = 'button';
        quitar.textContent = '×';
        quitar.setAttribute('aria-label', `Quitar ${f.name}`);
        quitar.addEventListener('click', () => {
          archivos.splice(i, 1);
          sincronizarArchivos();
          limpiarError('archivos');
        });
        li.append(n, peso, quitar);
        return li;
      }),
    );
  }

  function anadirArchivos(nuevos: File[]): void {
    const problemas: string[] = [];
    for (const f of nuevos) {
      if (!REGLAS.tiposArchivo.includes(f.type)) {
        problemas.push(`«${f.name}» no es un formato admitido (usa JPG, PNG, WebP o PDF).`);
      } else if (f.size > REGLAS.archivoMaxBytes) {
        problemas.push(`«${f.name}» pesa más de ${formatearBytes(REGLAS.archivoMaxBytes)}.`);
      } else if (archivos.some((a) => a.name === f.name && a.size === f.size)) {
        // ya añadido: se ignora
      } else if (archivos.length >= REGLAS.archivosMax) {
        problemas.push(`Solo puedes adjuntar ${REGLAS.archivosMax} archivos.`);
        break;
      } else {
        archivos.push(f);
      }
    }
    sincronizarArchivos();
    if (problemas.length) mostrarError('archivos', problemas.join(' '));
    else limpiarError('archivos');
  }

  // ---------- Validación ----------
  function validar(): string | null {
    let primero: string | null = null;
    const fallo = (id: string, mensaje: string) => {
      mostrarError(id, mensaje);
      primero ??= id;
    };

    if (!esAnonimo()) {
      if (nombre.value.trim().length < 2) fallo('nombre', 'Escribe tu nombre.');
      else limpiarError('nombre');
      if (apellidos.value.trim().length < 2) fallo('apellidos', 'Escribe tus apellidos.');
      else limpiarError('apellidos');
    }

    if (!contacto.value.trim()) fallo('contacto', 'Indica un correo electrónico o un teléfono de contacto.');
    else if (!esContactoValido(contacto.value)) fallo('contacto', 'Escribe un correo (nombre@ejemplo.com) o un teléfono válido.');
    else limpiarError('contacto');

    if (!categoria.value) fallo('categoria', 'Elige una categoría.');
    else limpiarError('categoria');

    if (categoria.value === 'otro') {
      if (!categoriaOtra.value.trim()) fallo('categoria_otra', 'Escribe cuál es la categoría.');
      else limpiarError('categoria_otra');
    }

    const t = testimonio.value.trim().length;
    if (t === 0) fallo('testimonio', 'Cuéntanos qué ocurrió.');
    else if (t < REGLAS.testimonioMin) fallo('testimonio', `Cuéntanos un poco más: mínimo ${REGLAS.testimonioMin} caracteres (llevas ${t}).`);
    else limpiarError('testimonio');

    const c = consecuencias.value.trim().length;
    if (c === 0) fallo('consecuencias', 'Cuéntanos qué consecuencias sigues sufriendo.');
    else if (c < REGLAS.consecuenciasMin) fallo('consecuencias', `Cuéntanos un poco más: mínimo ${REGLAS.consecuenciasMin} caracteres (llevas ${c}).`);
    else limpiarError('consecuencias');

    const faltan =
      !aceptaPublicacion.checked || !aceptaPrivacidad.checked || (mostrarArchivos() && !aceptaDerecho.checked);
    grupoConsentimientos.classList.toggle('is-invalid', faltan);
    if (faltan) fallo('consentimientos', 'Marca todas las casillas para poder enviar tu testimonio.');
    else limpiarError('consentimientos');

    return primero;
  }

  // ---------- Estado, captcha y envío ----------
  function mostrarEstado(tipo: 'error' | 'info', texto: string): void {
    estado.hidden = false;
    estado.className = `form-status form-status--${tipo}`;
    estado.textContent = texto;
  }

  function iniciarCaptcha(): void {
    const clave = import.meta.env.PUBLIC_TURNSTILE_SITEKEY as string | undefined;
    const contenedor = document.getElementById('captcha');
    if (!clave || !contenedor) return;
    let intentos = 0;
    const espera = window.setInterval(() => {
      intentos++;
      if (window.turnstile) {
        window.clearInterval(espera);
        idCaptcha = window.turnstile.render(contenedor, {
          sitekey: clave,
          action: 'enviar_testimonio',
          callback: (token: string) => (tokenCaptcha = token),
          'expired-callback': () => (tokenCaptcha = ''),
          'error-callback': () => (tokenCaptcha = ''),
        });
      } else if (intentos > 100) {
        window.clearInterval(espera);
      }
    }, 100);
  }

  function reiniciarCaptcha(): void {
    tokenCaptcha = '';
    if (idCaptcha !== undefined) window.turnstile?.reset(idCaptcha);
  }

  async function enviar(): Promise<void> {
    if (!envioConfigurado()) {
      mostrarEstado('error', 'El envío todavía no está configurado en esta web.');
      return;
    }
    if (!tokenCaptcha) {
      mostrarEstado('error', 'Espera a que termine la comprobación de seguridad y vuelve a pulsar «Enviar Testimonio».');
      return;
    }

    enviando = true;
    botonEnviar.disabled = true;
    mostrarEstado('info', 'Enviando…');

    const resultado = await enviarTestimonio(
      {
        anonimo: esAnonimo(),
        nombre: nombre.value,
        apellidos: apellidos.value,
        contacto: contacto.value,
        categoria: categoria.value,
        categoria_otra: categoriaOtra.value,
        testimonio: testimonio.value,
        consecuencias: consecuencias.value,
        acepta_publicacion: aceptaPublicacion.checked,
        acepta_privacidad: aceptaPrivacidad.checked,
        acepta_derecho_documentos: aceptaDerecho.checked,
        sitio_web: trampa.value,
        tiempo_ms: Math.round(performance.now() - inicio),
        captcha: tokenCaptcha,
      },
      archivos,
      (hechos, total) => mostrarEstado('info', `Subiendo archivos (${hechos}/${total})…`),
    );

    if (!resultado.ok) {
      mostrarEstado('error', resultado.error);
      if (resultado.campo) document.getElementById(resultado.campo)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      reiniciarCaptcha();
      enviando = false;
      botonEnviar.disabled = false;
      return;
    }

    // Evento genérico: no transmite el contenido del testimonio.
    registrarEventoClarity('vc_testimonio_recibido');

    if (graciasAviso) {
      graciasAviso.hidden = resultado.fallosSubida.length === 0;
      graciasAviso.textContent =
        resultado.fallosSubida.length > 0
          ? `Tu testimonio se ha recibido, pero no hemos podido subir ${resultado.fallosSubida.length === 1 ? 'un archivo' : 'algunos archivos'}. Te contactaremos para recibirlos.`
          : '';
    }
    form!.hidden = true;
    if (gracias) {
      gracias.hidden = false;
      gracias.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  // ---------- Eventos ----------
  radios.forEach((r) => r.addEventListener('change', actualizarAnonimato));

  categoria.addEventListener('change', () => {
    actualizarCategoria();

    // Solo registra que se ha elegido una categoría, nunca su contenido.
    if (categoria.value) {
      registrarEventoClarity('vc_categoria_seleccionada');
    }
  });

  testimonio.addEventListener('input', () => actualizarContador(testimonio, REGLAS.testimonioMax));
  consecuencias.addEventListener('input', () => actualizarContador(consecuencias, REGLAS.consecuenciasMax));

  form.addEventListener('input', (e) => {
    const id = (e.target as HTMLElement).id;
    if (id) limpiarError(id);
  });

  form.addEventListener('change', (e) => {
    const destino = e.target as HTMLInputElement;
    if (destino.type === 'checkbox') {
      grupoConsentimientos.classList.remove('is-invalid');
      limpiarError('consentimientos');
    }
  });

  inputArchivos.addEventListener('change', () => {
    anadirArchivos(Array.from(inputArchivos.files ?? []));
  });

  ['dragenter', 'dragover'].forEach((ev) =>
    zonaArchivos.addEventListener(ev, (e) => {
      e.preventDefault();
      zonaArchivos.classList.add('is-over');
    }),
  );

  ['dragleave', 'drop'].forEach((ev) =>
    zonaArchivos.addEventListener(ev, () => zonaArchivos.classList.remove('is-over')),
  );

  zonaArchivos.addEventListener('drop', (e) => {
    e.preventDefault();
    anadirArchivos(Array.from((e as DragEvent).dataTransfer?.files ?? []));
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (enviando) return;

    // Registra el intento, incluso si después falla la validación.
    registrarEventoClarity('vc_envio_intentado');

    const primero = validar();
    if (primero) {
      mostrarEstado('error', 'Revisa los campos marcados en rojo.');
      const destino = document.getElementById(primero);
      (destino?.querySelector?.('input') ?? destino)?.focus?.();
      destino?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    void enviar();
  });

  iniciarCaptcha();
  actualizarAnonimato();
  actualizarCategoria();
  actualizarContador(testimonio, REGLAS.testimonioMax);
  actualizarContador(consecuencias, REGLAS.consecuenciasMax);
}
