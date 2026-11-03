// Pestaña "Hoy": captura, próximo examen, lo que toca hoy y la semana.
import { DB, guardar, instantanea, restaurar, nombreAsig, colorAsig, proximosEventos, opcionesAsignaturas, asig } from "../datos.js";
import { paraHoy, planesActivos, eventosPendientesDeNota, minutosSemana, minutosHoy, infoTema } from "../estudio.js";
import { todayISO, fechaLarga, fechaCorta, daysBetween, mondayOf, today, sumarDias, parseDate, minutosTexto, diaSemanaCorto } from "../fechas.js";
import { el, esc, icono, aviso, vibrar, deslizable, contar } from "../ui.js";
import { capturar, resolverSinClasificar } from "../captura.js";
import { fichaTema, fichaEvento, repasoConDeshacer } from "../fichas.js";
import { irA } from "../navegacion.js";

let raiz, cuerpo, input, ultimaCuenta = null;

function saludo() {
  const h = new Date().getHours();
  return h < 6 ? "Buenas noches" : h < 14 ? "Buenos días" : h < 21 ? "Buenas tardes" : "Buenas noches";
}

export function montar(cont) {
  raiz = cont;
  input = el("input", {
    id: "captura-input", type: "text", enterkeyhint: "send", autocapitalize: "sentences", autocorrect: "off", spellcheck: "false",
    autocomplete: "off", "aria-label": "Captura", placeholder: "Examen de conta el 14 a las 10…",
    "data-persistente": true, // está fuera de lo que se repinta: no hace falta esperar a que se suelte
  });
  const form = el("form", { class: "captura", autocomplete: "off" },
    el("span", { class: "captura-ico", html: icono("bandeja") }),
    input,
    el("button", { type: "submit", class: "captura-enviar", "aria-label": "Capturar", html: icono("enviar") }));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    vibrar();
    const texto = input.value;
    if (!texto.trim()) return input.focus();
    input.value = "";
    await capturar(texto);
  });
  cont.append(
    el("header", { class: "hero" },
      el("div", { class: "hero-top" },
        el("img", { class: "hero-sello", src: "icons/sello.png", alt: "", width: 40, height: 40 }),
        el("span", { class: "marca", text: "Matrícula" }),
        el("span", { class: "estado-nube", id: "estado-nube", role: "status" })),
      el("p", { class: "hero-fecha", id: "hoy-fecha" }),
      el("h1", { class: "hero-saludo", id: "hoy-saludo" }),
      form,
      el("p", { class: "captura-ayuda", text: "Examen, entrega o “repasar tema 3 de estadística”." })),
    (cuerpo = el("div", { class: "cuerpo cuerpo-hoy" })));
}

export const enfocarCaptura = () => setTimeout(() => input?.focus(), 60);

export function pintar() {
  raiz.querySelector("#hoy-fecha").textContent = fechaLarga(todayISO());
  raiz.querySelector("#hoy-saludo").textContent = saludo();
  cuerpo.replaceChildren(
    ...[seccionSinClasificar(), seccionNotas(), tarjetaProximo(), seccionParaHoy(), seccionSemana()].filter(Boolean));
}

/* ---------- Próximo examen / entrega ---------- */

