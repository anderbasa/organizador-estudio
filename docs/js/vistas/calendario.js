// Pestaña "Calendario": mes, próximos y mapa de calor del cuatrimestre.
import { DB, nombreAsig, colorAsig, activasAsignaturas, proximosEventos, asig, temasActivos } from "../datos.js";
import { cargaSemana, nivelCarga } from "../estudio.js";
import {
  MESES, todayISO, isoDate, parseDate, addDays, mondayOf, today, daysBetween, sumarDias, fechaLarga, fechaCorta, formatDMY,
} from "../fechas.js";
import { el, icono, vibrar, abrirHoja, cerrarHoja, conTransicion } from "../ui.js";
import { fichaEvento } from "../fichas.js";

let raiz, cuerpo;
let cursor = today();
let filtro = null;

export function montar(cont) {
  raiz = cont;
  cont.append(
    el("header", { class: "barra" }, el("h1", { class: "titulo-grande", text: "Calendario" }),
      el("button", { type: "button", class: "boton-redondo", "aria-label": "Añadir examen o entrega", html: icono("mas"),
        onclick: () => { vibrar(8); fichaEvento(null, { fecha: todayISO(), asignatura_id: filtro }); } })),
    (cuerpo = el("div", { class: "cuerpo" })));
}

export function irADia(iso) {
  cursor = parseDate(iso);
  pintar();
  abrirDia(iso);
}

export function pintar() {
  const activas = activasAsignaturas();
  if (filtro && !activas.some((a) => a.id === filtro)) filtro = null;
  cuerpo.replaceChildren(
    activas.length >= 2 ? filtros(activas) : null,
    tarjetaMes(),
    seccionProximos(),
    seccionCalor());
  cuerpo.querySelector(".mes")?.classList.add("listo");
}

function filtros(activas) {
  const cont = el("div", { class: "pildoras" });
  const boton = (id, texto, color) => el("button", {
    type: "button", class: `pildora ${filtro === id ? "activa" : ""}`, style: color ? { "--c": color } : {},
    onclick: () => { vibrar(8); filtro = id; conTransicion(pintar); },
  }, color ? el("i", { class: "punto", style: { background: color } }) : null, texto);
  cont.append(boton(null, "Todas"), ...activas.map((a) => boton(a.id, a.nombre, a.color)));
  return cont;
}

const visible = (e) => (!filtro || e.asignatura_id === filtro) && !asig(e.asignatura_id)?.archivada;
const eventosDia = (iso) => DB.eventos.filter((e) => e.fecha === iso && visible(e))
  .sort((a, b) => (a.hora || "99:99").localeCompare(b.hora || "99:99"));

function tarjetaMes() {
  const y = cursor.getFullYear(), m = cursor.getMonth();
  const inicio = parseDate(mondayOf(new Date(y, m, 1)));
  const ultimo = new Date(y, m + 1, 0);
  const semanas = Math.ceil((daysBetween(isoDate(inicio), isoDate(ultimo)) + 1) / 7);
  const hoy = todayISO();
  const rejilla = el("div", { class: "mes-rejilla" });
  for (let i = 0; i < semanas * 7; i++) {
    const d = addDays(inicio, i), iso = isoDate(d), fuera = d.getMonth() !== m;
    const evs = fuera ? [] : eventosDia(iso);
    const celda = el("button", {
      type: "button", class: `dia ${fuera ? "fuera" : ""} ${iso === hoy ? "hoy" : ""} ${evs.length >= 2 ? "choque" : ""} ${iso < hoy ? "pasado" : ""}`,
      "aria-label": `${fechaLarga(iso)}${evs.length ? `, ${evs.length} evento${evs.length > 1 ? "s" : ""}` : ""}`,
      onclick: () => { if (fuera) return; vibrar(8); abrirDia(iso); },
    }, el("span", { class: "dia-num", text: d.getDate() }));
    if (evs.length) {
      celda.append(el("span", { class: "dia-chips" },
        ...evs.slice(0, 2).map((e) => el("span", { class: `dia-chip ${e.tipo}`, style: { "--c": colorAsig(e.asignatura_id) }, text: nombreAsig(e.asignatura_id) })),
        evs.length > 2 ? el("span", { class: "dia-chip mas", text: `+${evs.length - 2}` }) : null));
    }
    rejilla.append(celda);
  }
  const mover = (delta) => { vibrar(8); cursor = new Date(y, m + delta, 1); conTransicion(pintar); };
  return el("div", { class: "tarjeta mes" },
    el("div", { class: "mes-cab" },
      el("button", { type: "button", class: "boton-icono", "aria-label": "Mes anterior", html: icono("atras"), onclick: () => mover(-1) }),
      el("h2", { text: `${MESES[m]} ${y}` }),
      el("button", { type: "button", class: "boton-icono", "aria-label": "Mes siguiente", html: icono("chevron"), onclick: () => mover(1) }),
      el("button", { type: "button", class: "boton pequeno secundario", text: "Hoy", onclick: () => { vibrar(8); cursor = today(); conTransicion(pintar); } })),
    el("div", { class: "mes-dias-semana" }, ..."LMXJVSD".split("").map((l) => el("span", { text: l }))),
    rejilla);
}

