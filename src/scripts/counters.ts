/**
 * VOZ CABALLA · scripts/counters.ts
 * Mantiene al día el contador de días en el navegador.
 * El contador de voces se conectará a la base de datos en el paso del panel
 * y los testimonios; por ahora muestra el valor que trae la página.
 */
import { diasTranscurridos, etiquetaDias } from '../lib/contadores';

function actualizarDias(): void {
  const dias = diasTranscurridos();
  document.querySelectorAll<HTMLElement>('[data-counter-days]').forEach((el) => {
    el.textContent = String(dias);
  });
  document.querySelectorAll<HTMLElement>('[data-counter-days-label]').forEach((el) => {
    el.textContent = etiquetaDias(dias);
  });
}

actualizarDias();
// Se revisa cada minuto, así cambia solo a medianoche aunque la página siga abierta.
window.setInterval(actualizarDias, 60_000);
