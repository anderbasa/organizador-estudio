// Pestaña "Asignaturas": lista y, al tocar una, su ficha completa con
// exámenes, plan hasta el examen, temas (repaso espaciado), calculadora de
// nota y ajustes.
import {
  DB, guardar, uid, asig, activasAsignaturas, temasDe, eventosDe, nuevoTema, ordenarPorFechaHora,
} from "../datos.js";
import {
  infoTema, planExamen, calcularNota, mediaAsignatura, minutosTotalesAsig, paraHoy, repasadoHoy,
} from "../estudio.js";
import { todayISO, daysBetween, fechaCorta, sumarDias, minutosTexto, diaSemanaCorto, normalize } from "../fechas.js";
import { el, esc, icono, vibrar, aviso, confirmar, deslizable, fmtNota, conTransicion, contar } from "../ui.js";
import { fichaEvento, fichaTema, fichaNuevaAsignatura, repasoConDeshacer, hacer, selectorColor } from "../fichas.js";
import { filaEvento } from "./calendario.js";

let raiz, cuerpo;
let abierta = null;
let verArchivadas = false;

export function montar(cont) {
  raiz = cont;
  cont.append(cuerpo = el("div", { class: "pila" }));
}

export function abrir(id) { abierta = id; pintar(); raiz.scrollTop = 0; }
export function nueva() { fichaNuevaAsignatura((a) => { abierta = a.id; }); }
export const estaEnDetalle = () => !!abierta;
export function volver() { abierta = null; conTransicion(pintar); }

export function pintar() {
  if (abierta && !asig(abierta)) abierta = null;
  cuerpo.replaceChildren(abierta ? detalle(asig(abierta)) : lista());
}

/* ================= Lista ================= */

const iniciales = (n) => n.split(/\s+/).filter((p) => p.length > 2 || /^[A-ZÁÉÍÓÚ]/.test(p)).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || n.slice(0, 2).toUpperCase();

function lista() {
  const activas = activasAsignaturas();
  const archivadas = DB.asignaturas.filter((a) => a.archivada);
  const hoy = paraHoy();
  const cab = el("header", { class: "barra" }, el("h1", { class: "titulo-grande", text: "Asignaturas" }),
    el("button", { type: "button", class: "boton-redondo", "aria-label": "Nueva asignatura", html: icono("mas"), onclick: () => { vibrar(8); nueva(); } }));
  const c = el("div", { class: "cuerpo" });
  if (!activas.length) {
    c.append(el("div", { class: "tarjeta vacio-hoy" },
      el("img", { src: "icons/sello.png", alt: "", width: 64, height: 64 }),
      el("strong", { text: "Empieza por tus asignaturas" }),
      el("span", { text: "Con ellas la captura reconoce lo que escribes, y cada una tendrá su color, sus temas y su nota." }),
      el("button", { type: "button", class: "boton grande primario", html: `${icono("mas")} Añadir asignatura`, onclick: () => { vibrar(); nueva(); } })));
  }
  const tarjeta = (a) => {
    const prox = eventosDe(a.id).filter((e) => e.fecha >= todayISO()).sort(ordenarPorFechaHora)[0];
    const nHoy = hoy.filter((x) => x.tema.asignatura_id === a.id && !repasadoHoy(x.tema)).length;
    const calc = calcularNota(a);
    const nota = calc.pesoEvaluado ? calc.media : mediaAsignatura(a.id);
    const partes = [];
    if (prox) { const d = daysBetween(todayISO(), prox.fecha); partes.push(`${prox.tipo === "examen" ? "Examen" : "Entrega"} ${d === 0 ? "hoy" : d === 1 ? "mañana" : `en ${d} d`}`); }
    const nTemas = temasDe(a.id).length;
    partes.push(nHoy ? `${nHoy} para hoy` : `${nTemas} ${nTemas === 1 ? "tema" : "temas"}`);
    return el("button", { type: "button", class: `tarjeta asig-tarjeta ${a.archivada ? "archivada" : ""}`, style: { "--c": a.color },
      onclick: () => { vibrar(8); abierta = a.id; conTransicion(() => { pintar(); raiz.scrollTop = 0; }); } },
      el("span", { class: "asig-ico", text: iniciales(a.nombre) }),
      el("span", { class: "fila-texto" }, el("strong", { text: a.nombre }), el("small", { text: partes.join(" · ") })),
      nota != null ? el("span", { class: `asig-nota ${nota >= 9.5 ? "mh" : nota >= 5 ? "ok" : "mal"}` }, el("b", { text: fmtNota(nota) }), el("small", { text: calc.pesoEvaluado ? "actual" : "media" })) : null,
      el("span", { class: "chevron", html: icono("chevron") }));
  };
  c.append(el("div", { class: "lista-asig" }, ...activas.map(tarjeta)));
  if (archivadas.length) {
    c.append(el("button", { type: "button", class: "enlace bloque", text: `${verArchivadas ? "Ocultar" : "Ver"} archivadas (${archivadas.length})`,
      onclick: () => { vibrar(8); verArchivadas = !verArchivadas; pintar(); } }));
    if (verArchivadas) c.append(el("div", { class: "lista-asig" }, ...archivadas.map(tarjeta)));
  }
  return el("div", { class: "pagina" }, cab, c);
}

