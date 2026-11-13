/**
 * VOZ CABALLA · lib/formulario-reglas.ts
 * Reglas del formulario en un solo sitio. Si quieres cambiar un límite, es aquí.
 * Estas reglas se repetirán en el servidor cuando conectemos el envío
 * (el navegador se puede saltar, el servidor no).
 */
export const REGLAS = {
  /** Máximos que marca tu diseño. */
  testimonioMax: 400,
  consecuenciasMax: 160,
  categoriaOtraMax: 23,
  nombreMax: 60,
  apellidosMax: 80,
  /** Mínimos contra mensajes de broma (capa 2 del sistema antitroleo). Se pueden ajustar. */
  testimonioMin: 120,
  consecuenciasMin: 30,
  /** Archivos. */
  archivosMax: 5,
  archivoMaxBytes: 10 * 1024 * 1024, // 10 MB
  tiposArchivo: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
};

/** ¿Parece un correo electrónico? */
function esCorreo(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor);
}

/** ¿Parece un teléfono? Acepta espacios, guiones, paréntesis y prefijo +. */
function esTelefono(valor: string): boolean {
  if (!/^\+?[\d\s().-]+$/.test(valor)) return false;
  const digitos = valor.replace(/\D/g, '');
  return digitos.length >= 9 && digitos.length <= 15;
}

export function esContactoValido(valor: string): boolean {
  const v = valor.trim();
  return esCorreo(v) || esTelefono(v);
}

export function formatearBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / (1024 * 1024);
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1).replace('.', ',')} MB`;
}
