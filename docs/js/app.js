// Arranque, pestañas y repintado.
import { DB, alCambiar, guardar, normalizarTodo } from "./datos.js";
import { conectar, alEstado, esperarServidor, estado } from "./nube.js";
import { cicloDiario } from "./estudio.js";
import { todayISO } from "./fechas.js";
import { el, icono, vibrar, conTransicion, hayHoja, cerrarHoja, aviso } from "./ui.js";
import * as hoy from "./vistas/hoy.js";
import * as calendario from "./vistas/calendario.js";
import * as foco from "./vistas/foco.js";
import * as asignaturas from "./vistas/asignaturas.js";
import * as ajustes from "./vistas/ajustes.js";

const VISTAS = { hoy, calendario, foco, asignaturas, ajustes };
const NOMBRES = { hoy: "Hoy", calendario: "Calendario", foco: "Foco", asignaturas: "Asignaturas", ajustes: "Ajustes" };
const enApp = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

let activa = "hoy";
const sucias = new Set(Object.keys(VISTAS));
const scrolls = {};
const caja = (n) => document.getElementById(`vista-${n}`);

/* ---------- Pintar ---------- */

// No repinta la vista mientras se escribe en uno de sus campos (se perdería
// el foco y se cerraría el teclado): espera a que se salga del campo.
function escribiendoEn(c) {
  const f = document.activeElement;
  return f && c.contains(f) && f.matches("input, textarea, select") && !f.closest("[data-persistente]");
}

function pintar(n, forzar = false) {
  if (!forzar && !sucias.has(n)) return;
  const c = caja(n);
  if (!forzar && escribiendoEn(c)) return;
  sucias.delete(n);
  const top = c.scrollTop;
  VISTAS[n].pintar();
  c.scrollTop = top;
}

let cicloListo = false; // hasta tener los datos del servidor (y migrados) no se toca la lista del día
alCambiar(() => {
  // si algo nuevo pasa a tocar hoy, entra en la lista del día (y se repinta en la siguiente vuelta)
  if (cicloListo && cicloDiario()) return guardar();
  Object.keys(VISTAS).forEach((k) => sucias.add(k));
  pintar(activa);
});
document.addEventListener("focusout", () => setTimeout(() => { if (sucias.has(activa)) pintar(activa); }, 0));

/* ---------- Pestañas ---------- */

function mostrar(n) {
  if (n === activa) return;
  scrolls[activa] = caja(activa).scrollTop;
  conTransicion(() => {
    activa = n;
    for (const k of Object.keys(VISTAS)) {
      caja(k).hidden = k !== n;
      caja(k).classList.toggle("activa", k === n);
    }
    document.querySelectorAll(".pestana").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.vista === n)));
    pintar(n);
    caja(n).scrollTop = scrolls[n] || 0;
    // sin View Transitions (iOS < 18), una entrada suave hecha con CSS
    if (!document.startViewTransition) { caja(n).classList.remove("entrando"); void caja(n).offsetWidth; caja(n).classList.add("entrando"); }
  });
}

function montarPestanas() {
  const nav = document.getElementById("pestanas");
  for (const n of Object.keys(VISTAS)) {
    nav.append(el("button", {
      type: "button", role: "tab", class: "pestana", "data-vista": n, "aria-selected": String(n === activa),
      html: `${icono(n)}<span>${NOMBRES[n]}</span>`,
      onclick: () => {
        vibrar(8);
        if (n !== activa) return mostrar(n);
        // tocar la pestaña activa: volver atrás / subir arriba, como en iOS
        if (n === "asignaturas" && asignaturas.estaEnDetalle()) return asignaturas.volver();
        caja(n).scrollTo({ top: 0, behavior: "smooth" });
      },
    }));
  }
}

addEventListener("ir-a", (e) => {
  const { vista, ...d } = e.detail;
  if (hayHoja()) cerrarHoja();
  if (vista === "foco") foco.preseleccionar(d);
  if (vista === "asignaturas") {
    if (d.asignatura) asignaturas.abrir(d.asignatura);
    if (d.nueva) setTimeout(asignaturas.nueva, 350);
  }
  sucias.add(vista);
  if (vista === activa) pintar(vista, true); else mostrar(vista);
  if (vista === "calendario" && d.dia) setTimeout(() => calendario.irADia(d.dia), 50);
});

