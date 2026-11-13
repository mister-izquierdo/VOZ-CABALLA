/**
 * VOZ CABALLA · scripts/header-scroll.ts
 * Convierte el scroll en un valor --p (0 = cabecera expandida, 1 = compacta).
 * El CSS (styles/header.css) hace el resto: mueve y escala el logotipo y los contadores.
 */

/** Unidades de lienzo que se encoge la cabecera (450 - 240). Debe coincidir con header.css. */
const RANGO_UNIDADES = 210;
/** Ancho máximo de la columna en px. Debe coincidir con --u en tokens.css. */
const ANCHO_MAXIMO = 520;

const cabecera = document.querySelector<HTMLElement>('[data-site-header]');

if (cabecera) {
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)');
  let pendiente = false;

  const rangoEnPx = (): number => {
    const u = Math.min(window.innerWidth, ANCHO_MAXIMO) / 1080;
    return RANGO_UNIDADES * u;
  };

  const actualizar = (): void => {
    pendiente = false;
    const scroll = Math.max(0, window.scrollY); // evita valores negativos del "rebote" de iOS
    let p = Math.min(1, scroll / rangoEnPx());
    // Si la persona pide menos movimiento, la cabecera salta de un estado a otro.
    if (sinMovimiento.matches) p = scroll > 8 ? 1 : 0;
    cabecera.style.setProperty('--p', p.toFixed(4));
  };

  const programar = (): void => {
    if (pendiente) return;
    pendiente = true;
    window.requestAnimationFrame(actualizar); // como mucho una actualización por fotograma
  };

  window.addEventListener('scroll', programar, { passive: true });
  window.addEventListener('resize', programar);
  actualizar();
}
