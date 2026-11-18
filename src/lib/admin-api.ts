/**
 * VOZ CABALLA · lib/admin-api.ts
 * Todo lo que el panel de administración le pide a Supabase, en un solo sitio.
 * La seguridad NO depende de este código: la base de datos solo contesta a una sesión de
 * administrador con verificación en dos pasos (ver migración 0004). Si alguien manipulara
 * esta página, Supabase seguiría negándole los datos.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.PUBLIC_SUPABASE_KEY as string | undefined;

export type EstadoTestimonio = 'recibido' | 'en_revision' | 'publicado' | 'rechazado' | 'retirado';
export type Grupo = 'pendientes' | 'publicados' | 'rechazados' | 'retirados';
export type Subfiltro = 'todos' | 'limpios' | 'archivos' | 'sospechosos';

export interface FilaAdmin {
  id: string;
  numero_publico: number | null;
  estado: EstadoTestimonio;
  categoria: string;
  categoria_otra: string | null;
  nombre_publico: string;
  contacto: string;
  alertas: string[];
  contenido_sensible: boolean;
  creado_en: string;
  publicado_en: string | null;
  archivos: number;
}

export interface TestimonioAdmin extends Omit<FilaAdmin, 'archivos'> {
  es_anonimo: boolean;
  testimonio: string;
  consecuencias: string;
  frase_destacada: string | null;
  revision_reforzada_ok: boolean;
  residencia_verificada: boolean;
  documentacion_revisada: boolean;
  pais_ip: string | null;
  actualizado_en: string;
  retirado_en: string | null;
}

export type CambiosTestimonio = Partial<
  Pick<
    TestimonioAdmin,
    | 'categoria' | 'categoria_otra' | 'es_anonimo' | 'nombre_publico' | 'testimonio' | 'consecuencias'
    | 'frase_destacada' | 'contenido_sensible' | 'revision_reforzada_ok' | 'residencia_verificada'
    | 'documentacion_revisada'
  >
>;

export interface ArchivoAdmin {
  id: string;
  testimonio_id: string;
  ruta_privada: string;
  nombre_original: string | null;
  tipo_mime: string;
  tamano_bytes: number;
  estado_revision: 'pendiente' | 'aprobado' | 'rechazado';
  es_publico: boolean;
  ruta_publica: string | null;
  creado_en: string;
}

export interface RegistroAdmin {
  id: number;
  accion: string;
  detalle: Record<string, unknown>;
  creado_en: string;
}

export interface DetalleAdmin {
  testimonio: TestimonioAdmin;
  archivos: ArchivoAdmin[];
  registro: RegistroAdmin[];
}

export interface FiltroLista {
  grupo: Grupo;
  sub: Subfiltro;
  q: string;
  desde: number;
  limite: number;
}

export type EstadoSesion =
  | { estado: 'sin_sesion' }
  | { estado: 'sin_permiso'; email: string }
  | { estado: 'mfa_alta'; email: string }
  | { estado: 'mfa_codigo'; email: string; factorId: string }
  | { estado: 'ok'; email: string };

const ESTADOS_DE: Record<Grupo, EstadoTestimonio[]> = {
  pendientes: ['recibido', 'en_revision'],
  publicados: ['publicado'],
  rechazados: ['rechazado'],
  retirados: ['retirado'],
};

export const TIPOS_ADMIN = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4', 'video/webm'];
export const MAX_ARCHIVO_ADMIN = 50 * 1024 * 1024;
const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'application/pdf': 'pdf', 'video/mp4': 'mp4', 'video/webm': 'webm',
};

let cliente: SupabaseClient | null = null;
function c(): SupabaseClient {
  if (!URL || !KEY) throw new Error('Falta la configuración de Supabase en el archivo .env');
  cliente ??= createClient(URL, KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'voz-caballa-admin' },
  });
  return cliente;
}

/** Convierte los errores técnicos de la base de datos en mensajes comprensibles. */
export function mensajeError(error: unknown): string {
  const texto = String((error as { message?: string })?.message ?? error ?? '');
  if (texto.includes('testimonios_texto_valido')) return 'El testimonio debe tener entre 1 y 400 caracteres.';
  if (texto.includes('testimonios_consecuencias_validas')) return 'Las consecuencias deben tener entre 1 y 160 caracteres.';
  if (texto.includes('testimonios_frase_valida')) return 'La frase destacada puede tener hasta 120 caracteres.';
  if (texto.includes('testimonios_categoria_otra_coherente')) return 'En «Otro» hay que escribir la categoría (máximo 23 caracteres); en las demás, debe quedar vacía.';
  if (texto.includes('testimonios_anonimo_coherente')) return 'Un testimonio anónimo debe llevar el nombre «Anónimo».';
  if (texto.includes('testimonios_nombre_valido')) return 'El nombre público debe tener entre 1 y 120 caracteres.';
  if (texto.includes('testimonios_publicado_completo')) return 'Un testimonio publicado debe seguir cumpliendo los requisitos (frase, residencia y, si es sensible, revisión reforzada).';
  if (/jwt|permission denied|row-level security|not authorized|No autorizado/i.test(texto)) return 'Tu sesión ha caducado o no tienes permiso. Vuelve a entrar.';
  return texto || 'Ha ocurrido un error.';
}

