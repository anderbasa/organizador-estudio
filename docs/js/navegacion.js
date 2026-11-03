// Cambiar de pestaña desde cualquier vista sin importar app.js (evita
// dependencias circulares): app.js escucha este evento.
export function irA(vista, datos = {}) {
  dispatchEvent(new CustomEvent("ir-a", { detail: { vista, ...datos } }));
}
