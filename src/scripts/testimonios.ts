/**
 * VOZ CABALLA · scripts/testimonios.ts
 * Página de Testimonios: búsqueda en vivo, categorías y «Ver más testimonios...»
 * sin recargar la página. Sin JavaScript, la página sigue funcionando con enlaces normales.
 */
const raiz = document.querySelector<HTMLElement>('[data-testimonios]');
if (raiz) iniciar(raiz);

function iniciar(raiz: HTMLElement): void {
  const lista = raiz.querySelector<HTMLElement>('[data-lista]')!;
  const formulario = raiz.querySelector<HTMLFormElement>('[data-buscador]')!;
  const campo = formulario.querySelector<HTMLInputElement>('input[name="q"]')!;
  const resumen = raiz.querySelector<HTMLElement>('[data-resumen]');
  const columna = lista.parentElement!;
  const chips = Array.from(raiz.querySelectorAll<HTMLAnchorElement>('[data-categoria]'));

  let categoria = new URLSearchParams(location.search).get('categoria') ?? '';
  let pagina = 1;
  let pedido = 0; // para ignorar respuestas viejas si se teclea rápido
  let espera: number | undefined;

  const consulta = (extra: Record<string, string> = {}): URLSearchParams => {
    const p = new URLSearchParams();
    if (campo.value.trim()) p.set('q', campo.value.trim());
    if (categoria) p.set('categoria', categoria);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return p;
  };

  function actualizarEnlaces(): void {
    chips.forEach((chip) => {
      const activa = chip.dataset.categoria === categoria;
      chip.toggleAttribute('aria-current', activa);
      if (activa) chip.setAttribute('aria-current', 'true');
      const p = new URLSearchParams();
      if (campo.value.trim()) p.set('q', campo.value.trim());
      if (!activa && chip.dataset.categoria) p.set('categoria', chip.dataset.categoria);
      chip.href = '/testimonios' + (p.toString() ? '?' + p : '');
    });
    const texto = consulta().toString();
    try {
      history.replaceState(null, '', '/testimonios' + (texto ? '?' + texto : ''));
    } catch {
      /* si el navegador no deja cambiar la dirección, la búsqueda funciona igual */
    }
  }

  function botonVerMas(): HTMLAnchorElement | null {
    return raiz!.querySelector<HTMLAnchorElement>('[data-ver-mas]');
  }

  function ponerVerMas(hayMas: boolean): void {
    let boton = botonVerMas();
    if (!hayMas) {
      boton?.remove();
      return;
    }
    if (!boton) {
      boton = document.createElement('a');
      boton.className = 'ver-mas';
      boton.setAttribute('data-ver-mas', '');
      boton.textContent = 'Ver más testimonios...';
      columna.append(boton);
    }
    boton.href = '/testimonios?' + consulta({ pagina: String(pagina + 1) });
  }

  async function cargar(reemplazar: boolean): Promise<void> {
    const mio = ++pedido;
    if (reemplazar) pagina = 1;
    else pagina += 1;
    const boton = botonVerMas();
    boton?.setAttribute('aria-busy', 'true');
    try {
      const r = await fetch('/api/testimonios?' + consulta({ pagina: String(pagina) }));
      const datos = (await r.json()) as { html?: string; hayMas?: boolean; total?: number; error?: string };
      if (mio !== pedido) return;
      if (!r.ok || datos.html === undefined) throw new Error(datos.error ?? 'Error');

      if (reemplazar) {
        lista.innerHTML =
          datos.html.trim() ||
          `<p class="lista__vacia">${campo.value.trim() || categoria ? 'No hay testimonios que coincidan con tu búsqueda.' : 'Todavía no hay testimonios publicados.'}</p>`;
      } else {
        lista.insertAdjacentHTML('beforeend', datos.html);
      }
      ponerVerMas(Boolean(datos.hayMas));
      if (resumen && datos.total !== undefined) {
        resumen.textContent = `${datos.total} ${datos.total === 1 ? 'testimonio' : 'testimonios'}`;
      }
      actualizarEnlaces();
    } catch {
      if (mio !== pedido) return;
      if (!reemplazar) pagina -= 1;
      botonVerMas()?.removeAttribute('aria-busy');
      if (reemplazar) lista.innerHTML = '<p class="lista__vacia">No hemos podido cargar los testimonios. Inténtalo de nuevo.</p>';
    }
  }

  // Búsqueda en vivo (espera un momento a que termines de escribir)
  campo.addEventListener('input', () => {
    window.clearTimeout(espera);
    espera = window.setTimeout(() => void cargar(true), 350);
  });
  formulario.addEventListener('submit', (e) => {
    e.preventDefault();
    window.clearTimeout(espera);
    void cargar(true);
  });

  // Categorías: un clic filtra; otro clic sobre la misma quita el filtro
  raiz.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLAnchorElement>('[data-categoria]');
    if (chip) {
      e.preventDefault();
      categoria = chip.dataset.categoria === categoria ? '' : (chip.dataset.categoria ?? '');
      void cargar(true);
      return;
    }
    const verMas = (e.target as HTMLElement).closest<HTMLAnchorElement>('[data-ver-mas]');
    if (verMas) {
      e.preventDefault();
      void cargar(false);
    }
  });
}
