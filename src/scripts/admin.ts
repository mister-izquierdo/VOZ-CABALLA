/**
 * VOZ CABALLA · scripts/admin.ts
 * Panel de administración (página /admin).
 * Acceso: correo + contraseña + código de verificación en dos pasos.
 * Desde aquí se revisan los testimonios recibidos y se publican con un botón.
 */
import {
  api, mensajeError, TIPOS_ADMIN,
  type ArchivoAdmin, type CambiosTestimonio, type DetalleAdmin, type EstadoSesion,
  type FilaAdmin, type Grupo, type Subfiltro, type TestimonioAdmin,
} from '../lib/admin-api';
import { CATEGORIAS } from '../lib/categorias';
import {
  esc, etiquetaCategoria, fechaCorta, numeroTexto, rutaFicha, variableColor,
} from '../lib/testimonios';

const POR_PAGINA = 25;

const ETIQUETA_ESTADO: Record<string, string> = {
  recibido: 'Pendiente', en_revision: 'En revisión', publicado: 'Publicado', rechazado: 'Rechazado', retirado: 'Retirado',
};
const ETIQUETA_ALERTA: Record<string, string> = {
  dato_personal: 'Datos personales', ofensivo: 'Ofensivo', mayusculas: 'MAYÚSCULAS', repeticion: 'Repetición', sensible: 'Sensible',
};
const GRUPOS: { id: Grupo; nombre: string }[] = [
  { id: 'pendientes', nombre: 'Pendientes' },
  { id: 'publicados', nombre: 'Publicados' },
  { id: 'rechazados', nombre: 'Rechazados' },
  { id: 'retirados', nombre: 'Retirados' },
];
const SUBFILTROS: { id: Subfiltro; nombre: string }[] = [
  { id: 'todos', nombre: 'Todos' },
  { id: 'limpios', nombre: 'Limpios' },
  { id: 'archivos', nombre: 'Con archivos' },
  { id: 'sospechosos', nombre: 'Sospechosos' },
];

type Vista = 'cargando' | 'login' | 'mfa_alta' | 'mfa_codigo' | 'sin_permiso' | 'lista' | 'detalle';

interface Estado {
  vista: Vista;
  email: string;
  factorId: string;
  mfa: { qr: string; secreto: string } | null;
  grupo: Grupo;
  sub: Subfiltro;
  q: string;
  filas: FilaAdmin[];
  total: number;
  cuentas: Record<Grupo, number> | null;
  seleccion: Set<string>;
  detalle: DetalleAdmin | null;
  aviso: { tipo: 'ok' | 'error' | 'info'; texto: string } | null;
}

const e: Estado = {
  vista: 'cargando', email: '', factorId: '', mfa: null,
  grupo: 'pendientes', sub: 'todos', q: '', filas: [], total: 0, cuentas: null,
  seleccion: new Set(), detalle: null, aviso: null,
};

const raiz = document.getElementById('admin');
if (raiz) void iniciar(raiz);

// =====================================================================
// Utilidades
// =====================================================================