function tarjetaProximo() {
  const ev = proximosEventos()[0];
  if (!ev) {
    return el("div", { class: "tarjeta proximo vacio" },
      el("div", { class: "proximo-vacio", html: `${icono("birrete")}<div><strong>Sin exámenes a la vista</strong><span>Cuando captures uno, aparecerá aquí con su cuenta atrás.</span></div>` }));
  }
  const dias = daysBetween(todayISO(), ev.fecha);
  const plan = planesActivos().find((p) => p.evento.id === ev.id);
  const numero = el("span", { class: "proximo-num" });
  const tarjeta = el("button", { type: "button", class: "tarjeta proximo", style: { "--c": colorAsig(ev.asignatura_id) },
    onclick: () => { vibrar(8); irA("asignaturas", { asignatura: ev.asignatura_id }); } },
    el("div", { class: "proximo-cuenta" },
      dias === 0 ? el("span", { class: "proximo-num pal", text: "HOY" }) : dias === 1 ? el("span", { class: "proximo-num pal", text: "MAÑANA" }) : numero,
      dias > 1 ? el("span", { class: "proximo-unidad", text: "días" }) : null),
    el("div", { class: "proximo-info" },
      el("span", { class: "proximo-tipo", text: ev.tipo === "examen" ? "Próximo examen" : "Próxima entrega" }),
      el("strong", { class: "proximo-asig", text: nombreAsig(ev.asignatura_id) }),
      el("span", { class: "proximo-fecha", text: `${fechaLarga(ev.fecha)}${ev.hora ? ` · ${ev.hora}` : ""}` }),
      plan ? el("div", { class: "progreso", "aria-label": `${plan.listos} de ${plan.total} temas listos` },
        el("div", { class: "progreso-barra" }, el("i", { style: { width: `${plan.total ? (100 * plan.listos) / plan.total : 0}%` } })),
        el("span", { text: plan.total ? `${plan.listos}/${plan.total} temas listos` : "Añade sus temas para el plan" })) : null),
    el("span", { class: "chevron", html: icono("chevron") }));
  if (dias > 1) {
    // solo se anima la primera vez (o si cambia), no en cada repintado
    if (ultimaCuenta !== `${ev.id}:${dias}`) contar(numero, dias, { duracion: 700 }); else numero.textContent = dias;
    ultimaCuenta = `${ev.id}:${dias}`;
  }
  return tarjeta;
}

/* ---------- Para hoy ---------- */

function seccionParaHoy() {
  const items = paraHoy();
  const hechos = items.filter((x) => x.motivo === "hecho" || x.tema.fecha_ultimo_repaso === todayISO()).length;
  const sec = el("section", { class: "seccion" },
    el("div", { class: "seccion-cab" },
      el("h2", { text: "Para hoy" }),
      items.length ? anillo(hechos, items.length) : null));
  if (!items.length) {
    sec.append(el("div", { class: "tarjeta vacio-hoy" },
      el("img", { src: "icons/sello.png", alt: "", width: 64, height: 64 }),
      el("strong", { text: DB.temas.length ? "Nada pendiente hoy" : "Aún no hay temas" }),
      el("span", { text: DB.temas.length ? "Todo al día. Si te apetece, adelanta algo en Foco." : "Añade los temas de cada asignatura (en Asignaturas) y aquí te diré qué repasar cada día." })));
    return sec;
  }
  const lista = el("div", { class: "lista tarjeta" });
  for (const it of items) lista.append(filaTema(it));
  sec.append(lista);
  if (hechos < items.length && !localStorage.getItem("matricula.pista-deslizar")) {
    sec.append(el("p", { class: "pista", html: `Desliza un tema hacia la derecha ${icono("chevron")} para marcarlo como repasado` }));
  }
  return sec;
}

function anillo(hechos, total) {
  const r = 9, c = 2 * Math.PI * r, p = total ? hechos / total : 0;
  return el("span", { class: `anillo-mini ${p === 1 ? "completo" : ""}`, html:
    `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="${r}" class="pista-a"/><circle cx="12" cy="12" r="${r}" class="valor-a" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}"/></svg><span>${hechos}/${total}</span>` });
}