/* ================= Detalle ================= */

function detalle(a) {
  const calc = calcularNota(a);
  const nota = calc.pesoEvaluado ? calc.media : mediaAsignatura(a.id);
  const temas = temasDe(a.id);
  const pendHoy = temas.filter((t) => t.proximo_repaso <= todayISO() && !repasadoHoy(t)).length;
  const minutos = minutosTotalesAsig(a.id);
  const cifraNota = el("b"), cifraMin = el("b"), cifraHoy = el("b");
  const pagina = el("div", { class: "pagina detalle", style: { "--c": a.color } },
    el("header", { class: "barra barra-detalle" },
      el("button", { type: "button", class: "enlace atras", html: `${icono("atras")} Asignaturas`, onclick: () => { vibrar(8); volver(); } })),
    el("div", { class: "detalle-hero" },
      el("span", { class: "asig-ico grande", text: iniciales(a.nombre) }),
      el("h1", { text: a.nombre }),
      a.archivada ? el("span", { class: "etiqueta", text: "Archivada" }) : null,
      el("div", { class: "detalle-stats" },
        el("div", {}, cifraNota, el("small", { text: calc.pesoEvaluado ? "nota actual" : "media" })),
        el("div", {}, cifraMin, el("small", { text: "estudiado" })),
        el("div", {}, cifraHoy, el("small", { text: "para hoy" })))),
    el("div", { class: "cuerpo" },
      seccionEventos(a), seccionPlan(a), seccionTemas(a, temas), seccionEvaluacion(a, calc), seccionAjustes(a)));
  if (nota != null) contar(cifraNota, nota, { decimales: 1, duracion: 600 }); else cifraNota.textContent = "—";
  cifraMin.textContent = minutos ? minutosTexto(minutos) : "0 min";
  cifraHoy.textContent = String(pendHoy);
  return pagina;
}

function seccion(titulo, ...hijos) {
  return el("section", { class: "seccion" }, el("div", { class: "seccion-cab" }, el("h2", { text: titulo })), ...hijos);
}

function seccionEventos(a) {
  const hoy = todayISO();
  const evs = eventosDe(a.id).sort(ordenarPorFechaHora);
  const futuros = evs.filter((e) => e.fecha >= hoy), pasados = evs.filter((e) => e.fecha < hoy).reverse().slice(0, 5);
  const lista = el("div", { class: "lista tarjeta" },
    ...futuros.map((e) => filaEvento(e, () => fichaEvento(e.id))),
    ...pasados.map((e) => filaEvento(e, () => fichaEvento(e.id))),
    el("button", { type: "button", class: "fila-anadir", html: `${icono("mas")} Añadir examen o entrega`, onclick: () => { vibrar(8); fichaEvento(null, { asignatura_id: a.id }); } }));
  return seccion("Exámenes y entregas", lista);
}

