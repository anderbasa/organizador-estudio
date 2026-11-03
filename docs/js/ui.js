// Piezas de interfaz compartidas por todas las vistas.

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function el(tag, attrs = {}, ...hijos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k === "text") n.textContent = v;
    else if (k === "style" && typeof v === "object") {
      // las variables CSS (--c) solo se pueden poner con setProperty
      for (const [p, val] of Object.entries(v)) p.startsWith("--") ? n.style.setProperty(p, val) : (n.style[p] = val);
    }
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v === true ? "" : v);
  }
  for (const h of hijos.flat()) if (h != null && h !== false) n.append(h.nodeType ? h : document.createTextNode(h));
  return n;
}
export const desdeHTML = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };

/* ---------- Iconos (línea, 24x24; las partes .r se rellenan cuando están activas) ---------- */

const P = {
  hoy: '<circle class="r" cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/>',
  calendario: '<rect class="r" x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="8.5" cy="14.5" r=".9" fill="currentColor"/><circle cx="12" cy="14.5" r=".9" fill="currentColor"/><circle cx="15.5" cy="14.5" r=".9" fill="currentColor"/>',
  foco: '<circle class="r" cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M10 2.5h4M18.4 6.6l1.4-1.4"/>',
  asignaturas: '<path class="r" d="M4.5 4.5h4v15h-4zM10.5 4.5h4v15h-4z"/><path d="M16.2 5.3l3.6-1 3.6 13.6-3.6 1z" transform="translate(-2.4 .6)"/><path d="M4.5 8h4M10.5 8h4"/>',
  ajustes: '<circle class="r" cx="12" cy="12" r="3.2"/><path d="M12 2.8l1.6 2.3 2.8-.4.8 2.7 2.5 1.3-.9 2.6 1.4 2.4-2.3 1.6.1 2.8-2.8.4-1.3 2.5-2.6-1-2.4 1.4-1.6-2.3-2.8.1-.4-2.8L3.3 15l1-2.6L2.9 10l2.3-1.6-.1-2.8 2.8-.4L9.2 2.7l2.6 1z"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  atras: '<path d="M15 5l-7 7 7 7"/>',
  enviar: '<path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/>',
  reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>',
  pausa: '<path d="M8 5.5v13M16 5.5v13"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor"/>',
  libro: '<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5c-3.5-.5-6.5 0-8.5 1.5zM12 6.5v13"/>',
  birrete: '<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.5v4c2.5 2.5 8.5 2.5 11 0v-4M21.5 9.5v5"/>',
  papelera: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/>',
  archivo: '<rect x="3.5" y="4" width="17" height="4.5" rx="1.2"/><path d="M5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5M10 12.5h4"/>',
  nube: '<path d="M7 18.5h10.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.7-1.1A4.6 4.6 0 0 0 7 18.5z"/>',
  compartir: '<path d="M12 15V3.5M8 7.5l4-4 4 4M5.5 11v8a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-8"/>',
  descargar: '<path d="M12 3.5V15M8 11l4 4 4-4M5.5 15v4a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-4"/>',
  rayo: '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>',
  estrella: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  diana: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  lapiz: '<path d="M4 20l1-4.5L15.5 5l3.5 3.5L8.5 19z"/><path d="M13.5 7l3.5 3.5"/>',
  bandeja: '<path d="M3.5 13.5l2.5-8h12l2.5 8v5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18.5z"/><path d="M3.5 13.5h5l1 2h5l1-2h5"/>',
};
export function icono(nombre, clase = "") {
  return `<svg class="ico ${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[nombre] || ""}</svg>`;
}

/* ---------- Vibración ---------- */
// iPhone: Safari no tiene vibrate(), pero desde iOS 18 un interruptor nativo
// (<input type="checkbox" switch>) da un "tic" al cambiar. Tiene que estar
// pintado en <body> desde el principio (no display:none) y pulsarse DURANTE
// el toque del usuario, antes de cualquier await. Así funcionó en Brochi.
const ES_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
let etiquetaHaptica = null;
function interruptorHaptico() {
  if (etiquetaHaptica?.isConnected) return etiquetaHaptica;
  etiquetaHaptica = document.createElement("label");
  etiquetaHaptica.setAttribute("aria-hidden", "true");
  etiquetaHaptica.style.cssText = "position:fixed;left:0;bottom:0;width:52px;height:32px;opacity:0.011;pointer-events:none;z-index:-1;overflow:hidden";
  const i = document.createElement("input");
  i.type = "checkbox"; i.setAttribute("switch", ""); i.tabIndex = -1;
  etiquetaHaptica.append(i);
  document.body.append(etiquetaHaptica);
  return etiquetaHaptica;
}
export function vibrar(patron = 15) {
  try {
    if (navigator.vibrate) { navigator.vibrate(patron); return; }
    if (ES_IOS) interruptorHaptico().click();
  } catch (_) {}
}
if (ES_IOS) {
  if (document.body) interruptorHaptico();
  else addEventListener("DOMContentLoaded", interruptorHaptico, { once: true });
}

