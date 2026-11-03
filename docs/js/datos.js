// Estado en memoria de toda la app. Las vistas lo leen tal cual y, tras
// cambiarlo, llaman a guardar(): eso sube las diferencias a la nube (nube.js)
// y repinta. La nube a su vez reemplaza colecciones enteras cuando llegan
// cambios de otro dispositivo (por ejemplo, una captura por NFC en Safari).
import { todayISO, sumarDias, mondayOf, today } from "./fechas.js";

export const COLECCIONES = ["asignaturas", "eventos", "temas", "sin_clasificar", "sesiones"];

// Colores del sistema de iOS, uno por asignatura (como Calendario).
export const COLORES = ["#007aff", "#ff3b30", "#34c759", "#ff9500", "#af52de", "#30b0c7",
  "#ff2d55", "#5856d6", "#ffcc00", "#00c7be", "#a2845e", "#32ade6"];

export function metaPorDefecto() {
  const ini = mondayOf(today());
  return {
    cuatrimestre_inicio: ini,
    cuatrimestre_fin: sumarDias(ini, 7 * 18),
    sugerencia: null,     // { fecha, tema_ids } — lo propuesto en "Para hoy"
    foco_min: 25,
    descanso_min: 5,
    nota_aprobado: 5,
    plan_dias: 21,        // el plan de examen empieza estos días antes
  };
}

export const DB = {
  asignaturas: [], // { id, nombre, alias[], archivada, color, evaluacion: [{ id, nombre, peso, nota, evento_id }] }
  eventos: [],     // { id, asignatura_id, tipo, fecha, hora, nota, nota_omitida, temas_relacionados[], texto_original }
  temas: [],       // { id, asignatura_id, nombre, fecha_ultimo_repaso, proximo_repaso, nivel, dificultad, dias_evitado_consecutivos }
  sin_clasificar: [], // { id, texto_original, asignatura_id, tipo, fecha, hora }
  sesiones: [],    // { id, asignatura_id, tema_id, inicio (ISO con hora), minutos }
  meta: metaPorDefecto(),
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// JSON con las claves ordenadas: Firestore devuelve los campos en orden
// alfabético, así que comparar con JSON.stringify a secas vería "cambios"
// que no lo son (y provocaría escrituras en bucle).
export function estable(v) {
  if (Array.isArray(v)) return `[${v.map(estable).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${estable(v[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
}

/* ---------- Persistencia y avisos de cambio ---------- */

let persistir = () => {};
export function alPersistir(fn) { persistir = fn; }

const oyentes = new Set();
export function alCambiar(fn) { oyentes.add(fn); return () => oyentes.delete(fn); }

// Agrupa varios cambios seguidos en un solo repintado. setTimeout y no
// requestAnimationFrame: rAF se para con la app en segundo plano.
let pendiente = false;
export function notificar() {
  if (pendiente) return;
  pendiente = true;
  setTimeout(() => { pendiente = false; oyentes.forEach((fn) => fn()); }, 0);
}

export function guardar() {
  persistir();
  notificar();
}

export function instantanea() { return JSON.parse(JSON.stringify(DB)); }
export function restaurar(copia) {
  for (const k of COLECCIONES) DB[k] = copia[k];
  DB.meta = copia.meta;
  guardar();
}

/* ---------- Normalización (datos viejos o a medias) ---------- */

export function normalizarAsignatura(a, usados = new Set()) {
  if (!Array.isArray(a.alias)) a.alias = [];
  if (typeof a.archivada !== "boolean") a.archivada = !!a.archivada;
  if (!Array.isArray(a.evaluacion)) a.evaluacion = [];
  if (!a.color) {
    a.color = COLORES.find((c) => !usados.has(c)) || COLORES[usados.size % COLORES.length];
  }
  usados.add(a.color);
  return a;
}
export function normalizarTema(t) {
  if (typeof t.nivel !== "number") t.nivel = 0;
  if (!t.dificultad) t.dificultad = "repaso_rapido";
  if (typeof t.dias_evitado_consecutivos !== "number") t.dias_evitado_consecutivos = 0;
  if (t.fecha_ultimo_repaso === undefined) t.fecha_ultimo_repaso = null;
  if (!t.proximo_repaso) t.proximo_repaso = t.fecha_ultimo_repaso ? sumarDias(t.fecha_ultimo_repaso, 1) : todayISO();
  return t;
}
export function normalizarEvento(e) {
  if (!Array.isArray(e.temas_relacionados)) e.temas_relacionados = [];
  if (e.hora === undefined) e.hora = null;
  if (e.nota === undefined) e.nota = null;
  return e;
}

// Devuelve true si ha tenido que tocar algo (para guardarlo).
export function normalizarTodo() {
  const antes = estable(DB);
  const usados = new Set(DB.asignaturas.map((a) => a.color).filter(Boolean));
  DB.asignaturas.forEach((a) => normalizarAsignatura(a, usados));
  DB.temas.forEach(normalizarTema);
  DB.eventos.forEach(normalizarEvento);
  if (!DB.meta || typeof DB.meta !== "object") DB.meta = {};
  // solo rellenar lo que falte, sin reconstruir el objeto
  for (const [k, v] of Object.entries(metaPorDefecto())) if (DB.meta[k] === undefined) DB.meta[k] = v;
  return estable(DB) !== antes;
}

/* ---------- Consultas comunes ---------- */

export const asig = (id) => DB.asignaturas.find((a) => a.id === id) || null;
export const nombreAsig = (id) => asig(id)?.nombre || "Sin asignatura";
export const colorAsig = (id) => asig(id)?.color || "#8e8e93";
export const activasAsignaturas = () => DB.asignaturas.filter((a) => !a.archivada).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

// Para desplegables: las activas y, si lo que se edita apunta a una
// archivada, también esa (para no romper su edición).
export function opcionesAsignaturas(incluirId) {
  const activas = activasAsignaturas();
  if (incluirId && !activas.some((a) => a.id === incluirId)) {
    const extra = asig(incluirId);
    if (extra) return [...activas, extra];
  }
  return activas;
}

export function temasActivos() {
  const ids = new Set(activasAsignaturas().map((a) => a.id));
  return DB.temas.filter((t) => ids.has(t.asignatura_id));
}
export const temasDe = (asigId) => DB.temas.filter((t) => t.asignatura_id === asigId).sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { numeric: true }));
export const eventosDe = (asigId) => DB.eventos.filter((e) => e.asignatura_id === asigId);

export function ordenarPorFechaHora(a, b) {
  return a.fecha === b.fecha ? (a.hora || "99:99").localeCompare(b.hora || "99:99") : a.fecha.localeCompare(b.fecha);
}
export function proximosEventos(filtroAsig = null) {
  const hoy = todayISO();
  return DB.eventos.filter((e) => e.fecha >= hoy && (!filtroAsig || e.asignatura_id === filtroAsig)).sort(ordenarPorFechaHora);
}

export function nuevoTema(asignatura_id, nombre) {
  return normalizarTema({
    id: uid(), asignatura_id, nombre, fecha_ultimo_repaso: null, proximo_repaso: todayISO(),
    nivel: 0, dificultad: "repaso_rapido", dias_evitado_consecutivos: 0,
  });
}
