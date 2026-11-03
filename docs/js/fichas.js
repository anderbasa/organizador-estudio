// Hojas de edición que se abren desde varias pestañas.
import {
  DB, guardar, instantanea, restaurar, uid, asig, nombreAsig, colorAsig, opcionesAsignaturas, activasAsignaturas,
  COLORES, normalizarAsignatura, normalizarEvento, temasDe,
} from "./datos.js";

export { campo, segmentado };
import { el, icono, abrirHoja, cerrarHoja, aviso, vibrar } from "./ui.js";
import { registrarRepaso, infoTema, INTERVALOS } from "./estudio.js";
import { todayISO, formatDMY } from "./fechas.js";
import { irA } from "./navegacion.js";

// Aplica un cambio, lo guarda y ofrece deshacerlo desde el aviso.
export function hacer(texto, fn, { tipo = "ok" } = {}) {
  const copia = instantanea();
  fn();
  guardar();
  aviso(texto, { tipo, accion: { texto: "Deshacer", alPulsar: () => { restaurar(copia); aviso("Deshecho"); } } });
}

const campo = (etiqueta, control, extra = null) =>
  el("div", { class: "campo" }, el("span", { class: "campo-etiqueta", text: etiqueta }), control, extra);

function selectorAsignatura(valor, incluirId) {
  const sel = el("select", { class: "control" });
  for (const a of opcionesAsignaturas(incluirId)) sel.append(el("option", { value: a.id, text: a.nombre }));
  if (valor) sel.value = valor;
  return sel;
}

function segmentado(opciones, valor, alCambiar) {
  const cont = el("div", { class: "segmentado", role: "radiogroup" });
  const pintar = (v) => cont.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.v === v)));
  for (const [v, texto] of opciones) {
    cont.append(el("button", { type: "button", role: "radio", "data-v": v, text: texto, onclick: () => { vibrar(8); pintar(v); alCambiar(v); } }));
  }
  pintar(valor);
  return cont;
}

/* ================= Examen / entrega ================= */

export function fichaEvento(id = null, { fecha = null, asignatura_id = null } = {}) {
  const existente = id ? DB.eventos.find((e) => e.id === id) : null;
  if (!activasAsignaturas().length && !existente) {
    aviso("Primero añade una asignatura", { tipo: "aviso" });
    return irA("asignaturas", { nueva: true });
  }
  const e = existente ? { ...existente } : normalizarEvento({
    id: uid(), asignatura_id: asignatura_id || activasAsignaturas()[0].id, tipo: "examen",
    fecha: fecha || todayISO(), hora: null, nota: null, temas_relacionados: [], texto_original: "",
  });
  const selAsig = selectorAsignatura(e.asignatura_id, e.asignatura_id);
  const inFecha = el("input", { type: "date", class: "control", value: e.fecha });
  const inHora = el("input", { type: "time", class: "control", value: e.hora || "" });
  const inNota = el("input", { type: "number", class: "control", min: 0, max: 10, step: 0.1, inputmode: "decimal", placeholder: "—", value: e.nota ?? "" });
  const temasCont = el("div", { class: "chips-temas" });
  const pintarTemas = () => {
    temasCont.replaceChildren();
    const temas = temasDe(selAsig.value);
    if (!temas.length) { temasCont.append(el("span", { class: "suave", text: "Sin temas en esta asignatura: el plan usará todos los que añadas." })); return; }
    for (const t of temas) {
      const on = e.temas_relacionados.includes(t.id);
      temasCont.append(el("button", {
        type: "button", class: `chip ${on ? "activo" : ""}`, text: t.nombre,
        onclick: (ev) => {
          vibrar(8);
          e.temas_relacionados = on ? e.temas_relacionados.filter((x) => x !== t.id) : [...e.temas_relacionados, t.id];
          pintarTemas();
        },
      }));
    }
  };
  selAsig.addEventListener("change", () => { e.temas_relacionados = []; pintarTemas(); });
  pintarTemas();

  const guardarEv = () => {
    vibrar();
    if (!inFecha.value) return aviso("Pon una fecha", { tipo: "aviso" });
    const nota = inNota.value === "" ? null : Math.max(0, Math.min(10, parseFloat(inNota.value.replace(",", "."))));
    const datos = { ...e, asignatura_id: selAsig.value, fecha: inFecha.value, hora: inHora.value || null, nota: Number.isNaN(nota) ? null : nota };
    cerrarHoja();
    hacer(existente ? "Guardado" : `${datos.tipo === "examen" ? "Examen" : "Entrega"} de ${nombreAsig(datos.asignatura_id)} añadido`, () => {
      if (existente) Object.assign(DB.eventos.find((x) => x.id === id) || {}, datos);
      else DB.eventos.push(datos);
    });
  };

  const cont = el("div", { class: "hoja-cuerpo" },
    el("div", { class: "hoja-cabecera" },
      el("button", { type: "button", class: "enlace", text: "Cancelar", onclick: cerrarHoja }),
      el("h3", { text: existente ? "Editar" : "Nuevo" }),
      el("button", { type: "button", class: "enlace fuerte", text: "Guardar", onclick: guardarEv })),
    el("div", { class: "grupo" },
      campo("Asignatura", selAsig),
      campo("Tipo", segmentado([["examen", "Examen"], ["entrega", "Entrega"]], e.tipo, (v) => (e.tipo = v))),
      campo("Fecha", inFecha),
      campo("Hora", inHora, el("span", { class: "campo-nota", text: "opcional" })),
      campo("Nota", inNota, el("span", { class: "campo-nota", text: "cuando la sepas" }))),
    el("p", { class: "grupo-titulo", text: "Temas que entran" }),
    el("div", { class: "grupo relleno" }, temasCont),
    e.texto_original ? el("p", { class: "suave pie", text: `Capturado como: “${e.texto_original}”` }) : null,
    existente ? el("button", {
      type: "button", class: "boton grande peligro-suave", html: `${icono("papelera")} Borrar`,
      onclick: () => { vibrar(); cerrarHoja(); hacer("Borrado", () => { DB.eventos = DB.eventos.filter((x) => x.id !== id); }, { tipo: "aviso" }); },
    }) : null);
  abrirHoja(cont);
}

