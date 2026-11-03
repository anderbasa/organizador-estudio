// Pestaña "Foco": temporizador de concentración (tipo Pomodoro) ligado a una
// asignatura y, opcionalmente, a un tema. Cuenta con marcas de tiempo, así
// que sigue bien aunque se cierre la app o se bloquee el móvil.
import { DB, guardar, instantanea, restaurar, uid, activasAsignaturas, nombreAsig, colorAsig, temasDe, asig } from "../datos.js";
import { minutosSemana, registrarRepaso } from "../estudio.js";
import { minutosTexto, todayISO, fechaCorta, sumarDias, diaSemanaCorto, isoDate } from "../fechas.js";
import { el, icono, vibrar, aviso, abrirHoja, cerrarHoja, contar } from "../ui.js";

const CLAVE = "matricula.foco";
const CLAVE_SEL = "matricula.foco-sel";
const leer = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const escribir = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };

let raiz, zonaReloj, zonaResto;
let sel = leer(CLAVE_SEL) || { asignatura_id: null, tema_id: null, duracion: null };
let tick = null, audio = null, wakeLock = null;
let terminado = null; // { minutos, asignatura_id, tema_id } tras completar una sesión

const estado = () => leer(CLAVE);
const duracionSel = () => sel.duracion || DB.meta.foco_min || 25;

function restanteMs(s, ahora = Date.now()) {
  const pausa = s.pausaAcumulada + (s.pausadoEn ? ahora - s.pausadoEn : 0);
  return s.duracionMin * 60000 - (ahora - s.inicio - pausa);
}
const mmss = (ms) => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };

export function montar(cont) {
  raiz = cont;
  cont.append(
    el("header", { class: "barra" }, el("h1", { class: "titulo-grande", text: "Foco" })),
    el("div", { class: "cuerpo" }, (zonaReloj = el("div", { class: "foco-zona" })), (zonaResto = el("div"))));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) comprobarFin(); });
}

export function preseleccionar({ asignatura_id = null, tema_id = null } = {}) {
  if (estado()) return aviso("Ya hay una sesión en marcha", { tipo: "aviso" });
  terminado = null;
  if (asignatura_id) { sel.asignatura_id = asignatura_id; sel.tema_id = tema_id; escribir(CLAVE_SEL, sel); }
}

export function pintar() {
  comprobarFin();
  pintarReloj();
  pintarResto();
}

/* ---------- Reloj ---------- */

const R = 128, C = 2 * Math.PI * R;
let refs = {};

function pintarReloj() {
  const s = estado();
  if (sel.asignatura_id && !asig(sel.asignatura_id)) { sel = { ...sel, asignatura_id: null, tema_id: null }; escribir(CLAVE_SEL, sel); }
  const fase = s?.fase || (terminado ? "terminado" : "parado");
  const asigId = s?.asignatura_id ?? sel.asignatura_id, temaId = s?.tema_id ?? sel.tema_id;
  const tema = temaId ? DB.temas.find((t) => t.id === temaId) : null;
  const color = asigId ? colorAsig(asigId) : "var(--oro)";

  refs.tiempo = el("span", { class: "reloj-tiempo" });
  refs.arco = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  const svg = el("div", { class: `reloj fase-${fase}`, style: { "--c": color }, html:
    `<svg viewBox="0 0 300 300" aria-hidden="true"><defs><linearGradient id="g-foco" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3d6"/><stop offset=".5" stop-color="#ecc983"/><stop offset="1" stop-color="#b8873d"/></linearGradient></defs>
     <circle cx="150" cy="150" r="${R}" class="reloj-pista"/></svg>` });
  const svgEl = svg.querySelector("svg");
  refs.arco.setAttribute("cx", 150); refs.arco.setAttribute("cy", 150); refs.arco.setAttribute("r", R);
  refs.arco.setAttribute("class", "reloj-arco"); refs.arco.setAttribute("stroke-dasharray", C);
  svgEl.append(refs.arco);
  const etiqueta = { foco: s?.pausadoEn ? "En pausa" : "Concentración", descanso: "Descanso", terminado: "¡Sesión completada!", parado: "Listo para empezar" }[fase];
  svg.append(el("div", { class: "reloj-centro" },
    el("span", { class: "reloj-fase", text: etiqueta }),
    refs.tiempo,
    el("span", { class: "reloj-sub", text: asigId ? (tema ? tema.nombre : nombreAsig(asigId)) : "Sin asignatura" })));

  const controles = el("div", { class: "foco-controles" });
  if (fase === "parado") {
    controles.append(
      selectores(asigId, temaId),
      duraciones(),
      el("button", { type: "button", class: "boton-play", "aria-label": "Empezar", html: icono("play"), onclick: empezar }));
  } else if (fase === "terminado") {
    controles.append(
      el("p", { class: "foco-hecho", text: `+${minutosTexto(terminado.minutos)} en ${nombreAsig(terminado.asignatura_id)}` }),
      el("div", { class: "fila-botones" },
        el("button", { type: "button", class: "boton grande secundario", text: `Descanso (${DB.meta.descanso_min || 5} min)`, onclick: () => empezar(null, "descanso") }),
        el("button", { type: "button", class: "boton grande primario", text: "Otra sesión", onclick: () => { terminado = null; empezar(); } })));
  } else {
    const pausado = !!s.pausadoEn;
    controles.append(el("div", { class: "fila-botones centrada" },
      el("button", { type: "button", class: "boton-redondo grande", "aria-label": "Terminar", html: icono("stop"), onclick: detener }),
      s.fase === "foco" ? el("button", { type: "button", class: "boton-play", "aria-label": pausado ? "Reanudar" : "Pausa", html: icono(pausado ? "play" : "pausa"), onclick: pausar }) : null));
    if (s.fase === "foco") controles.append(el("p", { class: "suave centrado pie", text: "Puedes bloquear el móvil: el tiempo sigue contando. Sin notificaciones, te avisa al volver a abrir la app." }));
  }
  zonaReloj.replaceChildren(svg, controles);
  actualizarReloj();
  clearInterval(tick);
  if (s && !s.pausadoEn) tick = setInterval(actualizarReloj, 250);
}