function seccionPlan(a) {
  const hoy = todayISO();
  const examen = eventosDe(a.id).filter((e) => e.tipo === "examen" && e.fecha > hoy).sort(ordenarPorFechaHora)[0];
  if (!examen) return null;
  const plan = planExamen(examen);
  const titulo = `Plan · examen del ${fechaCorta(examen.fecha)}`;
  if (!plan) {
    const ventana = DB.meta.plan_dias || 21;
    return seccion(titulo, el("p", { class: "suave", text: `El plan día a día empieza ${ventana} días antes, el ${fechaCorta(sumarDias(examen.fecha, -ventana))}.` }));
  }
  if (!plan.total) return seccion(titulo, el("p", { class: "suave", text: "Añade los temas de la asignatura (abajo) y te los reparto en los días que quedan." }));
  const dias = el("div", { class: "plan-dias tarjeta" });
  plan.dias.forEach((d, i) => {
    if (!d.temas.length && !d.general) return;
    const etiqueta = i === 0 ? "Hoy" : i === 1 ? "Mañana" : `${diaSemanaCorto(d.fecha)} ${fechaCorta(d.fecha)}`;
    dias.append(el("div", { class: `plan-dia ${i === 0 ? "hoy" : ""}` },
      el("span", { class: "plan-fecha", text: etiqueta }),
      el("div", { class: "plan-temas" },
        d.general ? el("span", { class: "chip general", text: "Repaso general de todo" }) : null,
        ...d.temas.map((t) => el("button", { type: "button", class: `chip ${repasadoHoy(t) ? "hecho" : ""}`,
          html: `${repasadoHoy(t) ? icono("check") : ""}${esc(t.nombre)}`, onclick: () => { vibrar(8); fichaTema(t.id); } })))));
  });
  const p = plan.total ? plan.listos / plan.total : 0;
  return seccion(titulo,
    el("div", { class: "progreso grande" },
      el("div", { class: "progreso-barra" }, el("i", { style: { width: `${100 * p}%` } })),
      el("span", { text: `${plan.listos} de ${plan.total} temas listos · faltan ${plan.diasHasta} ${plan.diasHasta === 1 ? "día" : "días"}` })),
    dias);
}

function seccionTemas(a, temas) {
  const lista = el("div", { class: "lista tarjeta" });
  const orden = temas.map((t) => ({ t, i: infoTema(t) })).sort((x, y) => y.i.urgencia - x.i.urgencia);
  for (const { t, i } of orden) {
    const fila = el("div", { class: `fila-desl ${i.hecho ? "hecho" : ""}` },
      el("div", { class: "desl-fondo", html: `${icono("check")}<span>Repasado</span>` }),
      el("div", { class: "desl-contenido", role: "button", tabindex: 0, onclick: () => { vibrar(8); fichaTema(t.id); } },
        el("span", { class: `punto-estado ${i.color}` }),
        el("span", { class: "fila-texto" }, el("strong", { text: t.nombre }),
          el("small", { text: `${i.texto}${t.dias_evitado_consecutivos > 0 ? ` · propuesto ${t.dias_evitado_consecutivos} d sin tocar` : ""}` })),
        t.dificultad === "cuesta_arriba" ? el("span", { class: "etiqueta-dura", text: "duro" }) : null,
        el("span", { class: "chevron", html: icono("chevron") })));
    if (!i.hecho) deslizable(fila, () => repasoConDeshacer(t.id, "bien"));
    lista.append(fila);
  }
  const input = el("input", { class: "control", placeholder: "Tema 1, Tema 2, Tema 3…", "aria-label": "Nuevos temas", enterkeyhint: "done" });
  const anadir = () => {
    vibrar();
    const nombres = input.value.split(/[,\n;]/).map((s) => s.trim()).filter(Boolean);
    if (!nombres.length) return input.focus();
    const existentes = new Set(temasDe(a.id).map((t) => normalize(t.nombre)));
    const nuevos = nombres.filter((n) => !existentes.has(normalize(n)));
    input.value = "";
    if (!nuevos.length) return aviso("Esos temas ya estaban", { tipo: "aviso" });
    hacer(nuevos.length === 1 ? `Tema “${nuevos[0]}” añadido` : `${nuevos.length} temas añadidos`, () => {
      for (const n of nuevos) DB.temas.push(nuevoTema(a.id, n));
    });
  };
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); anadir(); } });
  lista.append(el("div", { class: "fila-input" }, input, el("button", { type: "button", class: "boton pequeno primario", text: "Añadir", onclick: anadir })));
  return seccion(`Temas (${temas.length})`, lista,
    temas.length ? el("p", { class: "suave pie", text: "Cada tema vuelve a tocar a los 1, 3, 7, 14, 30 y 60 días según lo bien que te vaya. Desliza a la derecha para marcarlo como repasado." }) : null);
}