function filaTema({ tema, motivo, evento }) {
  const hecho = tema.fecha_ultimo_repaso === todayISO();
  let sub;
  if (hecho) sub = "Repasado hoy";
  else if (motivo === "plan") sub = `Plan · ${evento.tipo === "examen" ? "examen" : "entrega"} ${daysBetween(todayISO(), evento.fecha) === 1 ? "mañana" : `en ${daysBetween(todayISO(), evento.fecha)} d`}`;
  else sub = infoTema(tema).texto;
  const fila = el("div", { class: `fila-desl ${hecho ? "hecho" : ""}`, "data-id": tema.id },
    el("div", { class: "desl-fondo", html: `${icono("check")}<span>Repasado</span>` }),
    el("div", { class: "desl-contenido", role: "button", tabindex: 0, onclick: () => { vibrar(8); fichaTema(tema.id); } },
      el("span", { class: "barra-color", style: { background: colorAsig(tema.asignatura_id) } }),
      el("span", { class: "check-hoy", html: hecho ? icono("check") : "" }),
      el("div", { class: "fila-texto" },
        el("strong", { text: tema.nombre }),
        el("small", {}, el("span", { class: "asig-mini", text: nombreAsig(tema.asignatura_id) }), ` · ${sub}`)),
      tema.dificultad === "cuesta_arriba" && !hecho ? el("span", { class: "etiqueta-dura", text: "duro" }) : null,
      hecho ? null : el("button", { type: "button", class: "boton-icono", "aria-label": "Concentrarme con este tema", html: icono("foco"),
        onclick: (e) => { e.stopPropagation(); vibrar(8); irA("foco", { asignatura_id: tema.asignatura_id, tema_id: tema.id }); } })));
  if (!hecho) deslizable(fila, () => { localStorage.setItem("matricula.pista-deslizar", "1"); repasoConDeshacer(tema.id, "bien"); });
  return fila;
}

/* ---------- ¿Qué tal te fue? ---------- */

function seccionNotas() {
  const pendientes = eventosPendientesDeNota();
  if (!pendientes.length) return null;
  const lista = el("div", { class: "lista" });
  for (const e of pendientes) {
    const inNota = el("input", { type: "number", class: "control nota-input", min: 0, max: 10, step: 0.1, inputmode: "decimal", placeholder: "nota", "aria-label": "Nota" });
    lista.append(el("div", { class: "fila-nota" },
      el("span", { class: "barra-color", style: { background: colorAsig(e.asignatura_id) } }),
      el("div", { class: "fila-texto" },
        el("strong", { text: nombreAsig(e.asignatura_id) }),
        el("small", { text: `${e.tipo === "examen" ? "Examen" : "Entrega"} del ${fechaCorta(e.fecha)}` })),
      inNota,
      el("button", { type: "button", class: "boton pequeno primario", text: "OK", onclick: () => {
        vibrar();
        const n = parseFloat(String(inNota.value).replace(",", "."));
        if (Number.isNaN(n) || n < 0 || n > 10) return aviso("Escribe una nota entre 0 y 10", { tipo: "aviso" });
        const copia = instantanea();
        const x = DB.eventos.find((y) => y.id === e.id); if (!x) return;
        x.nota = n; guardar();
        aviso(n >= 9.5 ? `¡${n.toString().replace(".", ",")}! Eso huele a MH` : `Nota guardada: ${n.toString().replace(".", ",")}`, { accion: { texto: "Deshacer", alPulsar: () => restaurar(copia) } });
      } }),
      el("button", { type: "button", class: "boton pequeno secundario", text: "No sé", onclick: () => {
        vibrar(8);
        const x = DB.eventos.find((y) => y.id === e.id); if (!x) return;
        x.nota_omitida = true; guardar();
      } })));
  }
  return el("section", { class: "seccion" },
    el("div", { class: "seccion-cab" }, el("h2", { text: "¿Qué tal te fue?" })),
    el("div", { class: "tarjeta notas-card" }, lista,
      el("p", { class: "suave pie", text: "Con la nota apuntada verás tu media y cuánto te falta para aprobar." })));
}

/* ---------- Sin clasificar ---------- */

