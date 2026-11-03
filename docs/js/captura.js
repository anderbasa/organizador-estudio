// Bandeja de captura: texto libre → examen/entrega, repaso de un tema o "sin clasificar".
import { DB, guardar, instantanea, restaurar, uid, activasAsignaturas, normalizarEvento, nuevoTema } from "./datos.js";
import { clasificar, extraerNombreTema } from "./clasificador.js";
import { registrarRepaso } from "./estudio.js";
import { normalize, fechaCorta } from "./fechas.js";
import { aviso, confirmar } from "./ui.js";

const deshacer = (copia) => ({ texto: "Deshacer", alPulsar: () => { restaurar(copia); aviso("Deshecho"); } });

export async function capturar(textoRaw) {
  const texto = (textoRaw || "").trim();
  if (!texto) return false;
  const r = clasificar(texto, activasAsignaturas());

  if (r.accion === "evento") {
    const dup = DB.eventos.find((e) => e.asignatura_id === r.asignatura.id && e.tipo === r.tipo && e.fecha === r.fecha);
    if (dup) {
      const seguir = await confirmar(
        `Ya tienes ${r.tipo === "examen" ? "un examen" : "una entrega"} de ${r.asignatura.nombre} el ${fechaCorta(r.fecha)}${dup.hora ? ` a las ${dup.hora}` : ""}`,
        { textoOk: "Añadir otro igualmente", peligro: false, detalle: "Si has escaneado la pegatina dos veces, cancela y no se duplica." });
      if (!seguir) { aviso("No se ha duplicado"); return true; }
    }
    const copia = instantanea();
    DB.eventos.push(normalizarEvento({
      id: uid(), asignatura_id: r.asignatura.id, tipo: r.tipo, fecha: r.fecha, hora: r.hora || null,
      nota: null, temas_relacionados: [], texto_original: texto,
    }));
    guardar();
    aviso(`${r.tipo === "examen" ? "Examen" : "Entrega"} · ${r.asignatura.nombre} · ${fechaCorta(r.fecha)}${r.hora ? ` · ${r.hora}` : ""}`, { accion: deshacer(copia) });
    return true;
  }

  if (r.accion === "tema") {
    const copia = instantanea();
    let tema = DB.temas.find((t) => t.asignatura_id === r.asignatura.id && normalize(t.nombre) === normalize(r.nombre));
    const nuevo = !tema;
    if (nuevo) { tema = nuevoTema(r.asignatura.id, r.nombre); DB.temas.push(tema); }
    registrarRepaso(tema, "bien");
    guardar();
    aviso(nuevo ? `Tema nuevo “${tema.nombre}” (${r.asignatura.nombre}), repasado hoy` : `Repaso de “${tema.nombre}” apuntado`, { accion: deshacer(copia) });
    return true;
  }

  const copia = instantanea();
  DB.sin_clasificar.push({ id: uid(), texto_original: texto, asignatura_id: r.asignatura?.id || null, tipo: r.tipo, fecha: r.fecha, hora: r.hora || null });
  guardar();
  aviso("No lo tengo claro: está en “Sin clasificar”, arriba en Hoy", { tipo: "aviso", accion: deshacer(copia) });
  return true;
}

// Pasar una entrada de "Sin clasificar" a su sitio.
export function resolverSinClasificar(id, { asignatura_id, tipo, fecha, hora }) {
  const s = DB.sin_clasificar.find((x) => x.id === id);
  if (!s) return;
  if (!asignatura_id) return aviso("Elige una asignatura", { tipo: "aviso" });
  const copia = instantanea();
  if (tipo === "repaso") {
    const a = DB.asignaturas.find((x) => x.id === asignatura_id);
    const nombre = extraerNombreTema(s.texto_original, a) || s.texto_original;
    let tema = DB.temas.find((t) => t.asignatura_id === asignatura_id && normalize(t.nombre) === normalize(nombre));
    if (!tema) { tema = nuevoTema(asignatura_id, nombre); DB.temas.push(tema); }
    registrarRepaso(tema, "bien");
  } else {
    if (!fecha) return aviso("Elige una fecha", { tipo: "aviso" });
    DB.eventos.push(normalizarEvento({ id: uid(), asignatura_id, tipo, fecha, hora: hora || null, nota: null, temas_relacionados: [], texto_original: s.texto_original }));
  }
  DB.sin_clasificar = DB.sin_clasificar.filter((x) => x.id !== id);
  guardar();
  aviso("Clasificado", { accion: deshacer(copia) });
}
