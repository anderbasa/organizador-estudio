// Lógica de estudio: repaso espaciado, plan hasta el examen, "Para hoy",
// notas y calculadora, carga semanal y minutos de concentración.
import { DB, asig, temasActivos, ordenarPorFechaHora } from "./datos.js";
import { todayISO, sumarDias, daysBetween, mondayOf, today } from "./fechas.js";

/* ================= Repaso espaciado ================= */

// Tras un repaso, el tema vuelve a tocar al cabo de estos días según su nivel.
export const INTERVALOS = [1, 3, 7, 14, 30, 60];
const MAX_NIVEL = INTERVALOS.length - 1;

// calidad: "dificil" (me costó) | "bien" | "facil"
export function registrarRepaso(tema, calidad = "bien") {
  const n = tema.nivel || 0;
  const nuevo = calidad === "dificil" ? Math.max(0, n - 1) : calidad === "facil" ? Math.min(MAX_NIVEL, n + 2) : Math.min(MAX_NIVEL, n + 1);
  tema.nivel = nuevo;
  tema.fecha_ultimo_repaso = todayISO();
  tema.proximo_repaso = sumarDias(todayISO(), INTERVALOS[nuevo]);
  tema.dias_evitado_consecutivos = 0;
  return INTERVALOS[nuevo];
}

export const repasadoHoy = (t) => t.fecha_ultimo_repaso === todayISO();

// Días hasta el próximo examen/entrega relacionado con el tema (o null).
export function eventoProximoDeTema(t) {
  const hoy = todayISO();
  let mejor = null;
  for (const e of DB.eventos) {
    if (e.fecha < hoy) continue;
    if (e.asignatura_id !== t.asignatura_id && !(e.temas_relacionados || []).includes(t.id)) continue;
    const d = daysBetween(hoy, e.fecha);
    if (mejor === null || d < mejor) mejor = d;
  }
  return mejor;
}

// Estado del tema para pintarlo: texto, color y una puntuación de urgencia.
export function infoTema(t) {
  const hoy = todayISO();
  const dias = daysBetween(hoy, t.proximo_repaso || hoy);
  const evDias = eventoProximoDeTema(t);
  const hecho = repasadoHoy(t);
  let texto, color;
  if (hecho) { texto = "repasado hoy"; color = "verde"; }
  else if (!t.fecha_ultimo_repaso) { texto = "sin empezar"; color = dias <= 0 ? "ambar" : "gris"; }
  else if (dias < 0) { texto = `toca desde hace ${-dias} d`; color = dias <= -3 ? "rojo" : "ambar"; }
  else if (dias === 0) { texto = "toca hoy"; color = "ambar"; }
  else { texto = `próximo repaso en ${dias} d`; color = "verde"; }
  let bonus = 0;
  if (evDias !== null) bonus = evDias <= 7 ? 12 : evDias <= 14 ? 6 : 2;
  if (!hecho && evDias !== null && evDias <= 7 && color !== "rojo") color = dias <= 0 ? "rojo" : color;
  const urgencia = -dias + bonus + (t.dificultad === "cuesta_arriba" ? 1 : 0) - (hecho ? 100 : 0);
  return { dias, evDias, texto, color, urgencia, hecho };
}

/* ================= Plan hasta el examen ================= */

export function temasDelEvento(ev) {
  const rel = (ev.temas_relacionados || []).map((id) => DB.temas.find((t) => t.id === id)).filter(Boolean);
  return rel.length ? rel : DB.temas.filter((t) => t.asignatura_id === ev.asignatura_id);
}

// Reparte los temas aún sin preparar entre los días que quedan hasta el
// examen (el último, si hay margen, se reserva para un repaso general). Se
// calcula de nuevo cada día, así que lo que no se haga se redistribuye solo.
// Un tema está listo si se repasó dentro de la ventana del plan y su repaso
// espaciado no ha vencido (si vuelve a tocar antes del examen, vuelve al plan).
export function planExamen(ev) {
  const hoy = todayISO();
  const dias = daysBetween(hoy, ev.fecha);
  const ventana = DB.meta.plan_dias || 21;
  if (ev.tipo !== "examen" || dias < 1 || dias > ventana) return null;
  const desde = sumarDias(ev.fecha, -ventana);
  const temas = temasDelEvento(ev);
  const preparado = (t) => t.fecha_ultimo_repaso && t.fecha_ultimo_repaso >= desde && (t.proximo_repaso > hoy || t.fecha_ultimo_repaso === hoy);
  // lo repasado hoy sigue contando como "de hoy" para que no se mueva el reparto
  const pendientes = temas
    .filter((t) => !(preparado(t) && t.fecha_ultimo_repaso < hoy))
    .sort((a, b) => (b.dificultad === "cuesta_arriba") - (a.dificultad === "cuesta_arriba") || (a.nivel || 0) - (b.nivel || 0) ||
      a.nombre.localeCompare(b.nombre, "es", { numeric: true }));
  const general = dias >= 3;
  const huecos = general ? dias - 1 : dias;
  const reparto = Array.from({ length: dias }, (_, i) => ({ fecha: sumarDias(hoy, i), temas: [], general: general && i === dias - 1 }));
  pendientes.forEach((t, i) => reparto[Math.floor((i * huecos) / pendientes.length)].temas.push(t));
  const listos = temas.filter(preparado).length;
  return { evento: ev, dias: reparto, total: temas.length, listos, diasHasta: dias };
}