function seccionEvaluacion(a, calc) {
  const lista = el("div", { class: "lista tarjeta" });
  const evs = eventosDe(a.id).sort(ordenarPorFechaHora);
  const actualizar = (id, cambios) => {
    const x = asig(a.id); if (!x) return;
    const c = x.evaluacion.find((y) => y.id === id); if (!c) return;
    Object.assign(c, cambios); guardar();
  };
  for (const c of calc.comps) {
    const inNombre = el("input", { class: "control", value: c.nombre, "aria-label": "Parte" });
    const inPeso = el("input", { class: "control corto", type: "number", inputmode: "decimal", min: 0, max: 100, value: c.peso ?? "", "aria-label": "Peso %" });
    const selEv = el("select", { class: "control", "aria-label": "Vincular con" }, el("option", { value: "", text: "Nota a mano" }),
      ...evs.map((e) => el("option", { value: e.id, text: `${e.tipo === "examen" ? "Examen" : "Entrega"} ${fechaCorta(e.fecha)}` })));
    selEv.value = c.evento_id || "";
    const inNota = el("input", { class: "control corto", type: "number", inputmode: "decimal", min: 0, max: 10, step: 0.1, value: c.evento_id ? (c.evento?.nota ?? "") : (c.nota ?? ""),
      placeholder: "—", disabled: c.evento_id ? true : null, "aria-label": "Nota" });
    inNombre.addEventListener("change", () => actualizar(c.id, { nombre: inNombre.value.trim() || c.nombre }));
    inPeso.addEventListener("change", () => actualizar(c.id, { peso: Math.max(0, Math.min(100, parseFloat(inPeso.value) || 0)) }));
    selEv.addEventListener("change", () => actualizar(c.id, { evento_id: selEv.value || null }));
    inNota.addEventListener("change", () => {
      const n = parseFloat(String(inNota.value).replace(",", "."));
      actualizar(c.id, { nota: Number.isNaN(n) ? null : Math.max(0, Math.min(10, n)) });
    });
    lista.append(el("div", { class: "fila-eval" },
      el("div", { class: "eval-linea" }, inNombre,
        el("label", { class: "con-sufijo" }, inPeso, el("span", { text: "%" })),
        el("button", { type: "button", class: "boton-icono suave", "aria-label": "Quitar", html: icono("x"), onclick: () => {
          vibrar(8);
          hacer("Parte quitada", () => { const x = asig(a.id); x.evaluacion = x.evaluacion.filter((y) => y.id !== c.id); }, { tipo: "aviso" });
        } })),
      el("div", { class: "eval-linea" }, selEv, el("label", { class: "con-sufijo" }, inNota, el("span", { text: "/10" })))));
  }
  lista.append(el("button", { type: "button", class: "fila-anadir", html: `${icono("mas")} Añadir parte de la nota`, onclick: () => {
    vibrar(8);
    const x = asig(a.id); if (!x) return;
    const restante = Math.max(0, 100 - x.evaluacion.reduce((s, y) => s + (Number(y.peso) || 0), 0));
    const sugerido = x.evaluacion.length ? `Parte ${x.evaluacion.length + 1}` : "Examen final";
    x.evaluacion.push({ id: uid(), nombre: sugerido, peso: restante || 0, nota: null, evento_id: null });
    guardar();
  } }));

  const resumen = el("div", { class: "tarjeta calc" });
  if (!calc.comps.length) {
    resumen.append(el("p", { class: "suave", text: "Pon cómo se evalúa (p. ej. Parcial 30 %, Prácticas 20 %, Final 50 %) y te calculo tu nota y lo que necesitas sacar." }));
  } else {
    if (Math.round(calc.pesoTotal) !== 100) resumen.append(el("p", { class: "aviso-linea", text: `Los pesos suman ${fmtNota(calc.pesoTotal)} %, no 100 %.` }));
    resumen.append(el("div", { class: "calc-cabeza" },
      el("div", {}, el("b", { text: fmtNota(calc.puntos) }), el("small", { text: "puntos asegurados" })),
      el("div", {}, el("b", { text: `${fmtNota(calc.pesoEvaluado)} %` }), el("small", { text: "evaluado" })),
      el("div", {}, el("b", { text: calc.media == null ? "—" : fmtNota(calc.media) }), el("small", { text: "media hasta ahora" }))));
    if (calc.final != null) {
      resumen.append(el("p", { class: "calc-final", text: `Nota final: ${fmtNota(calc.final)}${calc.final >= 9.5 ? " · ¡a por la MH!" : calc.final >= (DB.meta.nota_aprobado || 5) ? " · aprobada" : ""}` }));
    } else {
      resumen.append(el("div", { class: "objetivos" }, ...calc.objetivos.map((o) => {
        let texto, clase;
        if (o.conseguido) { texto = "conseguido"; clase = "ok"; }
        else if (o.necesitas > 10) { texto = `imposible (harían falta ${fmtNota(o.necesitas)})`; clase = "no"; }
        else if (o.necesitas <= 0) { texto = "ya lo tienes"; clase = "ok"; }
        else { texto = `necesitas ${fmtNota(Math.ceil(o.necesitas * 100) / 100)} en el ${fmtNota(calc.pesoRestante)} % que queda`; clase = o.necesitas > 8 ? "dificil" : "posible"; }
        return el("div", { class: `objetivo ${clase}` }, el("span", { class: "obj-nombre", text: `${o.nombre} (${fmtNota(o.nota)})` }), el("span", { text: texto }));
      })));
    }
  }
  return seccion("Calculadora de nota", lista, resumen);
}