function fechaHora(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

function tamano(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

function categoriaTexto(t: { categoria: string; categoria_otra: string | null }): string {
  return etiquetaCategoria(t.categoria, t.categoria_otra);
}

function colorCategoria(valor: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(variableColor(valor)).trim() || '#ededed';
}

function avisar(tipo: 'ok' | 'error' | 'info', texto: string): void {
  // Los mensajes «Cargando…» son pasajeros: no se recuerdan al redibujar la pantalla
  if (tipo !== 'info') e.aviso = texto ? { tipo, texto } : null;
  const caja = document.getElementById('aviso');
  if (caja) {
    caja.hidden = texto === '';
    caja.className = `aviso aviso--${tipo}`;
    caja.textContent = texto;
  }
}

/** Ejecuta una acción bloqueando los botones mientras tanto y mostrando los errores. */
async function haciendo(mensaje: string, accion: () => Promise<void>): Promise<boolean> {
  raiz!.classList.add('is-ocupado');
  if (mensaje) avisar('info', mensaje);
  try {
    await accion();
    return true;
  } catch (error) {
    const texto = mensajeError(error);
    avisar('error', texto);
    if (/sesión ha caducado/.test(texto)) void irASesion();
    return false;
  } finally {
    raiz!.classList.remove('is-ocupado');
  }
}

// =====================================================================
// Pantallas
// =====================================================================

function vistaLogin(error = ''): string {
  return `<section class="acceso">
    <h1 class="acceso__titulo">Administración</h1>
    <p class="acceso__texto">Acceso privado de VOZ CABALLA.</p>
    <form class="acceso__form" data-form="login" novalidate>
      <label class="campo"><span>Correo electrónico</span><input type="email" name="email" autocomplete="username" required></label>
      <label class="campo"><span>Contraseña</span><input type="password" name="clave" autocomplete="current-password" required></label>
      <p class="aviso aviso--error" id="aviso" role="alert" ${error ? '' : 'hidden'}>${esc(error)}</p>
      <button class="boton boton--principal" type="submit">Entrar</button>
    </form>
  </section>`;
}

function vistaMfaAlta(error = ''): string {
  const m = e.mfa;
  return `<section class="acceso">
    <h1 class="acceso__titulo">Verificación en dos pasos</h1>
    <p class="acceso__texto">Primera vez: escanea este código con una aplicación de autenticación (Google Authenticator, Microsoft Authenticator, Aegis…) y escribe el código de 6 cifras que te muestre.</p>
    ${m ? `<img class="acceso__qr" src="${esc(m.qr)}" alt="Código QR para la aplicación de autenticación" width="200" height="200">
    <p class="acceso__secreto">¿No puedes escanearlo? Escribe esta clave en la aplicación:<br><code>${esc(m.secreto)}</code></p>` : '<p>Preparando…</p>'}
    <form class="acceso__form" data-form="mfa" novalidate>
      <label class="campo"><span>Código de 6 cifras</span><input type="text" name="codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" required></label>
      <p class="aviso aviso--error" id="aviso" role="alert" ${error ? '' : 'hidden'}>${esc(error)}</p>
      <button class="boton boton--principal" type="submit">Activar y entrar</button>
    </form>
    <button class="enlace" type="button" data-accion="salir">Cerrar sesión</button>
  </section>`;
}

function vistaMfaCodigo(error = ''): string {
  return `<section class="acceso">
    <h1 class="acceso__titulo">Verificación en dos pasos</h1>
    <p class="acceso__texto">Escribe el código de 6 cifras de tu aplicación de autenticación.</p>
    <form class="acceso__form" data-form="mfa" novalidate>
      <label class="campo"><span>Código de 6 cifras</span><input type="text" name="codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" required></label>
      <p class="aviso aviso--error" id="aviso" role="alert" ${error ? '' : 'hidden'}>${esc(error)}</p>
      <button class="boton boton--principal" type="submit">Entrar</button>
    </form>
    <button class="enlace" type="button" data-accion="salir">Cerrar sesión</button>
  </section>`;
}

function vistaSinPermiso(): string {
  return `<section class="acceso">
    <h1 class="acceso__titulo">Sin permiso</h1>
    <p class="acceso__texto">La cuenta <strong>${esc(e.email)}</strong> no tiene acceso de administración.</p>
    <button class="boton" type="button" data-accion="salir">Cerrar sesión</button>
  </section>`;
}

function barraSuperior(): string {
  return `<header class="barra">
    <p class="barra__titulo">VOZ CABALLA · Administración</p>
    <p class="barra__usuario">${esc(e.email)} <button class="enlace" type="button" data-accion="salir">Salir</button></p>
  </header>`;
}

function alertasHtml(alertas: string[]): string {
  return alertas
    .filter((a) => ETIQUETA_ALERTA[a])
    .map((a) => `<span class="alerta alerta--${esc(a)}">${esc(ETIQUETA_ALERTA[a])}</span>`)
    .join('');
}

function filaHtml(f: FilaAdmin): string {
  const num = f.numero_publico ? numeroTexto(f.numero_publico) : 'Nuevo';
  return `<li class="fila">
    <label class="fila__check"><input type="checkbox" data-sel value="${esc(f.id)}" ${e.seleccion.has(f.id) ? 'checked' : ''} aria-label="Seleccionar"></label>
    <button type="button" class="fila__abrir" data-abrir="${esc(f.id)}">
      <span class="fila__num">${esc(num)}</span>
      <span class="fila__fecha">${esc(fechaCorta(f.publicado_en ?? f.creado_en))}</span>
      <span class="etiqueta" style="--cat: ${esc(colorCategoria(f.categoria))}; background: var(--cat)">${esc(categoriaTexto(f))}</span>
      <span class="fila__nombre">${esc(f.nombre_publico)}</span>
      <span class="fila__alertas">${alertasHtml(f.alertas.filter((a) => a !== 'sensible'))}${f.contenido_sensible ? '<span class="alerta alerta--sensible">Sensible</span>' : ''}</span>
      <span class="fila__archivos">${f.archivos ? `${f.archivos} archivo${f.archivos === 1 ? '' : 's'}` : ''}</span>
    </button>
  </li>`;
}

function vistaLista(): string {
  const c = e.cuentas;
  const tabs = GRUPOS.map(
    (g) => `<button type="button" class="pestana" data-grupo="${g.id}" ${g.id === e.grupo ? 'aria-current="true"' : ''}>${g.nombre} <span class="pestana__n">${c ? c[g.id] : '…'}</span></button>`,
  ).join('');
  const subs =
    e.grupo === 'pendientes'
      ? `<div class="subfiltros">${SUBFILTROS.map((s) => `<button type="button" class="subfiltro" data-sub="${s.id}" ${s.id === e.sub ? 'aria-current="true"' : ''}>${s.nombre}</button>`).join('')}</div>`
      : '';
  const acciones: string[] = [];
  if (e.seleccion.size > 0 && (e.grupo === 'pendientes')) {
    acciones.push(`<button class="boton boton--peligro" type="button" data-accion="rechazar-seleccion">Rechazar seleccionados (${e.seleccion.size})</button>`);
  }
  if (e.grupo === 'rechazados') {
    acciones.push(`<button class="boton" type="button" data-accion="limpiar-rechazados">Borrar rechazados de más de 30 días</button>`);
  }
  const lista = e.filas.length
    ? `<ul class="filas">${e.filas.map(filaHtml).join('')}</ul>`
    : `<p class="vacio">No hay testimonios en esta lista.</p>`;
  const masBoton = e.filas.length < e.total ? `<button class="boton" type="button" data-accion="mas">Cargar más (${e.filas.length} de ${e.total})</button>` : '';
  return `${barraSuperior()}
  <main class="panel">
    <div class="pestanas">${tabs}</div>
    ${subs}
    <form class="busqueda" data-form="buscar" role="search"><input type="search" name="q" value="${esc(e.q)}" placeholder="Buscar por nombre, texto o contacto…" aria-label="Buscar"><button class="boton" type="submit">Buscar</button></form>
    <p class="aviso" id="aviso" role="status" hidden></p>
    ${acciones.length ? `<div class="acciones-lista">${acciones.join('')}</div>` : ''}
    ${lista}
    <div class="mas">${masBoton}</div>
  </main>`;
}

function faltanParaPublicar(t: { frase_destacada: string | null; residencia_verificada: boolean; contenido_sensible: boolean; revision_reforzada_ok: boolean }): string[] {
  const f: string[] = [];
  if (!t.frase_destacada || !t.frase_destacada.trim()) f.push('Escribe la frase destacada.');
  if (!t.residencia_verificada) f.push('Marca «Residencia verificada».');
  if (t.contenido_sensible && !t.revision_reforzada_ok) f.push('Contenido sensible: marca «Revisión reforzada hecha».');
  return f;
}

function archivoHtml(a: ArchivoAdmin): string {
  const estado = a.es_publico ? 'Público' : a.estado_revision === 'rechazado' ? 'Rechazado' : a.estado_revision === 'aprobado' ? 'Aprobado (no público)' : 'Pendiente';
  const esAdminPropio = a.ruta_privada.startsWith('admin/');
  return `<li class="archivo" data-archivo="${esc(a.id)}">
    <div class="archivo__info">
      <strong class="archivo__nombre">${esc(a.nombre_original ?? 'archivo')}</strong>
      <span class="archivo__datos">${esc(a.tipo_mime)} · ${esc(tamano(a.tamano_bytes))} · <em>${esc(estado)}</em></span>
    </div>
    <div class="archivo__botones">
      <button class="boton boton--chico" type="button" data-archivo-ver="${esc(a.id)}">Ver</button>
      ${!a.es_publico && !esAdminPropio ? `<button class="boton boton--chico" type="button" data-archivo-publicar="${esc(a.id)}">Aprobar y hacer público</button>` : ''}
      <button class="boton boton--chico" type="button" data-archivo-version="${esc(a.id)}">Subir versión editada</button>
      ${a.es_publico ? `<button class="boton boton--chico" type="button" data-archivo-quitar="${esc(a.id)}">Quitar de público</button>` : ''}
      ${a.estado_revision !== 'rechazado' ? `<button class="boton boton--chico boton--peligro" type="button" data-archivo-rechazar="${esc(a.id)}">Rechazar</button>` : ''}
      <input type="file" class="sr-only" data-input-version="${esc(a.id)}" accept="${TIPOS_ADMIN.join(',')}">
    </div>
  </li>`;
}

function vistaDetalle(): string {
  const d = e.detalle!;
  const t = d.testimonio;
  const faltan = faltanParaPublicar(t);
  const num = t.numero_publico ? numeroTexto(t.numero_publico) : 'Sin número todavía';
  const opciones = CATEGORIAS.map((c) => `<option value="${esc(c.valor)}" ${c.valor === t.categoria ? 'selected' : ''}>${esc(c.etiqueta)}</option>`).join('');
  const publicable = t.estado === 'recibido' || t.estado === 'en_revision' || t.estado === 'retirado';

  const botones: string[] = [];
  botones.push(`<button class="boton" type="button" data-accion="guardar">Guardar cambios</button>`);
  if (publicable) botones.push(`<button class="boton boton--principal" type="button" data-accion="publicar" ${faltan.length ? 'disabled' : ''}>Publicar</button>`);
  if (t.estado === 'recibido' || t.estado === 'en_revision') botones.push(`<button class="boton boton--peligro" type="button" data-accion="rechazar">Rechazar</button>`);
  if (t.estado === 'publicado') {
    botones.push(`<button class="boton" type="button" data-accion="regenerar">Regenerar imágenes de compartir</button>`);
    botones.push(`<button class="boton boton--peligro" type="button" data-accion="retirar">Retirar</button>`);
  }
  if (t.estado === 'rechazado' || t.estado === 'retirado') botones.push(`<button class="boton" type="button" data-accion="pendiente">Volver a pendientes</button>`);
  botones.push(`<button class="boton boton--peligro" type="button" data-accion="eliminar">Eliminar para siempre</button>`);

  const registro = d.registro.length
    ? `<ul class="registro">${d.registro.map((r) => `<li><span>${esc(fechaHora(r.creado_en))}</span> ${esc(r.accion.replace(/_/g, ' '))}</li>`).join('')}</ul>`
    : '<p class="vacio">Sin acciones registradas todavía.</p>';

  return `${barraSuperior()}
  <main class="panel panel--detalle">
    <button class="enlace" type="button" data-accion="volver">← Volver a la lista</button>
    <div class="detalle__cabecera">
      <h1 class="detalle__titulo">${esc(num)} <span class="estado estado--${esc(t.estado)}">${esc(ETIQUETA_ESTADO[t.estado])}</span></h1>
      ${t.estado === 'publicado' && t.numero_publico ? `<a class="enlace" href="${esc(rutaFicha(t.numero_publico))}" target="_blank" rel="noopener">Ver ficha pública ↗</a>` : ''}
    </div>
    <p class="detalle__meta">Recibido: ${esc(fechaHora(t.creado_en))}${t.publicado_en ? ` · Publicado: ${esc(fechaHora(t.publicado_en))}` : ''}${t.pais_ip ? ` · País (IP): ${esc(t.pais_ip)}` : ''}</p>
    <p class="aviso" id="aviso" role="status" hidden></p>
    ${t.alertas.length ? `<p class="detalle__alertas">Alertas automáticas: ${alertasHtml(t.alertas)}</p>` : ''}

    <section class="bloque">
      <h2 class="bloque__titulo">Contacto (privado, no se publica)</h2>
      <p class="contacto"><code>${esc(t.contacto)}</code> <button class="boton boton--chico" type="button" data-accion="copiar-contacto">Copiar</button></p>
    </section>

    <form class="bloque formulario" data-form="detalle" novalidate>
      <h2 class="bloque__titulo">Lo que se publica</h2>
      <label class="campo"><span>Categoría</span><select name="categoria">${opciones}</select></label>
      <label class="campo" data-fila-otra ${t.categoria === 'otro' ? '' : 'hidden'}><span>Categoría escrita (máx. 23)</span><input name="categoria_otra" maxlength="23" value="${esc(t.categoria_otra ?? '')}"></label>
      <label class="campo"><span>Nombre público</span><input name="nombre_publico" maxlength="120" value="${esc(t.nombre_publico)}" ${t.es_anonimo ? 'readonly' : ''}></label>
      <p class="campo__ayuda">${t.es_anonimo ? 'Testimonio anónimo: se publica como «Anónimo».' : '<button class="boton boton--chico" type="button" data-accion="anonimizar">Anonimizar</button>'}</p>
      <label class="campo"><span>Frase destacada (máx. 120)</span><input name="frase_destacada" maxlength="120" value="${esc(t.frase_destacada ?? '')}"></label>
      <label class="campo"><span>Testimonio <small data-contador="testimonio">${t.testimonio.length}/400</small></span><textarea name="testimonio" rows="7" maxlength="400">${esc(t.testimonio)}</textarea></label>
      <label class="campo"><span>Consecuencias <small data-contador="consecuencias">${t.consecuencias.length}/160</small></span><textarea name="consecuencias" rows="4" maxlength="160">${esc(t.consecuencias)}</textarea></label>

      <h2 class="bloque__titulo">Revisión</h2>
      <label class="casilla"><input type="checkbox" name="residencia_verificada" ${t.residencia_verificada ? 'checked' : ''}> Residencia verificada</label>
      <label class="casilla"><input type="checkbox" name="contenido_sensible" ${t.contenido_sensible ? 'checked' : ''}> Contenido sensible (aviso en la ficha y revisión reforzada)</label>
      <label class="casilla" data-fila-reforzada ${t.contenido_sensible ? '' : 'hidden'}><input type="checkbox" name="revision_reforzada_ok" ${t.revision_reforzada_ok ? 'checked' : ''}> Revisión reforzada hecha</label>
      <label class="casilla"><input type="checkbox" name="documentacion_revisada" ${t.documentacion_revisada ? 'checked' : ''}> Documentación revisada (la ficha mostrará «Documentación revisada»)</label>
    </form>

    <section class="bloque">
      <h2 class="bloque__titulo">Archivos (${d.archivos.length})</h2>
      ${d.archivos.length ? `<ul class="archivos">${d.archivos.map(archivoHtml).join('')}</ul>` : '<p class="vacio">Esta persona no adjuntó archivos.</p>'}
      <p class="campo__ayuda">Los originales son privados. «Aprobar y hacer público» publica una copia tal cual: si tiene datos personales, sube antes una versión editada.</p>
      <label class="boton boton--chico">Añadir archivo público (foto, PDF o vídeo)<input type="file" class="sr-only" id="anadir-archivo" accept="${TIPOS_ADMIN.join(',')}"></label>
    </section>

    <section class="bloque">
      <div class="faltan" id="faltan">${faltan.length && publicable ? `<p>Para publicar falta:</p><ul>${faltan.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>
      <div class="acciones">${botones.join('')}</div>
    </section>

    <section class="bloque">
      <h2 class="bloque__titulo">Registro de acciones</h2>
      ${registro}
    </section>
  </main>`;
}

function dibujar(): void {
  const r = raiz!;
  const vistas: Record<Vista, () => string> = {
    cargando: () => '<p class="vacio">Cargando…</p>',
    login: () => vistaLogin(),
    mfa_alta: () => vistaMfaAlta(),
    mfa_codigo: () => vistaMfaCodigo(),
    sin_permiso: vistaSinPermiso,
    lista: vistaLista,
    detalle: vistaDetalle,
  };
  r.innerHTML = vistas[e.vista]();
  if (e.aviso) avisar(e.aviso.tipo, e.aviso.texto);
}

// =====================================================================
// Carga de datos
// =====================================================================

async function irASesion(): Promise<void> {
  let s: EstadoSesion;
  try {
    s = await api.sesion();
  } catch (error) {
    e.vista = 'login';
    dibujar();
    avisar('error', mensajeError(error));
    return;
  }
  e.aviso = null;
  if (s.estado === 'sin_sesion') e.vista = 'login';
  else if (s.estado === 'sin_permiso') { e.email = s.email; e.vista = 'sin_permiso'; }
  else if (s.estado === 'mfa_codigo') { e.email = s.email; e.factorId = s.factorId; e.vista = 'mfa_codigo'; }
  else if (s.estado === 'mfa_alta') {
    e.email = s.email;
    e.vista = 'mfa_alta';
    e.mfa = null;
    dibujar();
    try {
      const alta = await api.mfaAlta();
      e.factorId = alta.factorId;
      e.mfa = { qr: alta.qr, secreto: alta.secreto };
    } catch (error) {
      dibujar();
      avisar('error', mensajeError(error));
      return;
    }
  } else {
    e.email = s.email;
    e.vista = 'lista';
    dibujar();
    await cargarLista(true);
    return;
  }
  dibujar();
}

async function cargarLista(reiniciar: boolean): Promise<void> {
  await haciendo(reiniciar ? 'Cargando…' : '', async () => {
    const desde = reiniciar ? 0 : e.filas.length;
    const [lista, cuentas] = await Promise.all([
      api.listar({ grupo: e.grupo, sub: e.sub, q: e.q, desde, limite: POR_PAGINA }),
      api.contar(),
    ]);
    e.filas = reiniciar ? lista.filas : [...e.filas, ...lista.filas];
    e.total = lista.total;
    e.cuentas = cuentas;
    if (reiniciar) e.seleccion.clear();
    e.vista = 'lista';
    dibujar();
  });
}

async function abrirDetalle(id: string, conservarAviso = false): Promise<void> {
  await haciendo('', async () => {
    e.detalle = await api.detalle(id);
    e.vista = 'detalle';
    if (!conservarAviso) e.aviso = null;
    dibujar();
    window.scrollTo(0, 0);
  });
}

// =====================================================================
// Formulario de detalle
// =====================================================================

function leerFormulario(): CambiosTestimonio {
  const f = raiz!.querySelector<HTMLFormElement>('[data-form="detalle"]')!;
  const val = (n: string): string => (f.elements.namedItem(n) as HTMLInputElement | HTMLTextAreaElement).value;
  const marca = (n: string): boolean => (f.elements.namedItem(n) as HTMLInputElement).checked;
  const categoria = val('categoria');
  return {
    categoria,
    categoria_otra: categoria === 'otro' ? val('categoria_otra').trim() : null,
    nombre_publico: val('nombre_publico').trim(),
    frase_destacada: val('frase_destacada').trim() || null,
    testimonio: val('testimonio').trim(),
    consecuencias: val('consecuencias').trim(),
    residencia_verificada: marca('residencia_verificada'),
    contenido_sensible: marca('contenido_sensible'),
    revision_reforzada_ok: marca('revision_reforzada_ok'),
    documentacion_revisada: marca('documentacion_revisada'),
  };
}

function actualizarDependencias(): void {
  const c = leerFormulario();
  raiz!.querySelector<HTMLElement>('[data-fila-otra]')!.hidden = c.categoria !== 'otro';
  raiz!.querySelector<HTMLElement>('[data-fila-reforzada]')!.hidden = !c.contenido_sensible;
  const t = e.detalle!.testimonio;
  const faltan = faltanParaPublicar({
    frase_destacada: c.frase_destacada ?? null,
    residencia_verificada: Boolean(c.residencia_verificada),
    contenido_sensible: Boolean(c.contenido_sensible),
    revision_reforzada_ok: Boolean(c.revision_reforzada_ok),
  });
  const publicable = t.estado === 'recibido' || t.estado === 'en_revision' || t.estado === 'retirado';
  const caja = raiz!.querySelector<HTMLElement>('#faltan');
  if (caja) caja.innerHTML = faltan.length && publicable ? `<p>Para publicar falta:</p><ul>${faltan.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  const boton = raiz!.querySelector<HTMLButtonElement>('[data-accion="publicar"]');
  if (boton) boton.disabled = faltan.length > 0;
  for (const n of ['testimonio', 'consecuencias'] as const) {
    const campo = (raiz!.querySelector<HTMLFormElement>('[data-form="detalle"]')!.elements.namedItem(n) as HTMLTextAreaElement);
    const cont = raiz!.querySelector<HTMLElement>(`[data-contador="${n}"]`);
    if (cont) cont.textContent = `${campo.value.length}/${n === 'testimonio' ? 400 : 160}`;
  }
}

// =====================================================================
// Imágenes de vista previa
// =====================================================================

async function generarYSubirImagen(t: TestimonioAdmin): Promise<void> {
  if (!t.numero_publico) return;
  const { generarImagenVistaPrevia } = await import('../lib/imagen-historia');
  const blob = await generarImagenVistaPrevia({
    numero: numeroTexto(t.numero_publico),
    fecha: fechaCorta(t.publicado_en ?? new Date().toISOString()),
    categoria: categoriaTexto(t),
    color: colorCategoria(t.categoria),
    frase: t.frase_destacada ?? '',
    autor: t.nombre_publico,
    sensible: t.contenido_sensible,
  });
  await api.subirVistaPrevia(t.numero_publico, blob);
}

// =====================================================================
// Acciones
// =====================================================================

async function guardar(silencioso = false): Promise<boolean> {
  const d = e.detalle!;
  const ok = await haciendo(silencioso ? '' : 'Guardando…', async () => {
    await api.guardar(d.testimonio.id, leerFormulario());
  });
  if (!ok) return false;
  e.detalle = await api.detalle(d.testimonio.id);
  if (!silencioso) {
    // Si ya está publicado, la imagen de vista previa se renueva con los cambios
    if (e.detalle.testimonio.estado === 'publicado') await generarYSubirImagen(e.detalle.testimonio).catch(() => undefined);
    dibujar();
    avisar('ok', 'Cambios guardados.');
  }
  return true;
}

async function publicar(): Promise<void> {
  const d = e.detalle!;
  if (!(await guardar(true))) return;
  let numero = 0;
  const ok = await haciendo('Publicando…', async () => {
    numero = await api.publicar(d.testimonio.id);
  });
  if (!ok) {
    e.detalle = await api.detalle(d.testimonio.id);
    dibujar();
    return;
  }
  e.detalle = await api.detalle(d.testimonio.id);
  let imagenOk = true;
  await haciendo('Publicado. Creando la imagen de vista previa…', async () => {
    try {
      await generarYSubirImagen(e.detalle!.testimonio);
    } catch (error) {
      imagenOk = false;
      console.error('Error al crear la imagen de vista previa:', error);
    }
  });
  dibujar();
  avisar(
    imagenOk ? 'ok' : 'error',
    imagenOk
      ? `Publicado como ${numeroTexto(numero)}. Ya aparece en la web y en el contador.`
      : `Publicado como ${numeroTexto(numero)}, pero no se pudo crear la imagen de vista previa. Pulsa «Regenerar imágenes de compartir».`,
  );
}

async function accionDetalle(accion: string): Promise<void> {
  const d = e.detalle!;
  const t = d.testimonio;
  switch (accion) {
    case 'volver':
      e.vista = 'lista';
      e.aviso = null;
      await cargarLista(true);
      break;
    case 'guardar':
      await guardar();
      break;
    case 'publicar':
      await publicar();
      break;
    case 'rechazar':
      if (await haciendo('Rechazando…', () => api.rechazar([t.id]))) {
        e.aviso = { tipo: 'ok', texto: 'Testimonio rechazado.' };
        e.vista = 'lista';
        await cargarLista(true);
      }
      break;
    case 'retirar':
      if (!window.confirm('¿Retirar este testimonio? Dejará de verse en la web y se descontará del contador.')) return;
      if (await haciendo('Retirando…', () => api.retirar(t.id))) await abrirDetalle(t.id, true).then(() => avisar('ok', 'Testimonio retirado.'));
      break;
    case 'pendiente':
      if (await haciendo('', () => api.volverAPendientes(t.id))) await abrirDetalle(t.id, true).then(() => avisar('ok', 'Vuelve a estar pendiente.'));
      break;
    case 'eliminar':
      if (!window.confirm('¿Eliminar para siempre este testimonio y todos sus archivos? No se puede deshacer.')) return;
      if (await haciendo('Eliminando…', () => api.eliminar(t.id))) {
        e.aviso = { tipo: 'ok', texto: 'Testimonio eliminado.' };
        e.vista = 'lista';
        await cargarLista(true);
      }
      break;
    case 'anonimizar':
      if (await haciendo('', () => api.guardar(t.id, { es_anonimo: true, nombre_publico: 'Anónimo' }))) {
        await abrirDetalle(t.id, true);
        avisar('ok', 'Anonimizado: se publicará como «Anónimo».');
      }
      break;
    case 'regenerar':
      if (await haciendo('Creando la imagen…', () => generarYSubirImagen(t))) avisar('ok', 'Imagen de vista previa actualizada.');
      break;
    case 'copiar-contacto':
      try {
        await navigator.clipboard.writeText(t.contacto);
        avisar('ok', 'Contacto copiado.');
      } catch {
        avisar('error', 'No se pudo copiar. Selecciónalo y cópialo a mano.');
      }
      break;
  }
}

async function accionArchivo(tipo: string, id: string): Promise<void> {
  const a = e.detalle!.archivos.find((x) => x.id === id);
  if (!a) return;
  const recargar = async (texto: string) => {
    e.detalle = await api.detalle(a.testimonio_id);
    dibujar();
    avisar('ok', texto);
  };
  if (tipo === 'ver') {
    await haciendo('', async () => {
      const url = a.es_publico && a.ruta_publica ? api.urlPublica(a.ruta_publica) : await api.urlPrivada(a.ruta_privada);
      mostrarArchivo(url, a.tipo_mime);
    });
  } else if (tipo === 'publicar') {
    if (!window.confirm('Se publicará una copia de este archivo TAL CUAL. ¿Seguro que no contiene datos personales innecesarios?')) return;
    if (await haciendo('Publicando archivo…', () => api.aprobarPublico(a))) await recargar('Archivo aprobado y público.');
  } else if (tipo === 'quitar') {
    if (await haciendo('', () => api.quitarPublico(a, 'aprobado'))) await recargar('El archivo ya no es público.');
  } else if (tipo === 'rechazar') {
    if (await haciendo('', () => api.quitarPublico(a, 'rechazado'))) await recargar('Archivo rechazado.');
  } else if (tipo === 'version') {
    raiz!.querySelector<HTMLInputElement>(`[data-input-version="${CSS.escape(id)}"]`)?.click();
  }
}

function mostrarArchivo(url: string, mime: string): void {
  if (mime === 'application/pdf') {
    window.open(url, '_blank', 'noopener');
    return;
  }
  let visor = document.getElementById('visor-admin') as HTMLDialogElement | null;
  if (!visor) {
    visor = document.createElement('dialog');
    visor.id = 'visor-admin';
    visor.className = 'visor-admin';
    visor.innerHTML = '<button type="button" class="visor-admin__cerrar" aria-label="Cerrar">×</button><div class="visor-admin__contenido"></div>';
    document.body.append(visor);
    visor.querySelector('button')!.addEventListener('click', () => visor!.close());
    visor.addEventListener('click', (ev) => { if (ev.target === visor) visor!.close(); });
    visor.addEventListener('close', () => visor!.querySelector('.visor-admin__contenido')!.replaceChildren());
  }
  const contenido = visor.querySelector('.visor-admin__contenido')!;
  contenido.replaceChildren();
  if (mime.startsWith('video/')) {
    const v = document.createElement('video');
    v.src = url; v.controls = true; v.playsInline = true;
    contenido.append(v);
  } else {
    const i = document.createElement('img');
    i.src = url; i.alt = 'Archivo adjunto';
    contenido.append(i);
  }
  visor.showModal();
}

// =====================================================================
// Eventos
// =====================================================================

async function iniciar(r: HTMLElement): Promise<void> {
  dibujar();

  r.addEventListener('click', (ev) => {
    const el = ev.target as HTMLElement;
    const g = el.closest<HTMLElement>('[data-grupo]');
    if (g) { e.grupo = g.dataset.grupo as Grupo; e.sub = 'todos'; e.aviso = null; void cargarLista(true); return; }
    const s = el.closest<HTMLElement>('[data-sub]');
    if (s) { e.sub = s.dataset.sub as Subfiltro; void cargarLista(true); return; }
    const abrir = el.closest<HTMLElement>('[data-abrir]');
    if (abrir) { void abrirDetalle(abrir.dataset.abrir!); return; }
    for (const [attr, tipo] of [['archivoVer', 'ver'], ['archivoPublicar', 'publicar'], ['archivoQuitar', 'quitar'], ['archivoRechazar', 'rechazar'], ['archivoVersion', 'version']] as const) {
      const b = el.closest<HTMLElement>(`[data-archivo-${tipo}]`);
      if (b) { void accionArchivo(tipo, b.dataset[attr]!); return; }
    }
    const acc = el.closest<HTMLElement>('[data-accion]');
    if (!acc) return;
    const accion = acc.dataset.accion!;
    if (accion === 'salir') { void api.salir().then(() => { e.cuentas = null; e.filas = []; void irASesion(); }); return; }
    if (accion === 'mas') { void cargarLista(false); return; }
    if (accion === 'rechazar-seleccion') {
      const ids = [...e.seleccion];
      if (!window.confirm(`¿Rechazar ${ids.length} testimonio(s)?`)) return;
      void haciendo('Rechazando…', () => api.rechazar(ids)).then((ok) => { if (ok) { e.aviso = { tipo: 'ok', texto: `${ids.length} rechazado(s).` }; void cargarLista(true); } });
      return;
    }
    if (accion === 'limpiar-rechazados') {
      if (!window.confirm('¿Borrar para siempre los testimonios rechazados hace más de 30 días, con sus archivos?')) return;
      void haciendo('Limpiando…', async () => {
        const n = await api.limpiarRechazados(30);
        e.aviso = { tipo: 'ok', texto: n ? `${n} testimonio(s) borrado(s).` : 'No había nada que borrar.' };
      }).then(() => cargarLista(true));
      return;
    }
    void accionDetalle(accion);
  });

  r.addEventListener('change', (ev) => {
    const el = ev.target as HTMLInputElement;
    if (el.matches('[data-sel]')) {
      if (el.checked) e.seleccion.add(el.value); else e.seleccion.delete(el.value);
      const barra = r.querySelector('.acciones-lista');
      if (e.vista === 'lista' && e.grupo === 'pendientes') {
        // se redibuja solo la barra de acciones
        const main = r.querySelector('.panel')!;
        let b = barra as HTMLElement | null;
        if (!b) { b = document.createElement('div'); b.className = 'acciones-lista'; main.querySelector('.busqueda')!.after(b); }
        b.innerHTML = e.seleccion.size ? `<button class="boton boton--peligro" type="button" data-accion="rechazar-seleccion">Rechazar seleccionados (${e.seleccion.size})</button>` : '';
        if (!e.seleccion.size) b.remove();
      }
      return;
    }
    if (el.matches('[data-input-version]') && el.files?.[0]) {
      const a = e.detalle!.archivos.find((x) => x.id === el.dataset.inputVersion);
      const archivo = el.files[0];
      if (a) void haciendo('Subiendo versión editada…', () => api.subirVersionPublica(a, archivo)).then(async (ok) => {
        if (ok) { e.detalle = await api.detalle(a.testimonio_id); dibujar(); avisar('ok', 'Versión editada publicada.'); }
      });
      return;
    }
    if (el.id === 'anadir-archivo' && el.files?.[0]) {
      const archivo = el.files[0];
      const id = e.detalle!.testimonio.id;
      void haciendo('Subiendo archivo…', () => api.anadirArchivoPublico(id, archivo)).then(async (ok) => {
        if (ok) { e.detalle = await api.detalle(id); dibujar(); avisar('ok', 'Archivo añadido y público.'); }
      });
      return;
    }
    if (e.vista === 'detalle' && el.closest('[data-form="detalle"]')) actualizarDependencias();
  });

  r.addEventListener('input', (ev) => {
    if (e.vista === 'detalle' && (ev.target as HTMLElement).closest('[data-form="detalle"]')) actualizarDependencias();
  });

  r.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const form = ev.target as HTMLFormElement;
    const tipo = form.dataset.form;
    const campos = new FormData(form);
    if (tipo === 'login') {
      const email = String(campos.get('email') ?? '').trim();
      const clave = String(campos.get('clave') ?? '');
      void haciendo('Entrando…', () => api.entrar(email, clave)).then((ok) => { if (ok) void irASesion(); });
    } else if (tipo === 'mfa') {
      const codigo = String(campos.get('codigo') ?? '');
      void haciendo('Comprobando…', () => api.mfaVerificar(e.factorId, codigo)).then((ok) => { if (ok) void irASesion(); });
    } else if (tipo === 'buscar') {
      e.q = String(campos.get('q') ?? '').trim();
      void cargarLista(true);
    }
  });

  await irASesion();
}