/* ---------- Avisos (toast) con acción opcional ---------- */

let toastActual = null;
export function aviso(texto, { accion = null, duracion = 3200, tipo = "ok" } = {}) {
  const cont = document.getElementById("avisos");
  if (toastActual) toastActual.quitar(true);
  const nodo = el("div", { class: `aviso ${tipo}`, role: "status" }, el("span", { class: "aviso-texto", text: texto }));
  let t;
  const quitar = (rapido = false) => {
    clearTimeout(t);
    if (toastActual?.nodo === nodo) toastActual = null;
    nodo.classList.add("saliendo");
    setTimeout(() => nodo.remove(), rapido ? 160 : 320);
  };
  if (accion) {
    nodo.append(el("button", { type: "button", class: "aviso-accion", text: accion.texto, onclick: () => { vibrar(); quitar(true); accion.alPulsar(); } }));
  }
  cont.append(nodo);
  t = setTimeout(quitar, accion ? Math.max(duracion, 5000) : duracion);
  toastActual = { nodo, quitar };
}

/* ---------- Hojas que suben desde abajo (estilo iOS) ---------- */
// Si ya hay una abierta, cambia el contenido en el sitio en vez de cerrar y abrir.

let hojaAbierta = null;
export function abrirHoja(contenido, { alCerrar = null, clase = "" } = {}) {
  if (hojaAbierta) {
    const anterior = hojaAbierta.alCerrar;
    hojaAbierta.alCerrar = alCerrar;
    anterior?.();
    const { panel } = hojaAbierta;
    panel.className = `hoja ${clase}`;
    panel.replaceChildren(el("div", { class: "hoja-asa" }), contenido);
    panel.scrollTop = 0;
    return { cerrar: cerrarHoja, panel };
  }
  const panel = el("div", { class: `hoja ${clase}`, role: "dialog", "aria-modal": "true" }, el("div", { class: "hoja-asa" }), contenido);
  const fondo = el("div", { class: "hoja-fondo" }, panel);
  fondo.addEventListener("click", (e) => { if (e.target === fondo) cerrarHoja(); });
  const tecla = (e) => e.key === "Escape" && cerrarHoja();
  document.addEventListener("keydown", tecla);
  document.body.append(fondo);
  document.documentElement.classList.add("con-hoja");
  fondo.getBoundingClientRect();
  fondo.classList.add("visible");
  arrastreHoja(panel, fondo);
  hojaAbierta = { fondo, panel, tecla, alCerrar };
  return { cerrar: cerrarHoja, panel };
}
export function cerrarHoja() {
  if (!hojaAbierta) return;
  const { fondo, tecla, alCerrar } = hojaAbierta;
  hojaAbierta = null;
  document.removeEventListener("keydown", tecla);
  fondo.classList.remove("visible");
  document.documentElement.classList.remove("con-hoja");
  setTimeout(() => fondo.remove(), 420);
  alCerrar?.();
}
export const hayHoja = () => !!hojaAbierta;

function arrastreHoja(panel, fondo) {
  let y0 = null, dy = 0, t0 = 0, arrastrando = false;
  panel.addEventListener("touchstart", (e) => {
    if (e.touches.length > 1) return;
    const enAsa = e.target.closest(".hoja-asa, .hoja-cabecera");
    if (panel.scrollTop > 0 && !enAsa) return;
    if (e.target.closest("input, textarea, select, .no-arrastre")) return;
    y0 = e.touches[0].clientY; dy = 0; t0 = Date.now(); arrastrando = false;
  }, { passive: true });
  panel.addEventListener("touchmove", (e) => {
    if (y0 === null) return;
    dy = e.touches[0].clientY - y0;
    if (!arrastrando) {
      if (dy > 8) { arrastrando = true; panel.classList.add("arrastrando"); }
      else if (dy < -4) { y0 = null; return; } else return;
    }
    e.preventDefault();
    panel.style.transform = `translateY(${dy > 0 ? dy : dy / 4}px)`;
    fondo.style.backgroundColor = `rgba(0,0,0,${Math.max(0.08, 0.4 - Math.max(0, dy) / 1200)})`;
  }, { passive: false });
  const fin = () => {
    if (y0 === null) return;
    const v = dy / Math.max(1, Date.now() - t0);
    y0 = null;
    if (!arrastrando) return;
    arrastrando = false;
    panel.classList.remove("arrastrando");
    panel.style.transform = ""; fondo.style.backgroundColor = "";
    if (dy > 130 || (dy > 40 && v > 0.5)) cerrarHoja();
  };
  panel.addEventListener("touchend", fin);
  panel.addEventListener("touchcancel", fin);
}

