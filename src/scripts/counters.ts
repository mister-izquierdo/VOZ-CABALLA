/**
 * VOZ CABALLA · scripts/counters.ts
 * Mantiene al día el contador de días en el navegador.
 * El contador de voces se pregunta a la base de datos (solo testimonios publicados).
 */
import { diasTranscurridos, etiquetaDias, etiquetaVoces } from '../lib/contadores';
import { contarVoces, vocesEnCache } from '../lib/voces';

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

function pintarVoces(n: number): void {
  document.querySelectorAll<HTMLElement>('[data-counter-voices]').forEach((el) => {
    el.textContent = String(n);
  });
  document.querySelectorAll<HTMLElement>('[data-counter-voices-label]').forEach((el) => {
    el.textContent = etiquetaVoces(n);
  });
}

async function actualizarVoces(): Promise<void> {
  const n = await contarVoces();
  if (n !== null) pintarVoces(n);
}

const guardado = vocesEnCache();
if (guardado !== null) pintarVoces(guardado);
void actualizarVoces();
// Se vuelve a preguntar cada 2 minutos y al volver a la pestaña
window.setInterval(() => void actualizarVoces(), 120_000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void actualizarVoces();
});