function actualizarReloj() {
  const s = estado();
  if (!refs.tiempo) return;
  if (!s) {
    const total = (terminado ? 0 : duracionSel()) * 60000;
    refs.tiempo.textContent = terminado ? "✓" : mmss(total);
    refs.arco.setAttribute("stroke-dashoffset", terminado ? 0 : C);
    return;
  }
  const rest = restanteMs(s);
  refs.tiempo.textContent = mmss(rest);
  refs.arco.setAttribute("stroke-dashoffset", C * Math.max(0, rest) / (s.duracionMin * 60000));
  if (rest <= 0) comprobarFin();
}

function selectores(asigId, temaId) {
  const tema = temaId ? DB.temas.find((t) => t.id === temaId) : null;
  return el("div", { class: "foco-selectores" },
    el("button", { type: "button", class: "pildora grande", style: asigId ? { "--c": colorAsig(asigId) } : {}, onclick: elegirAsignatura },
      asigId ? el("i", { class: "punto", style: { background: colorAsig(asigId) } }) : el("span", { html: icono("asignaturas") }),
      asigId ? nombreAsig(asigId) : "Elige asignatura"),
    asigId ? el("button", { type: "button", class: "pildora grande", onclick: elegirTema }, el("span", { html: icono("libro") }), tema ? tema.nombre : "Cualquier tema") : null);
}

function duraciones() {
  const opciones = [...new Set([15, 25, 45, 60, DB.meta.foco_min || 25])].sort((a, b) => a - b);
  const cont = el("div", { class: "segmentado", role: "radiogroup", "aria-label": "Duración" });
  for (const m of opciones) {
    cont.append(el("button", { type: "button", role: "radio", "aria-checked": String(m === duracionSel()), text: `${m} min`,
      onclick: () => { vibrar(8); sel.duracion = m; escribir(CLAVE_SEL, sel); pintarReloj(); } }));
  }
  return cont;
}

function elegirAsignatura() {
  vibrar(8);
  const activas = activasAsignaturas();
  const cont = el("div", { class: "hoja-cuerpo" },
    el("div", { class: "hoja-cabecera" }, el("span"), el("h3", { text: "¿Qué vas a estudiar?" }), el("button", { type: "button", class: "enlace", text: "Cerrar", onclick: cerrarHoja })),
    activas.length ? el("div", { class: "lista tarjeta" }, ...activas.map((a) => el("button", { type: "button", class: "fila-opcion",
      onclick: () => { vibrar(8); sel = { ...sel, asignatura_id: a.id, tema_id: null }; escribir(CLAVE_SEL, sel); cerrarHoja(); pintarReloj(); } },
      el("i", { class: "punto grande", style: { background: a.color } }), el("span", { text: a.nombre }),
      sel.asignatura_id === a.id ? el("span", { class: "marca-check", html: icono("check") }) : null)))
      : el("p", { class: "suave centrado", text: "Añade primero tus asignaturas en la pestaña Asignaturas." }));
  abrirHoja(cont);
}