export function planesActivos(filtroAsig = null) {
  return DB.eventos
    .filter((e) => e.tipo === "examen" && (!filtroAsig || e.asignatura_id === filtroAsig) && !asig(e.asignatura_id)?.archivada)
    .sort(ordenarPorFechaHora)
    .map(planExamen)
    .filter(Boolean);
}

/* ================= "Para hoy" ================= */

function intercalarPorDificultad(lista) {
  const duros = lista.filter((x) => x.tema.dificultad === "cuesta_arriba");
  const ligeros = lista.filter((x) => x.tema.dificultad !== "cuesta_arriba");
  const out = [];
  while (duros.length || ligeros.length) {
    if (duros.length) out.push(duros.shift());
    if (ligeros.length) out.push(ligeros.shift());
  }
  return out;
}

// Lo que toca hoy: primero lo del plan de cada examen, luego los temas cuyo
// repaso espaciado ya ha vencido, alternando temas duros y ligeros para no
// proponer siempre lo más pesado. Incluye lo ya hecho hoy (marcado).
export function paraHoy() {
  const hoy = todayISO();
  const vistos = new Set();
  const items = [];
  for (const p of planesActivos()) {
    for (const t of p.dias[0].temas) {
      if (vistos.has(t.id)) continue;
      vistos.add(t.id);
      items.push({ tema: t, motivo: "plan", evento: p.evento });
    }
  }
  const vencidos = temasActivos()
    .filter((t) => !vistos.has(t.id) && t.proximo_repaso <= hoy && !repasadoHoy(t))
    .map((t) => ({ tema: t, motivo: "repaso", info: infoTema(t) }))
    .sort((a, b) => b.info.urgencia - a.info.urgencia);
  vencidos.forEach((x) => vistos.add(x.tema.id));
  items.push(...intercalarPorDificultad(vencidos));
  // lo propuesto hoy que ya se ha hecho (sale de las listas de arriba al repasarlo)
  const propuestos = DB.meta.sugerencia?.fecha === hoy ? DB.meta.sugerencia.tema_ids : [];
  for (const id of propuestos) {
    const t = DB.temas.find((x) => x.id === id);
    if (t && !vistos.has(id) && repasadoHoy(t)) { vistos.add(id); items.push({ tema: t, motivo: "hecho" }); }
  }
  return items;
}

// Al empezar un día nuevo: lo propuesto ayer y no repasado suma un día al
// contador de "evitado" (dato neutro, sin regañina), y se fija la lista de hoy.
// Devuelve true si ha cambiado algo.
// Durante el día, lo que pase a estar pendiente se añade a la lista (así,
// al repasarlo, sigue saliendo tachado en vez de desaparecer).
export function cicloDiario() {
  const hoy = todayISO();
  const s = DB.meta.sugerencia;
  const pendientes = () => paraHoy().filter((x) => x.motivo !== "hecho").slice(0, 12).map((x) => x.tema.id);
  if (s && s.fecha === hoy) {
    const nuevos = pendientes().filter((id) => !(s.tema_ids || []).includes(id));
    if (!nuevos.length) return false;
    s.tema_ids = [...(s.tema_ids || []), ...nuevos].slice(-24);
    return true;
  }
  if (s) {
    for (const id of s.tema_ids || []) {
      const t = DB.temas.find((x) => x.id === id);
      if (t && (!t.fecha_ultimo_repaso || t.fecha_ultimo_repaso < s.fecha)) t.dias_evitado_consecutivos = (t.dias_evitado_consecutivos || 0) + 1;
    }
  }
  DB.meta.sugerencia = { fecha: hoy, tema_ids: pendientes() };
  return true;
}