function seccionAjustes(a) {
  const inNombre = el("input", { class: "control", value: a.nombre, "aria-label": "Nombre" });
  const inAlias = el("input", { class: "control", value: (a.alias || []).join(", "), placeholder: "alias separados por comas", "aria-label": "Alias" });
  inNombre.addEventListener("change", () => { const x = asig(a.id); const v = inNombre.value.trim(); if (x && v) { x.nombre = v; guardar(); } });
  inAlias.addEventListener("change", () => { const x = asig(a.id); if (x) { x.alias = inAlias.value.split(",").map((s) => s.trim()).filter(Boolean); guardar(); } });
  return seccion("Ajustes",
    el("div", { class: "grupo" },
      el("div", { class: "campo" }, el("span", { class: "campo-etiqueta", text: "Nombre" }), inNombre),
      el("div", { class: "campo" }, el("span", { class: "campo-etiqueta", text: "Alias" }), inAlias)),
    el("p", { class: "suave pie", text: "Los alias son las palabras con las que la captura reconoce la asignatura." }),
    el("div", { class: "grupo relleno" }, selectorColor(a.color, (c) => { const x = asig(a.id); if (x) { x.color = c; guardar(); } })),
    el("div", { class: "fila-botones" },
      el("button", { type: "button", class: "boton grande secundario", html: `${icono("archivo")} ${a.archivada ? "Desarchivar" : "Archivar"}`, onclick: () => {
        vibrar();
        hacer(a.archivada ? `${a.nombre} vuelve a estar activa` : `${a.nombre} archivada: no saldrá en Hoy ni en la captura`, () => { const x = asig(a.id); x.archivada = !x.archivada; });
      } }),
      el("button", { type: "button", class: "boton grande peligro-suave", html: `${icono("papelera")} Eliminar`, onclick: async () => {
        vibrar();
        const ok = await confirmar(`¿Eliminar ${a.nombre}?`, { detalle: "Se borran también sus temas, exámenes y sesiones. Si solo has terminado el cuatrimestre, mejor archívala.", textoOk: "Eliminar" });
        if (!ok) return;
        abierta = null;
        hacer(`${a.nombre} eliminada`, () => {
          DB.asignaturas = DB.asignaturas.filter((x) => x.id !== a.id);
          DB.temas = DB.temas.filter((x) => x.asignatura_id !== a.id);
          DB.eventos = DB.eventos.filter((x) => x.asignatura_id !== a.id);
          DB.sesiones = DB.sesiones.filter((x) => x.asignatura_id !== a.id);
        }, { tipo: "aviso" });
      } })));
}