// Confirmación en hoja. Resuelve ANTES de cerrar (si no, el alCerrar
// resolvería "false" primero, como pasó en Brochi).
export function confirmar(mensaje, { textoOk = "Borrar", peligro = true, detalle = "" } = {}) {
  return new Promise((resolve) => {
    let respondido = false;
    const responder = (v) => { if (respondido) return; respondido = true; resolve(v); cerrarHoja(); };
    const cont = el("div", { class: "hoja-cuerpo confirmar" },
      el("h3", { text: mensaje }),
      detalle ? el("p", { class: "suave", text: detalle }) : null,
      el("button", { type: "button", class: `boton grande ${peligro ? "peligro" : "primario"}`, text: textoOk, onclick: () => { vibrar(); responder(true); } }),
      el("button", { type: "button", class: "boton grande secundario", text: "Cancelar", onclick: () => responder(false) }));
    abrirHoja(cont, { alCerrar: () => { if (!respondido) { respondido = true; resolve(false); } } });
  });
}

/* ---------- Números que cuentan hacia arriba ---------- */

export function contar(nodo, final, { decimales = 0, duracion = 800, formato = null } = {}) {
  const texto = (v) => (formato ? formato(v) : v.toFixed(decimales).replace(".", ","));
  // el valor final queda puesto desde ya (por si la animación no llega a correr)
  nodo.textContent = texto(final);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !final) return;
  let t0 = null;
  const paso = (t) => {
    if (!nodo.isConnected) return;
    if (t0 === null) t0 = t;
    const p = Math.min(1, (t - t0) / duracion);
    nodo.textContent = texto(final * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
  // si la pestaña está en segundo plano los frames se paran: que acabe bien igual
  setTimeout(() => { if (nodo.isConnected) nodo.textContent = texto(final); }, duracion + 80);
}

export const fmtNota = (n) => (n == null ? "—" : String(Math.round(n * 100) / 100).replace(".", ","));

/* ---------- Deslizar a la derecha para marcar como hecho ---------- */

export function deslizable(fila, alCompletar) {
  const contenido = fila.querySelector(".desl-contenido");
  let x0 = null, y0 = 0, dx = 0, decidido = null, id = null, avisado = false;
  const UMBRAL = 96;
  fila.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("button, input, select, a")) return;
    x0 = e.clientX; y0 = e.clientY; dx = 0; decidido = null; id = e.pointerId; avisado = false;
  });
  fila.addEventListener("pointermove", (e) => {
    if (x0 === null || e.pointerId !== id) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (!decidido) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      decidido = Math.abs(mx) > Math.abs(my) && mx > 0 ? "h" : "v";
      if (decidido === "h") { try { fila.setPointerCapture(id); } catch {} fila.classList.add("deslizando"); }
    }
    if (decidido !== "h") return;
    dx = Math.max(0, mx);
    contenido.style.transform = `translateX(${dx < UMBRAL ? dx : UMBRAL + (dx - UMBRAL) * 0.35}px)`;
    const listo = dx >= UMBRAL;
    fila.classList.toggle("listo", listo);
    if (listo && !avisado) { avisado = true; vibrar(10); } else if (!listo) avisado = false;
  });
  const fin = (e) => {
    if (x0 === null || (e && e.pointerId !== id)) return;
    x0 = null;
    if (decidido !== "h") return;
    fila.classList.remove("deslizando");
    if (dx >= UMBRAL) {
      fila.classList.add("completando");
      contenido.style.transform = "translateX(110%)";
      setTimeout(alCompletar, 260);
    } else {
      contenido.style.transform = "";
      fila.classList.remove("listo");
    }
  };
  fila.addEventListener("pointerup", fin);
  fila.addEventListener("pointercancel", fin);
  // que un deslizamiento no acabe abriendo la ficha
  fila.addEventListener("click", (e) => { if (decidido === "h") { e.stopPropagation(); e.preventDefault(); decidido = null; } }, true);
}

/* ---------- Guardar/compartir un archivo ---------- */
// En iPhone abre la hoja de compartir (Guardar en Archivos, Calendario...).
// Devuelve false si el usuario la cancela.
export async function guardarArchivo(blob, nombre) {
  const archivo = new File([blob], nombre, { type: blob.type });
  if (navigator.canShare?.({ files: [archivo] })) {
    try { await navigator.share({ files: [archivo] }); return true; }
    catch (err) { if (err.name === "AbortError") return false; }
  }
  const a = el("a", { href: URL.createObjectURL(blob), download: nombre });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
}

/* ---------- Transición entre pantallas ---------- */

export function conTransicion(fn) {
  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(fn);
  else fn();
}
