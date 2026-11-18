/**
 * VOZ CABALLA · scripts/visor.ts
 * Visor a pantalla completa de los archivos de una ficha.
 * Las imágenes se amplían; los vídeos se reproducen solo al pulsar «play».
 */
const visor = document.getElementById('visor') as HTMLDialogElement | null;

if (visor) {
  const contenido = visor.querySelector<HTMLElement>('[data-visor-contenido]')!;

  document.addEventListener('click', (e) => {
    const boton = (e.target as HTMLElement).closest<HTMLElement>('[data-visor]');
    if (!boton) return;
    const { tipo, src } = boton.dataset;
    if (!src) return;

    contenido.replaceChildren();
    if (tipo === 'video') {
      const video = document.createElement('video');
      video.src = src;
      video.controls = true;
      video.playsInline = true;
      video.preload = 'metadata';
      contenido.append(video);
    } else {
      const imagen = document.createElement('img');
      imagen.src = src;
      imagen.alt = 'Archivo adjunto ampliado';
      contenido.append(imagen);
    }
    visor.showModal();
  });

  visor.querySelector('[data-visor-cerrar]')?.addEventListener('click', () => visor.close());
  visor.addEventListener('click', (e) => {
    if (e.target === visor || e.target === contenido) visor.close();
  });
  // Al cerrar se retira el contenido: así un vídeo deja de sonar
  visor.addEventListener('close', () => contenido.replaceChildren());
}