/* ================= Notas ================= */

export function mediaAsignatura(asigId) {
  const notas = DB.eventos.filter((e) => e.asignatura_id === asigId && typeof e.nota === "number");
  return notas.length ? notas.reduce((s, e) => s + e.nota, 0) / notas.length : null;
}

// Exámenes/entregas pasados (últimos 45 días) sin nota ni "no lo sé".
export function eventosPendientesDeNota() {
  const hoy = todayISO(), limite = sumarDias(hoy, -45);
  return DB.eventos
    .filter((e) => e.fecha < hoy && e.fecha >= limite && e.nota == null && !e.nota_omitida && !asig(e.asignatura_id)?.archivada)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export const OBJETIVOS = [
  { nota: 5, nombre: "Aprobado" }, { nota: 7, nombre: "Notable" },
  { nota: 9, nombre: "Sobresaliente" }, { nota: 9.5, nombre: "MH" },
];

// Calculadora de nota con la evaluación de la asignatura: componentes con
// peso (%) y nota (la propia o la del examen/entrega vinculado).
export function calcularNota(a) {
  const comps = (a.evaluacion || []).map((c) => {
    const ev = c.evento_id ? DB.eventos.find((e) => e.id === c.evento_id) : null;
    const nota = typeof ev?.nota === "number" ? ev.nota : typeof c.nota === "number" ? c.nota : null;
    return { ...c, notaEfectiva: nota, evento: ev };
  });
  const pesoTotal = comps.reduce((s, c) => s + (Number(c.peso) || 0), 0);
  let puntos = 0, pesoEvaluado = 0;
  for (const c of comps) if (c.notaEfectiva !== null) { puntos += (c.notaEfectiva * (Number(c.peso) || 0)) / 100; pesoEvaluado += Number(c.peso) || 0; }
  const pesoRestante = Math.max(0, 100 - pesoEvaluado);
  const media = pesoEvaluado ? (puntos * 100) / pesoEvaluado : null;
  const necesitas = (objetivo) => (pesoRestante > 0 ? ((objetivo - puntos) * 100) / pesoRestante : null);
  return {
    comps, pesoTotal, puntos, pesoEvaluado, pesoRestante, media,
    final: pesoRestante === 0 ? puntos : null,
    objetivos: OBJETIVOS.map((o) => ({ ...o, necesitas: necesitas(o.nota), conseguido: puntos >= o.nota })),
  };
}

/* ================= Carga semanal (mapa de calor) ================= */

export function cargaSemana(lunesISO) {
  const fin = sumarDias(lunesISO, 6);
  const nEv = DB.eventos.filter((e) => e.fecha >= lunesISO && e.fecha <= fin).length;
  let deuda = 0;
  for (const t of temasActivos()) {
    if (!t.fecha_ultimo_repaso) { deuda += 3; continue; }
    const d = daysBetween(t.fecha_ultimo_repaso, lunesISO);
    if (d > 0) deuda += (Math.min(d, 70) / 7) * (t.dificultad === "cuesta_arriba" ? 1.5 : 1);
  }
  return { nEv, deuda, total: nEv * 3 + deuda };
}

export function nivelCarga(total, max) {
  if (total <= 0.5) return 0;
  if (!max) return 1;
  const r = total / max;
  return r < 0.25 ? 1 : r < 0.5 ? 2 : r < 0.8 ? 3 : 4;
}

/* ================= Concentración ================= */

export const fechaSesion = (s) => s.inicio.slice(0, 10);

export function minutosSemana() {
  const lunes = mondayOf(today()), domingo = sumarDias(lunes, 6);
  const sesiones = DB.sesiones.filter((s) => fechaSesion(s) >= lunes && fechaSesion(s) <= domingo);
  const porAsig = new Map(), porDia = Array(7).fill(0);
  let total = 0;
  for (const s of sesiones) {
    total += s.minutos;
    porAsig.set(s.asignatura_id, (porAsig.get(s.asignatura_id) || 0) + s.minutos);
    porDia[daysBetween(lunes, fechaSesion(s))] += s.minutos;
  }
  return { total, porAsig: [...porAsig.entries()].sort((a, b) => b[1] - a[1]), porDia, lunes };
}

export function minutosHoy() {
  const hoy = todayISO();
  return DB.sesiones.filter((s) => fechaSesion(s) === hoy).reduce((s, x) => s + x.minutos, 0);
}

export function minutosTotalesAsig(asigId) {
  return DB.sesiones.filter((s) => s.asignatura_id === asigId).reduce((s, x) => s + x.minutos, 0);
}