// Barra compacta al hacer scroll (el título grande se encoge, como en iOS)
function vigilarScroll() {
  for (const n of Object.keys(VISTAS)) {
    const c = caja(n);
    c.addEventListener("scroll", () => c.classList.toggle("con-scroll", c.scrollTop > 24), { passive: true });
  }
}

/* ---------- Datos del organizador antiguo (localStorage de Safari) ---------- */

// Solo añade lo que no esté ya en la nube (mismo id), así que repetirla no
// duplica nada. La marca lleva versión: subirla fuerza una nueva pasada
// (v2: se vació la nube tras la primera, el 03/11/2026).
const MARCA_MIGRADO = "matricula.migrado.v2";
async function migrarLegado() {
  let crudo, hecho;
  try { crudo = localStorage.getItem("organizador_estudio_v1"); hecho = !!localStorage.getItem(MARCA_MIGRADO); } catch { return; }
  if (!crudo) return;
  await esperarServidor(); // saber qué hay ya en la nube antes de añadir nada
  let viejo;
  try { viejo = JSON.parse(crudo); } catch { return; }
  let n = 0, cambios = false;
  if (!hecho) {
    for (const k of ["asignaturas", "eventos", "temas", "sin_clasificar"]) {
      for (const it of Array.isArray(viejo[k]) ? viejo[k] : []) {
        if (!it || !/^[A-Za-z0-9_-]{1,64}$/.test(String(it.id)) || DB[k].some((x) => x.id === it.id)) continue;
        DB[k].push(JSON.parse(JSON.stringify(it)));
        n++;
      }
    }
    cambios = true;
  }
  // Fechas del cuatrimestre: mientras la nube no tenga los ajustes migrados
  // (primera vez, o si se perdió el documento), se toman del organizador antiguo.
  if (!DB.meta.migrado_en) {
    if (viejo.meta) for (const c of ["cuatrimestre_inicio", "cuatrimestre_fin"]) if (viejo.meta[c]) DB.meta[c] = viejo.meta[c];
    DB.meta.migrado_en = todayISO();
    cambios = true;
  }
  if (!cambios) return;
  normalizarTodo();
  guardar();
  if (hecho) return;
  try { localStorage.setItem(MARCA_MIGRADO, new Date().toISOString()); } catch {}
  if (n) aviso(`He subido a la nube tus ${n} datos del organizador antiguo`, { duracion: 6000 });
}

/* ---------- Cambio de día ---------- */

let dia = todayISO();
function comprobarDia(forzar = false) {
  if (!forzar && dia === todayISO()) return;
  dia = todayISO();
  if (cicloDiario()) guardar();
  Object.keys(VISTAS).forEach((k) => sucias.add(k));
  pintar(activa);
}

/* ---------- Arranque ---------- */

function quitarArranque() {
  const a = document.getElementById("arranque");
  if (!a) return;
  a.classList.add("fuera");
  setTimeout(() => a.remove(), 900);
}

async function arrancar() {
  const t0 = performance.now();
  for (const [n, v] of Object.entries(VISTAS)) v.montar(caja(n));
  montarPestanas();
  vigilarScroll();
  alEstado(hoy.pintarEstadoNube);
  await conectar();
  pintar(activa, true);
  hoy.pintarEstadoNube(estado());
  setTimeout(quitarArranque, Math.max(0, 650 - (performance.now() - t0)));

  // con datos del servidor: primero la migración, luego lo del día (contador de evitados)
  esperarServidor().then(async () => {
    await migrarLegado();
    cicloListo = true;
    comprobarDia(true);
  });

  // Desde la pegatina NFC (Safari) o con ?capturar: teclado listo para escribir
  if (new URLSearchParams(location.search).has("capturar") || !enApp()) hoy.enfocarCaptura();

  document.addEventListener("visibilitychange", () => { if (!document.hidden) comprobarDia(); });
  setInterval(() => comprobarDia(), 60000);

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}

arrancar();