/* ================= Tema: repasar, concentrarse, editar ================= */

const CALIDADES = [
  ["dificil", "Me costó", "😮‍💨"],
  ["bien", "Bien", "🙂"],
  ["facil", "Fácil", "😎"],
];

export function fichaTema(temaId) {
  const t = DB.temas.find((x) => x.id === temaId);
  if (!t) return;
  const info = infoTema(t);
  const a = asig(t.asignatura_id);
  const inNombre = el("input", { class: "control", value: t.nombre });
  const cont = el("div", { class: "hoja-cuerpo" },
    el("div", { class: "ficha-tema-cab" },
      el("span", { class: "punto-asig", style: { background: colorAsig(t.asignatura_id) } }),
      el("div", {},
        el("h3", { text: t.nombre }),
        el("p", { class: "suave", text: `${a?.nombre || ""} · ${info.texto}` }))),
    el("p", { class: "grupo-titulo", text: "¿Qué tal el repaso?" }),
    el("div", { class: "calidades" },
      ...CALIDADES.map(([v, texto, emoji]) => el("button", {
        type: "button", class: `calidad ${v}`,
        html: `<span class="calidad-emoji">${emoji}</span><span>${texto}</span><small>vuelve en ${INTERVALOS[nivelTras(t, v)]} d</small>`,
        onclick: () => { vibrar(); cerrarHoja(); repasoConDeshacer(t.id, v); },
      }))),
    el("button", {
      type: "button", class: "boton grande primario", html: `${icono("foco")} Concentrarme con este tema`,
      onclick: () => { vibrar(); cerrarHoja(); irA("foco", { asignatura_id: t.asignatura_id, tema_id: t.id }); },
    }),
    el("div", { class: "grupo" },
      campo("Nombre", inNombre),
      campo("Dificultad", segmentado([["cuesta_arriba", "Cuesta arriba"], ["repaso_rapido", "Repaso rápido"]], t.dificultad, (v) => {
        const x = DB.temas.find((y) => y.id === t.id); if (x) { x.dificultad = v; guardar(); }
      }))),
    el("div", { class: "datos-tema suave" },
      el("span", { text: t.fecha_ultimo_repaso ? `Último repaso: ${formatDMY(t.fecha_ultimo_repaso)}` : "Aún sin repasar" }),
      el("span", { text: `Nivel ${t.nivel || 0} de ${INTERVALOS.length - 1}` }),
      t.dias_evitado_consecutivos > 0 ? el("span", { text: `Propuesto ${t.dias_evitado_consecutivos} ${t.dias_evitado_consecutivos === 1 ? "día" : "días"} sin tocarlo` }) : null),
    el("button", {
      type: "button", class: "boton grande peligro-suave", html: `${icono("papelera")} Borrar tema`,
      onclick: () => {
        vibrar(); cerrarHoja();
        hacer("Tema borrado", () => {
          DB.temas = DB.temas.filter((x) => x.id !== t.id);
          DB.eventos.forEach((e) => { e.temas_relacionados = (e.temas_relacionados || []).filter((x) => x !== t.id); });
        }, { tipo: "aviso" });
      },
    }));
  abrirHoja(cont, {
    alCerrar: () => {
      const nuevo = inNombre.value.trim();
      const x = DB.temas.find((y) => y.id === t.id);
      if (x && nuevo && nuevo !== x.nombre) { x.nombre = nuevo; guardar(); }
    },
  });
}