function chk<T>(resultado: { data: T | null; error: unknown }): T {
  if (resultado.error) throw new Error(mensajeError(resultado.error));
  return resultado.data as T;
}

const nombreOg = (numero: number): string => `og/${String(numero).padStart(3, '0')}.png`;

export const api = {
  // ---------------------------------------------------------------- acceso
  async sesion(): Promise<EstadoSesion> {
    const { data } = await c().auth.getSession();
    if (!data.session) return { estado: 'sin_sesion' };
    const email = data.session.user.email ?? '';
    const { data: esAdmin } = await c().rpc('es_admin_sin_mfa');
    if (!esAdmin) return { estado: 'sin_permiso', email };

    const { data: nivel } = await c().auth.mfa.getAuthenticatorAssuranceLevel();
    if (nivel?.currentLevel === 'aal2') return { estado: 'ok', email };
    if (nivel?.nextLevel === 'aal2') {
      const { data: factores } = await c().auth.mfa.listFactors();
      const factor = factores?.totp?.[0];
      if (factor) return { estado: 'mfa_codigo', email, factorId: factor.id };
    }
    return { estado: 'mfa_alta', email };
  },

  async entrar(email: string, clave: string): Promise<void> {
    const { error } = await c().auth.signInWithPassword({ email, password: clave });
    if (error) throw new Error('Correo o contraseña incorrectos.');
  },

  async salir(): Promise<void> {
    await c().auth.signOut();
  },

  async mfaAlta(): Promise<{ factorId: string; qr: string; secreto: string }> {
    // Se limpian intentos anteriores sin terminar
    const { data: factores } = await c().auth.mfa.listFactors();
    for (const f of factores?.all ?? []) {
      if (f.status === 'unverified') await c().auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await c().auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Panel VOZ CABALLA ${Date.now()}`,
    });
    if (error || !data) throw new Error(mensajeError(error));
    return { factorId: data.id, qr: data.totp.qr_code, secreto: data.totp.secret };
  },

  async mfaVerificar(factorId: string, codigo: string): Promise<void> {
    const { data: reto, error: e1 } = await c().auth.mfa.challenge({ factorId });
    if (e1 || !reto) throw new Error(mensajeError(e1));
    const { error: e2 } = await c().auth.mfa.verify({ factorId, challengeId: reto.id, code: codigo.trim() });
    if (e2) throw new Error('El código no es correcto. Prueba con el siguiente que muestre tu aplicación.');
  },

  // ---------------------------------------------------------------- listas
  async contar(): Promise<Record<Grupo, number>> {
    const grupos = Object.keys(ESTADOS_DE) as Grupo[];
    const cuentas = await Promise.all(
      grupos.map(async (g) => {
        const { count, error } = await c()
          .from('testimonios')
          .select('id', { count: 'exact', head: true })
          .in('estado', ESTADOS_DE[g]);
        if (error) throw new Error(mensajeError(error));
        return [g, count ?? 0] as const;
      }),
    );
    return Object.fromEntries(cuentas) as Record<Grupo, number>;
  },

  async listar(f: FiltroLista): Promise<{ filas: FilaAdmin[]; total: number }> {
    const columnas =
      'id, numero_publico, estado, categoria, categoria_otra, nombre_publico, contacto, alertas, contenido_sensible, creado_en, publicado_en';
    let q = c()
      .from('testimonios')
      .select(`${columnas}, ${f.sub === 'archivos' ? 'archivos!inner(id)' : 'archivos(id)'}`, { count: 'exact' })
      .in('estado', ESTADOS_DE[f.grupo])
      .order(f.grupo === 'publicados' ? 'publicado_en' : 'creado_en', { ascending: f.grupo === 'pendientes' })
      .range(f.desde, f.desde + f.limite - 1);

    if (f.sub === 'limpios') q = q.eq('alertas', '{}');
    if (f.sub === 'sospechosos') q = q.overlaps('alertas', ['ofensivo', 'mayusculas', 'repeticion']);
    const texto = f.q.replace(/[,()%*\\]/g, ' ').trim();
    if (texto) {
      q = q.or(
        `nombre_publico.ilike.%${texto}%,testimonio.ilike.%${texto}%,contacto.ilike.%${texto}%,frase_destacada.ilike.%${texto}%`,
      );
    }
    const { data, error, count } = await q;
    if (error) throw new Error(mensajeError(error));
    const filas = ((data ?? []) as unknown as (Omit<FilaAdmin, 'archivos'> & { archivos: { id: string }[] })[]).map((x) => ({
      ...x,
      archivos: x.archivos?.length ?? 0,
    }));
    return { filas, total: count ?? 0 };
  },

  async detalle(id: string): Promise<DetalleAdmin> {
    const [t, a, r] = await Promise.all([
      c().from('testimonios').select('*').eq('id', id).single(),
      c().from('archivos').select('*').eq('testimonio_id', id).order('creado_en'),
      c().from('registro_admin').select('id, accion, detalle, creado_en').eq('testimonio_id', id).order('creado_en', { ascending: false }).limit(30),
    ]);
    return {
      testimonio: chk(t) as TestimonioAdmin,
      archivos: (chk(a) ?? []) as ArchivoAdmin[],
      registro: (chk(r) ?? []) as RegistroAdmin[],
    };
  },

  // ------------------------------------------------------------- acciones
  async guardar(id: string, cambios: CambiosTestimonio): Promise<void> {
    chk(await c().from('testimonios').update(cambios).eq('id', id));
  },

  async publicar(id: string): Promise<number> {
    return chk(await c().rpc('publicar_testimonio', { p_id: id })) as number;
  },

  async retirar(id: string): Promise<void> {
    chk(await c().rpc('retirar_testimonio', { p_id: id }));
  },

  async rechazar(ids: string[]): Promise<void> {
    chk(await c().from('testimonios').update({ estado: 'rechazado' }).in('id', ids));
  },

  async volverAPendientes(id: string): Promise<void> {
    chk(await c().from('testimonios').update({ estado: 'recibido', retirado_en: null }).eq('id', id));
  },

  /** Borra el testimonio y TODOS sus archivos (privados, públicos e imagen de vista previa). */
  async eliminar(id: string): Promise<void> {
    const { data: t } = await c().from('testimonios').select('numero_publico').eq('id', id).maybeSingle();
    const archivos = chk(await c().from('archivos').select('ruta_privada, ruta_publica, es_publico').eq('testimonio_id', id)) as Pick<ArchivoAdmin, 'ruta_privada' | 'ruta_publica' | 'es_publico'>[];

    const privadas = (archivos ?? []).map((a) => a.ruta_privada).filter((r) => !r.startsWith('admin/'));
    const publicas = (archivos ?? []).map((a) => a.ruta_publica).filter((r): r is string => Boolean(r));
    if (privadas.length) await c().storage.from('documentos-privados').remove(privadas);
    if (publicas.length) await c().storage.from('documentos-publicos').remove(publicas);
    if (t?.numero_publico) await c().storage.from('imagenes-compartir').remove([nombreOg(t.numero_publico as number)]);

    chk(await c().from('testimonios').delete().eq('id', id));
  },

  /** Borra los rechazados de hace más de `dias` días. Devuelve cuántos. */
  async limpiarRechazados(dias: number): Promise<number> {
    const limite = new Date(Date.now() - dias * 24 * 3600 * 1000).toISOString();
    const { data, error } = await c().from('testimonios').select('id').eq('estado', 'rechazado').lt('actualizado_en', limite);
    if (error) throw new Error(mensajeError(error));
    for (const fila of data ?? []) await api.eliminar(fila.id as string);
    return (data ?? []).length;
  },

  // ------------------------------------------------------------- archivos
  async urlPrivada(ruta: string): Promise<string> {
    const { data, error } = await c().storage.from('documentos-privados').createSignedUrl(ruta, 300);
    if (error || !data) throw new Error('No se pudo abrir el archivo.');
    return data.signedUrl;
  },

  urlPublica(ruta: string): string {
    return `${URL}/storage/v1/object/public/documentos-publicos/${ruta}`;
  },

  /** Aprueba un archivo y publica una copia TAL CUAL (el original sigue privado). */
  async aprobarPublico(a: ArchivoAdmin): Promise<void> {
    const destino = c().storage.from('documentos-publicos');
    const copia = await c().storage.from('documentos-privados').copy(a.ruta_privada, a.ruta_privada, { destinationBucket: 'documentos-publicos' });
    if (copia.error) {
      // Alternativa: descargar y volver a subir
      const { data: blob, error: e1 } = await c().storage.from('documentos-privados').download(a.ruta_privada);
      if (e1 || !blob) throw new Error('No se pudo copiar el archivo.');
      const { error: e2 } = await destino.upload(a.ruta_privada, blob, { contentType: a.tipo_mime, upsert: true });
      if (e2) throw new Error('No se pudo publicar el archivo.');
    }
    chk(await c().from('archivos').update({ estado_revision: 'aprobado', es_publico: true, ruta_publica: a.ruta_privada }).eq('id', a.id));
  },

  /** Deja de mostrar el archivo en la ficha (y borra su copia pública). */
  async quitarPublico(a: ArchivoAdmin, nuevoEstado: 'aprobado' | 'rechazado'): Promise<void> {
    if (a.ruta_publica) await c().storage.from('documentos-publicos').remove([a.ruta_publica]);
    chk(await c().from('archivos').update({ estado_revision: nuevoEstado, es_publico: false, ruta_publica: null }).eq('id', a.id));
  },

  /** Sustituye la copia pública por una versión editada (por ejemplo, con datos personales tapados). */
  async subirVersionPublica(a: ArchivoAdmin, archivo: File): Promise<void> {
    validarArchivoAdmin(archivo);
    const ruta = `${a.testimonio_id}/${crypto.randomUUID()}.${EXTENSION[archivo.type]}`;
    const { error } = await c().storage.from('documentos-publicos').upload(ruta, archivo, { contentType: archivo.type });
    if (error) throw new Error('No se pudo subir el archivo.');
    if (a.ruta_publica) await c().storage.from('documentos-publicos').remove([a.ruta_publica]);
    chk(await c().from('archivos').update({ estado_revision: 'aprobado', es_publico: true, ruta_publica: ruta, tipo_mime: archivo.type, tamano_bytes: archivo.size }).eq('id', a.id));
  },

  /** Añade un archivo público nuevo (foto, PDF o vídeo) a un testimonio. */
  async anadirArchivoPublico(testimonioId: string, archivo: File): Promise<void> {
    validarArchivoAdmin(archivo);
    const ruta = `${testimonioId}/${crypto.randomUUID()}.${EXTENSION[archivo.type]}`;
    const { error } = await c().storage.from('documentos-publicos').upload(ruta, archivo, { contentType: archivo.type });
    if (error) throw new Error('No se pudo subir el archivo.');
    chk(await c().from('archivos').insert({
      testimonio_id: testimonioId,
      ruta_privada: `admin/${crypto.randomUUID()}.${EXTENSION[archivo.type]}`,
      nombre_original: archivo.name.slice(0, 120),
      tipo_mime: archivo.type,
      tamano_bytes: archivo.size,
      estado_revision: 'aprobado',
      es_publico: true,
      ruta_publica: ruta,
    }));
  },

  // ----------------------------------------------- imagen de vista previa
  async subirVistaPrevia(numero: number, imagen: Blob): Promise<void> {
    const { error } = await c().storage.from('imagenes-compartir').upload(nombreOg(numero), imagen, {
      contentType: 'image/png',
      upsert: true,
      cacheControl: '300',
    });
    if (error) throw new Error('No se pudo guardar la imagen de vista previa.');
  },
};

function validarArchivoAdmin(archivo: File): void {
  if (!TIPOS_ADMIN.includes(archivo.type)) throw new Error('Formato no admitido (usa JPG, PNG, WebP, PDF, MP4 o WebM).');
  if (archivo.size > MAX_ARCHIVO_ADMIN) throw new Error('El archivo pesa más de 50 MB.');
}

export type Api = typeof api;
