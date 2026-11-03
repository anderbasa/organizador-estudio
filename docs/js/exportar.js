// Copia de seguridad (JSON) y exportación de exámenes/entregas a .ics.
import { DB, COLECCIONES, nombreAsig, asig, normalizarTodo } from "./datos.js";
import { todayISO, isoDate, parseDate, addDays } from "./fechas.js";
import { guardarArchivo, aviso, confirmar } from "./ui.js";
import { hacer } from "./fichas.js";

export async function descargarCopia() {
  const copia = { app: "matricula", version: 2, exportadoEn: new Date().toISOString(), datos: {} };
  for (const k of [...COLECCIONES, "meta"]) copia.datos[k] = DB[k];
  const blob = new Blob([JSON.stringify(copia, null, 2)], { type: "application/json" });
  const ok = await guardarArchivo(blob, `matricula-copia-${todayISO()}.json`);
  if (ok) aviso("Copia lista");
}

const ID_OK = /^[A-Za-z0-9_-]{1,64}$/;

// Restaura una copia (nueva o del organizador antiguo) SIN borrar nada:
// lo que tenga el mismo id se sobrescribe con la versión de la copia.
export async function restaurarCopia(archivo) {
  let datos;
  try {
    const j = JSON.parse(await archivo.text());
    datos = j.datos || j;
    if (!Array.isArray(datos.asignaturas) || !Array.isArray(datos.eventos) || !Array.isArray(datos.temas)) throw new Error();
  } catch {
    return aviso("Ese archivo no es una copia válida", { tipo: "aviso" });
  }
  const cuentas = {};
  const limpio = {};
  for (const k of COLECCIONES) {
    limpio[k] = (Array.isArray(datos[k]) ? datos[k] : []).filter((x) => x && typeof x === "object" && ID_OK.test(String(x.id)));
    cuentas[k] = limpio[k].length;
  }
  const ok = await confirmar("¿Restaurar esta copia?", {
    peligro: false, textoOk: "Restaurar",
    detalle: `${cuentas.asignaturas} asignaturas, ${cuentas.eventos} exámenes/entregas, ${cuentas.temas} temas, ${cuentas.sesiones} sesiones. No se borra nada: se añade lo que falte y se actualiza lo que coincida.`,
  });
  if (!ok) return;
  hacer("Copia restaurada", () => {
    for (const k of COLECCIONES) {
      for (const item of limpio[k]) {
        const i = DB[k].findIndex((x) => x.id === item.id);
        if (i >= 0) DB[k][i] = item; else DB[k].push(item);
      }
    }
    if (datos.meta && typeof datos.meta === "object") {
      for (const c of ["cuatrimestre_inicio", "cuatrimestre_fin", "foco_min", "descanso_min", "nota_aprobado", "plan_dias"]) {
        if (datos.meta[c] != null) DB.meta[c] = datos.meta[c];
      }
    }
    normalizarTodo();
  });
}

/* ---------- .ics ---------- */

const icsTexto = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const ymd = (iso) => iso.replace(/-/g, "");

export function generarICS() {
  const sello = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const l = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Matricula//ES", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Matrícula"];
  for (const e of DB.eventos) {
    if (asig(e.asignatura_id)?.archivada) continue;
    const nombre = icsTexto(nombreAsig(e.asignatura_id));
    const aviso = (disparo, texto) => ["BEGIN:VALARM", `TRIGGER:${disparo}`, "ACTION:DISPLAY", `DESCRIPTION:${texto}`, "END:VALARM"];
    let avisos;
    l.push("BEGIN:VEVENT", `UID:${e.id}@matricula`, `DTSTAMP:${sello}`);
    if (e.hora) {
      const [h, m] = e.hora.split(":").map(Number);
      const ini = parseDate(e.fecha); ini.setHours(h, m, 0, 0);
      const fin = new Date(ini.getTime() + 3600000);
      const f = (d) => `${ymd(isoDate(d))}T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;
      l.push(`DTSTART:${f(ini)}`, `DTEND:${f(fin)}`);
      // avisos de Calendario: un día antes y una hora antes
      avisos = [...aviso("-P1D", `${nombre} mañana`), ...aviso("-PT1H", nombre)];
    } else {
      l.push(`DTSTART;VALUE=DATE:${ymd(e.fecha)}`, `DTEND;VALUE=DATE:${ymd(isoDate(addDays(parseDate(e.fecha), 1)))}`);
      // día completo: aviso a las 20:00 de la víspera (4 h antes de la medianoche)
      avisos = aviso("-PT4H", `${nombre} mañana`);
    }
    l.push(`SUMMARY:${icsTexto(`${e.tipo === "examen" ? "Examen" : "Entrega"}: ${nombreAsig(e.asignatura_id)}`)}`);
    if (e.texto_original) l.push(`DESCRIPTION:${icsTexto(e.texto_original)}`);
    l.push(...avisos, "END:VEVENT");
  }
  l.push("END:VCALENDAR");
  return l.join("\r\n");
}

export async function exportarICS() {
  const n = DB.eventos.filter((e) => !asig(e.asignatura_id)?.archivada).length;
  if (!n) return aviso("Aún no hay exámenes ni entregas que exportar", { tipo: "aviso" });
  const ok = await guardarArchivo(new Blob([generarICS()], { type: "text/calendar;charset=utf-8" }), "matricula.ics");
  if (ok) aviso(`${n} ${n === 1 ? "evento exportado" : "eventos exportados"}`);
}