function nivelTras(t, calidad) {
  const n = t.nivel || 0, max = INTERVALOS.length - 1;
  return calidad === "dificil" ? Math.max(0, n - 1) : calidad === "facil" ? Math.min(max, n + 2) : Math.min(max, n + 1);
}

// Marca el repaso y ofrece deshacerlo (usado al deslizar y desde la ficha).
export function repasoConDeshacer(temaId, calidad = "bien") {
  const t = DB.temas.find((x) => x.id === temaId);
  if (!t) return;
  const copia = instantanea();
  const dias = registrarRepaso(t, calidad);
  guardar();
  aviso(`“${t.nombre}” repasado · vuelve ${dias === 1 ? "mañana" : `en ${dias} días`}`, {
    accion: { texto: "Deshacer", alPulsar: () => restaurar(copia) },
  });
}

/* ================= Asignatura nueva ================= */

export function selectorColor(valor, alCambiar) {
  const cont = el("div", { class: "paleta", role: "radiogroup" });
  const pintar = (v) => cont.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.c === v)));
  for (const c of COLORES) {
    cont.append(el("button", { type: "button", role: "radio", "data-c": c, style: { background: c }, "aria-label": c,
      onclick: () => { vibrar(8); pintar(c); alCambiar(c); } }));
  }
  pintar(valor);
  return cont;
}

export function fichaNuevaAsignatura(alCrear = null) {
  const usados = new Set(DB.asignaturas.map((a) => a.color));
  let color = COLORES.find((c) => !usados.has(c)) || COLORES[0];
  const inNombre = el("input", { class: "control", placeholder: "Econometría", autocapitalize: "sentences" });
  const inAlias = el("input", { class: "control", placeholder: "econo, eco" });
  const crear = () => {
    vibrar();
    const nombre = inNombre.value.trim();
    if (!nombre) return aviso("Escribe el nombre", { tipo: "aviso" });
    const a = normalizarAsignatura({ id: uid(), nombre, alias: inAlias.value.split(",").map((s) => s.trim()).filter(Boolean), color, archivada: false, evaluacion: [] });
    cerrarHoja();
    hacer(`${nombre} añadida`, () => DB.asignaturas.push(a));
    alCrear?.(a);
  };
  const cont = el("div", { class: "hoja-cuerpo" },
    el("div", { class: "hoja-cabecera" },
      el("button", { type: "button", class: "enlace", text: "Cancelar", onclick: cerrarHoja }),
      el("h3", { text: "Nueva asignatura" }),
      el("button", { type: "button", class: "enlace fuerte", text: "Añadir", onclick: crear })),
    el("div", { class: "grupo" },
      campo("Nombre", inNombre),
      campo("Alias", inAlias, el("span", { class: "campo-nota", text: "separados por comas" }))),
    el("p", { class: "suave pie", text: "Los alias son palabras cortas con las que la reconocerá la captura (\"conta\" → Contabilidad)." }),
    el("p", { class: "grupo-titulo", text: "Color" }),
    el("div", { class: "grupo relleno" }, selectorColor(color, (c) => (color = c))));
  abrirHoja(cont);
  setTimeout(() => inNombre.focus(), 350);
}
