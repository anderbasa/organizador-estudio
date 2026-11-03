// Pestaña "Ajustes".
import { DB, guardar } from "../datos.js";
import { estado, alEstado } from "../nube.js";
import { el, icono, vibrar, aviso } from "../ui.js";
import { descargarCopia, restaurarCopia, exportarICS } from "../exportar.js";

let raiz, cuerpo;
const enApp = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

export function montar(cont) {
  raiz = cont;
  cont.append(el("header", { class: "barra" }, el("h1", { class: "titulo-grande", text: "Ajustes" })), (cuerpo = el("div", { class: "cuerpo" })));
  alEstado(() => { if (raiz.classList.contains("activa")) pintarNube(); });
}

function filaNum(etiqueta, clave, { min, max, sufijo, paso = 1 }) {
  const input = el("input", { type: "number", class: "control corto", min, max, step: paso, inputmode: "numeric", value: DB.meta[clave] });
  input.addEventListener("change", () => {
    const v = parseFloat(String(input.value).replace(",", "."));
    if (Number.isNaN(v) || v < min || v > max) { input.value = DB.meta[clave]; return aviso(`Entre ${min} y ${max}`, { tipo: "aviso" }); }
    DB.meta[clave] = v; guardar();
  });
  return el("div", { class: "campo" }, el("span", { class: "campo-etiqueta", text: etiqueta }), el("label", { class: "con-sufijo" }, input, el("span", { text: sufijo })));
}
function filaFecha(etiqueta, clave) {
  const input = el("input", { type: "date", class: "control", value: DB.meta[clave] });
  input.addEventListener("change", () => {
    const ini = clave === "cuatrimestre_inicio" ? input.value : DB.meta.cuatrimestre_inicio;
    const fin = clave === "cuatrimestre_fin" ? input.value : DB.meta.cuatrimestre_fin;
    if (!input.value || ini >= fin) { input.value = DB.meta[clave]; return aviso("El inicio tiene que ir antes que el final", { tipo: "aviso" }); }
    DB.meta[clave] = input.value; guardar();
  });
  return el("div", { class: "campo" }, el("span", { class: "campo-etiqueta", text: etiqueta }), input);
}
const accion = (ico, texto, sub, fn) => el("button", { type: "button", class: "fila-accion", onclick: () => { vibrar(8); fn(); } },
  el("span", { class: "fila-accion-ico", html: icono(ico) }),
  el("span", { class: "fila-texto" }, el("strong", { text: texto }), sub ? el("small", { text: sub }) : null),
  el("span", { class: "chevron", html: icono("chevron") }));

let nodoNube;
function pintarNube() {
  if (!nodoNube) return;
  const e = estado();
  let clase = "ok", texto = "Todo guardado en la nube", sub = "Lo que captures en Safari (pegatina NFC) y en la app es lo mismo.";
  if (e.error) { clase = "error"; texto = "Error al sincronizar"; sub = e.error; }
  else if (!e.enLinea) { clase = "offline"; texto = "Sin conexión"; sub = e.pendientes ? "Hay cambios guardados en el móvil; se subirán solos al volver la conexión." : "Puedes seguir usando la app: se sincroniza al volver la conexión."; }
  else if (e.pendientes || !e.servidor) { clase = "pendiente"; texto = "Sincronizando…"; }
  nodoNube.className = `fila-nube ${clase}`;
  nodoNube.replaceChildren(el("span", { class: "fila-accion-ico", html: icono("nube") }), el("span", { class: "fila-texto" }, el("strong", { text: texto }), el("small", { text: sub })));
}

export function pintar() {
  const archivo = el("input", { type: "file", accept: "application/json,.json", hidden: true });
  archivo.addEventListener("change", () => { const f = archivo.files[0]; archivo.value = ""; if (f) restaurarCopia(f); });
  nodoNube = el("div", { class: "fila-nube" });
  cuerpo.replaceChildren(
    el("p", { class: "grupo-titulo", text: "Sincronización" }),
    el("div", { class: "grupo" }, nodoNube),
    el("p", { class: "grupo-titulo", text: "Cuatrimestre" }),
    el("div", { class: "grupo" }, filaFecha("Empieza", "cuatrimestre_inicio"), filaFecha("Termina", "cuatrimestre_fin")),
    el("p", { class: "grupo-titulo", text: "Estudio" }),
    el("div", { class: "grupo" },
      filaNum("Sesión de foco", "foco_min", { min: 5, max: 120, sufijo: "min" }),
      filaNum("Descanso", "descanso_min", { min: 1, max: 30, sufijo: "min" }),
      filaNum("Plan antes del examen", "plan_dias", { min: 3, max: 60, sufijo: "días" }),
      filaNum("Nota para aprobar", "nota_aprobado", { min: 1, max: 10, sufijo: "/10", paso: 0.5 })),
    el("p", { class: "grupo-titulo", text: "Calendario del iPhone" }),
    el("div", { class: "grupo" }, accion("calendario", "Añadir exámenes al Calendario", "Archivo .ics con avisos el día antes y una hora antes", exportarICS)),
    el("p", { class: "suave pie", text: "La app no puede mandar notificaciones por sí sola: así es Calendario quien te avisa. Si vuelves a exportar, Calendario puede duplicar los que ya tenías." }),
    el("p", { class: "grupo-titulo", text: "Copia de seguridad" }),
    el("div", { class: "grupo" },
      accion("descargar", "Descargar copia", "Todo en un archivo JSON", descargarCopia),
      accion("compartir", "Restaurar copia", "También acepta las del organizador antiguo", () => archivo.click())),
    archivo,
    enApp() ? null : el("div", { class: "tarjeta instalar" },
      el("strong", { text: "Tenla como app en el iPhone" }),
      el("ol", {},
        el("li", { html: `Toca ${icono("compartir")} <b>Compartir</b> en Safari.` }),
        el("li", { html: "Elige <b>Añadir a pantalla de inicio</b>." }),
        el("li", { html: "Ábrela desde el icono: pantalla completa y funciona sin conexión." }))),
    el("div", { class: "creditos" },
      el("img", { src: "icons/sello.png", alt: "", width: 56, height: 56 }),
      el("span", { class: "marca", text: "Matrícula" }),
      el("small", { text: "Hecho para sacar matrícula de honor." })));
  pintarNube();
}