function elegirTema() {
  vibrar(8);
  const temas = temasDe(sel.asignatura_id);
  const opcion = (id, texto, sub) => el("button", { type: "button", class: "fila-opcion",
    onclick: () => { vibrar(8); sel = { ...sel, tema_id: id }; escribir(CLAVE_SEL, sel); cerrarHoja(); pintarReloj(); } },
    el("span", { class: "fila-texto" }, el("strong", { text: texto }), sub ? el("small", { text: sub }) : null),
    sel.tema_id === id ? el("span", { class: "marca-check", html: icono("check") }) : null);
  const cont = el("div", { class: "hoja-cuerpo" },
    el("div", { class: "hoja-cabecera" }, el("span"), el("h3", { text: nombreAsig(sel.asignatura_id) }), el("button", { type: "button", class: "enlace", text: "Cerrar", onclick: cerrarHoja })),
    el("div", { class: "lista tarjeta" }, opcion(null, "Cualquier tema", "Cuenta para la asignatura"),
      ...temas.map((t) => opcion(t.id, t.nombre, t.proximo_repaso <= todayISO() ? "toca repasarlo" : null))));
  abrirHoja(cont);
}

/* ---------- Ciclo ---------- */

function prepararAudio() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
  } catch {}
}
function campanilla() {
  if (!audio) return;
  try {
    const t = audio.currentTime;
    [[880, 0], [1318.5, 0.18]].forEach(([f, d]) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.25, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 1.1);
      o.connect(g).connect(audio.destination); o.start(t + d); o.stop(t + d + 1.2);
    });
  } catch {}
}
async function mantenerPantalla(on) {
  try {
    if (on && "wakeLock" in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => (wakeLock = null)); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch {}
}

function empezar(_e, fase = "foco") {
  vibrar();
  if (fase === "foco" && !sel.asignatura_id) return elegirAsignatura();
  prepararAudio();
  terminado = fase === "descanso" ? terminado : null;
  escribir(CLAVE, {
    fase, inicio: Date.now(), duracionMin: fase === "foco" ? duracionSel() : DB.meta.descanso_min || 5,
    pausadoEn: null, pausaAcumulada: 0, asignatura_id: fase === "foco" ? sel.asignatura_id : terminado?.asignatura_id || sel.asignatura_id,
    tema_id: fase === "foco" ? sel.tema_id : null,
  });
  if (fase === "descanso") terminado = null;
  mantenerPantalla(true);
  pintarReloj();
}

function pausar() {
  vibrar();
  const s = estado(); if (!s) return;
  if (s.pausadoEn) { s.pausaAcumulada += Date.now() - s.pausadoEn; s.pausadoEn = null; mantenerPantalla(true); }
  else { s.pausadoEn = Date.now(); mantenerPantalla(false); }
  escribir(CLAVE, s);
  pintarReloj();
}

// Fecha y hora LOCALES ("2026-11-03T18:05:00"): con toISOString() una sesión
// a las 00:30 contaría para el día anterior.
function horaLocal(ms) {
  const d = new Date(ms), dos = (n) => String(n).padStart(2, "0");
  return `${isoDate(d)}T${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
}

function registrarSesion(s, minutos) {
  DB.sesiones.push({ id: uid(), asignatura_id: s.asignatura_id, tema_id: s.tema_id || null, inicio: horaLocal(s.inicio), minutos });
}

function detener() {
  vibrar();
  const s = estado(); if (!s) return;
  escribir(CLAVE, null);
  mantenerPantalla(false);
  if (s.fase === "foco") {
    const minutos = Math.floor((s.duracionMin * 60000 - Math.max(0, restanteMs(s))) / 60000);
    if (minutos >= 1) {
      const copia = instantanea();
      registrarSesion(s, minutos);
      guardar();
      aviso(`Guardados ${minutosTexto(minutos)} de ${nombreAsig(s.asignatura_id)}`, { accion: { texto: "Deshacer", alPulsar: () => restaurar(copia) } });
    } else aviso("Sesión descartada (menos de 1 min)");
  }
  pintar();
}

function comprobarFin() {
  const s = estado();
  if (!s || restanteMs(s) > 0) return;
  escribir(CLAVE, null);
  clearInterval(tick);
  mantenerPantalla(false);
  vibrar([40, 60, 40]);
  campanilla();
  if (s.fase === "foco") {
    registrarSesion(s, s.duracionMin);
    guardar();
    terminado = { minutos: s.duracionMin, asignatura_id: s.asignatura_id, tema_id: s.tema_id };
    if (s.tema_id) preguntarRepaso(s.tema_id);
  } else {
    terminado = null;
    aviso("Descanso terminado. ¿Otra sesión?");
  }
  if (raiz) { pintarReloj(); pintarResto(); }
}

function preguntarRepaso(temaId) {
  const t = DB.temas.find((x) => x.id === temaId);
  if (!t) return;
  const cont = el("div", { class: "hoja-cuerpo" },
    el("h3", { class: "centrado", text: `¿Qué tal con “${t.nombre}”?` }),
    el("p", { class: "suave centrado", text: "Lo marco como repasado y te lo vuelvo a proponer cuando toque." }),
    el("div", { class: "calidades" }, ...[["dificil", "Me costó", "😮‍💨"], ["bien", "Bien", "🙂"], ["facil", "Fácil", "😎"]].map(([v, texto, emoji]) =>
      el("button", { type: "button", class: `calidad ${v}`, html: `<span class="calidad-emoji">${emoji}</span><span>${texto}</span>`,
        onclick: () => {
          vibrar(); cerrarHoja();
          const x = DB.temas.find((y) => y.id === temaId); if (!x) return;
          const dias = registrarRepaso(x, v); guardar();
          aviso(`“${x.nombre}” repasado · vuelve ${dias === 1 ? "mañana" : `en ${dias} días`}`);
        } }))),
    el("button", { type: "button", class: "boton grande secundario", text: "Ahora no", onclick: cerrarHoja }));
  abrirHoja(cont);
}

/* ---------- Estadísticas ---------- */

function pintarResto() {
  const m = minutosSemana();
  const maxDia = Math.max(30, ...m.porDia);
  const hoy = todayISO();
  const total = el("span", { class: "cifra" });
  const barras = el("div", { class: "barras-semana" }, ...m.porDia.map((min, i) => {
    const d = sumarDias(m.lunes, i);
    return el("div", { class: `barra-dia ${d === hoy ? "hoy" : ""}` },
      el("div", { class: "barra-hueco" }, el("i", { style: { height: `${(100 * min) / maxDia}%` } })),
      el("span", { text: diaSemanaCorto(d).slice(0, 1).toUpperCase() }));
  }));
  const porAsig = el("div", { class: "por-asig" }, ...m.porAsig.map(([id, min]) => el("div", { class: "por-asig-fila" },
    el("span", { class: "por-asig-nombre", text: nombreAsig(id) }),
    el("div", { class: "por-asig-barra" }, el("i", { style: { width: `${(100 * min) / (m.porAsig[0]?.[1] || 1)}%`, background: colorAsig(id) } })),
    el("span", { class: "por-asig-min", text: minutosTexto(min) }))));
  const recientes = DB.sesiones.slice().sort((a, b) => b.inicio.localeCompare(a.inicio)).slice(0, 6);
  zonaResto.replaceChildren(
    el("section", { class: "seccion" },
      el("div", { class: "seccion-cab" }, el("h2", { text: "Esta semana" })),
      el("div", { class: "tarjeta stats-foco" },
        el("div", { class: "stats-total" }, total, el("span", { class: "suave", text: m.total ? "de concentración" : "Aún sin sesiones esta semana" })),
        barras, m.porAsig.length ? porAsig : null)),
    recientes.length ? el("section", { class: "seccion" },
      el("div", { class: "seccion-cab" }, el("h2", { text: "Últimas sesiones" })),
      el("div", { class: "lista tarjeta" }, ...recientes.map((s) => {
        const tema = s.tema_id ? DB.temas.find((t) => t.id === s.tema_id) : null;
        return el("div", { class: "fila-sesion" },
          el("span", { class: "barra-color", style: { background: colorAsig(s.asignatura_id) } }),
          el("span", { class: "fila-texto" }, el("strong", { text: tema ? tema.nombre : nombreAsig(s.asignatura_id) }),
            el("small", { text: `${tema ? `${nombreAsig(s.asignatura_id)} · ` : ""}${fechaCorta(s.inicio.slice(0, 10))} · ${s.inicio.slice(11, 16)}` })),
          el("span", { class: "fila-min", text: minutosTexto(s.minutos) }),
          el("button", { type: "button", class: "boton-icono suave", "aria-label": "Borrar sesión", html: icono("papelera"), onclick: () => {
            vibrar(8);
            const copia = instantanea();
            DB.sesiones = DB.sesiones.filter((x) => x.id !== s.id); guardar();
            aviso("Sesión borrada", { tipo: "aviso", accion: { texto: "Deshacer", alPulsar: () => restaurar(copia) } });
          } }));
      }))) : null);
  contar(total, m.total, { formato: (v) => minutosTexto(v), duracion: 700 });
}