function abrirDia(iso) {
  const evs = eventosDia(iso);
  const lista = el("div", { class: "lista tarjeta" });
  for (const e of evs) lista.append(filaEvento(e, () => { cerrarHoja(); setTimeout(() => fichaEvento(e.id), 50); }));
  const cont = el("div", { class: "hoja-cuerpo" },
    el("div", { class: "hoja-cabecera" }, el("span"), el("h3", { text: fechaLarga(iso) }),
      el("button", { type: "button", class: "enlace", text: "Cerrar", onclick: cerrarHoja })),
    evs.length ? lista : el("p", { class: "suave centrado", text: "Nada este día." }),
    el("button", { type: "button", class: "boton grande primario", html: `${icono("mas")} Añadir examen o entrega`,
      onclick: () => { vibrar(); cerrarHoja(); setTimeout(() => fichaEvento(null, { fecha: iso, asignatura_id: filtro }), 50); } }));
  abrirHoja(cont);
}

export function filaEvento(e, alTocar) {
  const dias = daysBetween(todayISO(), e.fecha);
  const cuando = dias === 0 ? "hoy" : dias === 1 ? "mañana" : dias > 1 ? `${dias} d` : fechaCorta(e.fecha);
  return el("button", { type: "button", class: "fila-evento", onclick: () => { vibrar(8); alTocar(); } },
    el("span", { class: "barra-color", style: { background: colorAsig(e.asignatura_id) } }),
    el("span", { class: `cuando ${dias >= 0 && dias <= 3 ? "pronto" : ""}`, text: cuando }),
    el("span", { class: "fila-texto" },
      el("strong", { text: nombreAsig(e.asignatura_id) }),
      el("small", { text: `${e.tipo === "examen" ? "Examen" : "Entrega"} · ${fechaCorta(e.fecha)}${e.hora ? ` · ${e.hora}` : ""}${typeof e.nota === "number" ? ` · nota ${String(e.nota).replace(".", ",")}` : ""}` })),
    el("span", { class: "chevron", html: icono("chevron") }));
}

function seccionProximos() {
  const evs = proximosEventos(filtro).filter(visible).slice(0, 8);
  const sec = el("section", { class: "seccion" }, el("div", { class: "seccion-cab" }, el("h2", { text: "Próximos" })));
  if (!evs.length) sec.append(el("p", { class: "suave", text: "Nada por delante. Captura un examen o una entrega desde Hoy." }));
  else sec.append(el("div", { class: "lista tarjeta" }, ...evs.map((e) => filaEvento(e, () => fichaEvento(e.id)))));
  return sec;
}

function seccionCalor() {
  const ini = parseDate(mondayOf(parseDate(DB.meta.cuatrimestre_inicio)));
  const fin = parseDate(DB.meta.cuatrimestre_fin);
  const celdas = [];
  for (let c = new Date(ini), g = 0; c <= fin && g < 60; c = addDays(c, 7), g++) celdas.push({ lunes: isoDate(c), ...cargaSemana(isoDate(c)) });
  const max = celdas.reduce((m, c) => Math.max(m, c.total), 0);
  const hoyLunes = mondayOf(today());
  const fila = el("div", { class: "calor" });
  const detalle = el("div", { class: "calor-detalle suave", text: "Toca una semana para ver qué tenía." });
  celdas.forEach((c) => {
    const d = parseDate(c.lunes);
    fila.append(el("div", { class: "calor-col" },
      el("span", { class: "calor-mes", text: d.getDate() <= 7 ? MESES[d.getMonth()].slice(0, 3) : "" }),
      el("button", { type: "button", class: `calor-celda n${nivelCarga(c.total, max)} ${c.lunes === hoyLunes ? "actual" : ""}`, "aria-label": `Semana del ${formatDMY(c.lunes)}`,
        onclick: () => {
          vibrar(8);
          const finS = sumarDias(c.lunes, 6);
          const evs = DB.eventos.filter((e) => e.fecha >= c.lunes && e.fecha <= finS);
          const atrasados = temasActivos().filter((t) => !t.fecha_ultimo_repaso || daysBetween(t.fecha_ultimo_repaso, c.lunes) >= 10).length;
          detalle.textContent = `Semana del ${fechaCorta(c.lunes)}: ${evs.length ? evs.map((e) => `${e.tipo} de ${nombreAsig(e.asignatura_id)} (${fechaCorta(e.fecha)})`).join(", ") : "sin exámenes ni entregas"}${atrasados ? ` · ${atrasados} temas llevaban 10+ días sin repasar` : ""}.`;
        } })));
  });
  return el("section", { class: "seccion" },
    el("div", { class: "seccion-cab" }, el("h2", { text: "Carga del cuatrimestre" })),
    el("div", { class: "tarjeta" },
      el("div", { class: "calor-scroll" }, fila),
      el("div", { class: "calor-leyenda" }, el("span", { text: "menos" }), ...[0, 1, 2, 3, 4].map((n) => el("i", { class: `calor-celda n${n}` })), el("span", { text: "más" })),
      detalle));
}