function seccionSinClasificar() {
  if (!DB.sin_clasificar.length) return null;
  const lista = el("div", { class: "lista" });
  for (const s of DB.sin_clasificar) {
    const selAsig = el("select", { class: "control" }, el("option", { value: "", text: "Asignatura…" }),
      ...opcionesAsignaturas(s.asignatura_id).map((a) => el("option", { value: a.id, text: a.nombre })));
    if (s.asignatura_id) selAsig.value = s.asignatura_id;
    const selTipo = el("select", { class: "control" },
      el("option", { value: "examen", text: "Examen" }), el("option", { value: "entrega", text: "Entrega" }), el("option", { value: "repaso", text: "Repaso" }));
    selTipo.value = s.tipo || "examen";
    const inFecha = el("input", { type: "date", class: "control", value: s.fecha || todayISO() });
    const inHora = el("input", { type: "time", class: "control", value: s.hora || "" });
    lista.append(el("div", { class: "fila-sc" },
      el("p", { class: "sc-texto", text: `“${s.texto_original}”` }),
      el("div", { class: "sc-controles" }, selAsig, selTipo, inFecha, inHora),
      el("div", { class: "sc-acciones" },
        el("button", { type: "button", class: "boton pequeno secundario", text: "Descartar", onclick: () => {
          vibrar(8);
          const copia = instantanea();
          DB.sin_clasificar = DB.sin_clasificar.filter((x) => x.id !== s.id); guardar();
          aviso("Descartado", { accion: { texto: "Deshacer", alPulsar: () => restaurar(copia) } });
        } }),
        el("button", { type: "button", class: "boton pequeno primario", text: "Guardar", onclick: () => {
          vibrar();
          resolverSinClasificar(s.id, { asignatura_id: selAsig.value, tipo: selTipo.value, fecha: inFecha.value, hora: inHora.value });
        } }))));
  }
  return el("section", { class: "seccion" },
    el("div", { class: "seccion-cab" }, el("h2", { text: "Sin clasificar" }), el("span", { class: "contador", text: DB.sin_clasificar.length })),
    el("div", { class: "tarjeta sc-card" }, lista));
}

/* ---------- La semana ---------- */

function seccionSemana() {
  const lunes = mondayOf(today()), hoy = todayISO();
  const tira = el("div", { class: "semana-tira" });
  for (let i = 0; i < 7; i++) {
    const d = sumarDias(lunes, i);
    const evs = DB.eventos.filter((e) => e.fecha === d && !asig(e.asignatura_id)?.archivada);
    tira.append(el("button", { type: "button", class: `semana-dia ${d === hoy ? "hoy" : ""} ${d < hoy ? "pasado" : ""}`,
      onclick: () => { vibrar(8); evs.length === 1 ? fichaEvento(evs[0].id) : irA("calendario", { dia: d }); } },
      el("span", { class: "sd-letra", text: diaSemanaCorto(d).slice(0, 1).toUpperCase() }),
      el("span", { class: "sd-num", text: parseDate(d).getDate() }),
      el("span", { class: "sd-puntos" }, ...evs.slice(0, 3).map((e) => el("i", { style: { background: colorAsig(e.asignatura_id) } })))));
  }
  const m = minutosSemana();
  const mh = minutosHoy();
  return el("section", { class: "seccion" },
    el("div", { class: "seccion-cab" }, el("h2", { text: "Esta semana" })),
    el("div", { class: "tarjeta" }, tira,
      el("button", { type: "button", class: "fila-foco", onclick: () => { vibrar(8); irA("foco"); } },
        el("span", { class: "fila-foco-ico", html: icono("foco") }),
        el("span", { class: "fila-texto" },
          el("strong", { text: m.total ? `${minutosTexto(m.total)} de concentración` : "Aún sin sesiones de concentración" }),
          el("small", { text: mh ? `Hoy llevas ${minutosTexto(mh)}` : "Empieza una sesión en Foco" })),
        el("span", { class: "chevron", html: icono("chevron") }))));
}

export function pintarEstadoNube(e) {
  const n = document.getElementById("estado-nube");
  if (!n) return;
  let clase = "ok", texto = "Sincronizado";
  if (e.error) { clase = "error"; texto = "Error al sincronizar"; }
  else if (!e.enLinea) { clase = "offline"; texto = e.pendientes ? "Sin conexión · se subirá luego" : "Sin conexión"; }
  else if (e.pendientes || !e.servidor) { clase = "pendiente"; texto = "Sincronizando…"; }
  n.className = `estado-nube ${clase}`;
  n.title = texto;
  n.innerHTML = `${icono("nube")}<span class="sr">${esc(texto)}</span>`;
}
