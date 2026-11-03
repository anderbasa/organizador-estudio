// Clasificador local de la bandeja de captura: solo reglas de texto, sin IA.
import { MESES, DIAS_SEMANA, isoDate, parseDate, today, todayISO, addDays, mondayOf, normalize } from "./fechas.js";

const PAL_EXAMEN = ["examen", "parcial", "final", "test", "control", "prueba"];
const PAL_ENTREGA = ["entrega", "entregar", "trabajo", "informe", "presentar", "presentacion",
  "practica", "memoria", "ensayo", "proyecto"];
export const PAL_REPASO = ["repasar", "repaso", "repase", "estudiar", "estudie", "estudio",
  "revisar", "revise", "repasando", "estudiando"];

export function detectarFecha(texto) {
  const t = " " + normalize(texto).replace(/\s+/g, " ") + " ";
  const hoy = today();

  // dd/mm(/aaaa) o dd-mm(-aaaa)
  let m = t.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (m) {
    const d = +m[1], mo = +m[2];
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
      const year = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : hoy.getFullYear();
      let cand = new Date(year, mo - 1, d);
      if (!m[3] && cand < hoy) cand = new Date(year + 1, mo - 1, d);
      return isoDate(cand);
    }
  }

  // "14 de marzo" (opcionalmente "de 2026")
  m = t.match(new RegExp("\\b(\\d{1,2}) de (" + MESES.join("|") + "|setiembre)(?: de (\\d{4}))?\\b"));
  if (m) {
    const d = +m[1], mo = m[2] === "setiembre" ? 8 : MESES.indexOf(m[2]);
    const year = m[3] ? +m[3] : hoy.getFullYear();
    let cand = new Date(year, mo, d);
    if (!m[3] && cand < hoy) cand = new Date(year + 1, mo, d);
    return isoDate(cand);
  }

  // relativas ("de/por la mañana" es franja horaria, no "mañana")
  const tSinFranja = t.replace(/\b(de|por) la manana\b/g, " ");
  if (/\bpasado manana\b/.test(tSinFranja)) return isoDate(addDays(hoy, 2));
  if (/\bmanana\b/.test(tSinFranja)) return isoDate(addDays(hoy, 1));
  if (/\bhoy\b/.test(t)) return todayISO();

  m = t.match(/\ben (\d{1,2}) dias?\b/);
  if (m) return isoDate(addDays(hoy, +m[1]));

  if (/\b(la semana que viene|semana que viene|la proxima semana|proxima semana)\b/.test(t)) return mondayOf(addDays(hoy, 7));
  if (/\besta semana\b/.test(t)) {
    const viernes = addDays(parseDate(mondayOf(hoy)), 4);
    return isoDate(viernes < hoy ? hoy : viernes);
  }

  m = t.match(/\b(este |el |proximo |el proximo |la proxima )?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/);
  if (m) {
    let d = addDays(hoy, 1);
    while (d.getDay() !== DIAS_SEMANA[m[2]]) d = addDays(d, 1);
    if (m[1] && /proxim/.test(m[1])) d = addDays(d, 7);
    return isoDate(d);
  }

  m = t.match(/\bel (\d{1,2})\b/);
  if (m) {
    const d = +m[1];
    if (d >= 1 && d <= 31) {
      let cand = new Date(hoy.getFullYear(), hoy.getMonth(), d);
      if (cand < hoy) cand = new Date(hoy.getFullYear(), hoy.getMonth() + 1, d);
      return isoDate(cand);
    }
  }
  return null;
}

export function detectarHora(texto) {
  const t = " " + normalize(texto).replace(/\s+/g, " ") + " ";
  let h = null, m = 0;
  let match = t.match(/\b(?:a las|sobre las) (\d{1,2})(?:[:.](\d{2}))?\b/);
  if (match) { h = +match[1]; m = match[2] ? +match[2] : 0; }
  if (h === null && (match = t.match(/\b(\d{1,2}):(\d{2})\b/))) { h = +match[1]; m = +match[2]; }
  if (h === null && (match = t.match(/\b(\d{1,2})h(\d{2})?\b/))) { h = +match[1]; m = match[2] ? +match[2] : 0; }
  if (h === null || h > 23 || m > 59) return null;
  if (/\b(de|por) la (tarde|noche)\b/.test(t) && h >= 1 && h <= 11) h += 12;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function detectarTipo(texto) {
  const t = normalize(texto);
  if (PAL_EXAMEN.some((p) => new RegExp("\\b" + p).test(t))) return "examen";
  if (PAL_ENTREGA.some((p) => new RegExp("\\b" + p).test(t))) return "entrega";
  return null;
}

export function esRepaso(texto) {
  const t = normalize(texto);
  return PAL_REPASO.some((p) => new RegExp("\\b" + p).test(t));
}

export function clavesAsignatura(a) {
  return [a.nombre, ...(a.alias || [])].map(normalize).filter((x) => x.length >= 3).sort((x, y) => y.length - x.length);
}

export function distanciaLevenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

// Primero coincidencia exacta (nombre o alias contenido en el texto); si no
// hay, como último recurso tolera 1-3 erratas según la longitud de la palabra.
export function detectarAsignatura(texto, asignaturas) {
  const t = normalize(texto);
  let mejor = null, mejorLen = 0;
  for (const a of asignaturas) for (const k of clavesAsignatura(a)) {
    if (t.includes(k) && k.length > mejorLen) { mejor = a; mejorLen = k.length; }
  }
  if (mejor) return mejor;
  const palabras = t.split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
  let mejorDist = Infinity;
  for (const a of asignaturas) for (const k of clavesAsignatura(a).filter((k) => k.length >= 4)) {
    const tol = k.length <= 5 ? 1 : k.length <= 9 ? 2 : 3;
    for (const w of palabras) {
      if (Math.abs(w.length - k.length) > tol) continue;
      const d = distanciaLevenshtein(w, k);
      if (d <= tol && d < mejorDist) { mejor = a; mejorDist = d; }
    }
  }
  return mejor;
}

export function extraerNombreTema(texto, asignatura) {
  let t = normalize(texto);
  for (const p of PAL_REPASO) t = t.replace(new RegExp("\\b" + p + "\\b", "g"), " ");
  if (asignatura) for (const k of clavesAsignatura(asignatura)) t = t.replace(new RegExp(k, "g"), " ");
  return t
    .replace(/\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?/g, " ")
    .replace(/\b(de|del|la|el|los|las|un|una|para|y|en|a|mi|sobre)\b/g, " ")
    .replace(/\b(manana|hoy|pasado|proximo|proxima|semana|que|viene|este|esta|dias?)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function clasificar(texto, asignaturas) {
  const fecha = detectarFecha(texto);
  const hora = detectarHora(texto);
  const tipo = detectarTipo(texto);
  const asignatura = detectarAsignatura(texto, asignaturas);
  const repaso = esRepaso(texto);

  if (repaso && !tipo && asignatura) {
    return { accion: "tema", asignatura, nombre: extraerNombreTema(texto, asignatura) || "general" };
  }
  if (fecha && tipo && asignatura) return { accion: "evento", asignatura, tipo, fecha, hora };
  return { accion: "sin_clasificar", asignatura, tipo: repaso ? "repaso" : tipo || "examen", fecha: fecha || todayISO(), hora };
}
