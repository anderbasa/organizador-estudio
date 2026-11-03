// Utilidades de fecha. Las fechas viajan como "YYYY-MM-DD" (hora local).

export const DAY_MS = 86400000;
export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const DIAS_SEMANA = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };

export function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function parseDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function today() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
export const todayISO = () => isoDate(today());
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export const sumarDias = (iso, n) => isoDate(addDays(parseDate(iso), n));
export function mondayOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return isoDate(x);
}
export const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / DAY_MS);
export const daysSince = (iso) => daysBetween(iso, todayISO());
export function formatDMY(iso) { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; }
export function fechaCorta(iso) { const d = parseDate(iso); return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`; }
export function fechaLarga(iso) { const d = parseDate(iso); return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`; }
export function diaSemanaCorto(iso) { return DIAS[parseDate(iso).getDay()].slice(0, 3); }

// "hoy", "mañana", "en 5 días", "ayer", "hace 3 días"
export function cuando(iso) {
  const d = daysBetween(todayISO(), iso);
  if (d === 0) return "hoy";
  if (d === 1) return "mañana";
  if (d === -1) return "ayer";
  return d > 0 ? `en ${d} días` : `hace ${-d} días`;
}

export function normalize(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();
}

export function minutosTexto(min) {
  min = Math.round(min);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
