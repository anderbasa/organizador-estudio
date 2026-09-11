'use strict';

/* =====================================================================
   Organizador de estudio — una sola pantalla, todo en el navegador.
   Sin backend, sin IA en tiempo real, sin PWA.
   ===================================================================== */

/* ============ Almacenamiento (localStorage) ============ */

const STORAGE_KEY = 'organizador_estudio_v1';

const DEFAULT_DB = () => ({
  asignaturas: [], // { id, nombre, alias: [] }
  eventos: [],     // { id, asignatura_id, tipo, fecha, temas_relacionados: [], texto_original }
  temas: [],       // { id, asignatura_id, nombre, fecha_ultimo_repaso, dificultad, dias_evitado_consecutivos }
  sin_clasificar: [], // { id, texto_original, asignatura_id, tipo, fecha }
  meta: {
    cuatrimestre_inicio: null,
    cuatrimestre_fin: null,
    sugerencia: null // { fecha: 'YYYY-MM-DD', tema_ids: [] }
  }
});

let DB = loadDB();

function loadDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedMeta(DEFAULT_DB());
    const parsed = JSON.parse(raw);
    const base = DEFAULT_DB();
    return seedMeta(Object.assign(base, parsed, {
      meta: Object.assign(base.meta, parsed.meta || {})
    }));
  } catch (e) {
    console.error('Almacenamiento ilegible, se empieza de cero.', e);
    return seedMeta(DEFAULT_DB());
  }
}

function seedMeta(db) {
  if (!db.meta.cuatrimestre_inicio) db.meta.cuatrimestre_inicio = mondayOf(today());
  if (!db.meta.cuatrimestre_fin) {
    db.meta.cuatrimestre_fin = isoDate(addDays(parseDate(db.meta.cuatrimestre_inicio), 7 * 18));
  }
  return db;
}

function saveDB() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
  } catch (e) {
    flash('⚠ No se pudo guardar (¿almacenamiento lleno o bloqueado?)');
  }
  render();
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ============ Utilidades de fecha ============ */

const DAY_MS = 86400000;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_SEMANA = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function today() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
function todayISO() { return isoDate(today()); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function mondayOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // 0 = lunes
  x.setDate(x.getDate() - dow);
  return isoDate(x);
}
function daysBetween(isoA, isoB) { return Math.round((parseDate(isoB) - parseDate(isoA)) / DAY_MS); }
function daysSince(iso) { return Math.round((today() - parseDate(iso)) / DAY_MS); }
function formatDMY(iso) { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
}

/* ============ Clasificador local (solo reglas de texto) ============ */

const PAL_EXAMEN = ['examen', 'parcial', 'final', 'test', 'control', 'prueba'];
const PAL_ENTREGA = ['entrega', 'entregar', 'trabajo', 'informe', 'presentar', 'presentacion',
  'practica', 'memoria', 'ensayo', 'proyecto'];
const PAL_REPASO = ['repasar', 'repaso', 'repase', 'estudiar', 'estudie', 'estudio',
  'revisar', 'revise', 'repasando', 'estudiando'];

function detectarFecha(texto) {
  const t = ' ' + normalize(texto).replace(/\s+/g, ' ') + ' ';
  const hoy = today();

  // dd/mm(/aaaa) o dd-mm(-aaaa)
  let m = t.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (m) {
    const d = +m[1], mo = +m[2];
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
      let year = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : hoy.getFullYear();
      let cand = new Date(year, mo - 1, d);
      if (!m[3] && cand < hoy) cand = new Date(year + 1, mo - 1, d);
      return isoDate(cand);
    }
  }

  // "14 de marzo" (opcionalmente "de 2026")
  m = t.match(new RegExp('\\b(\\d{1,2}) de (' + MESES.join('|') + '|setiembre)(?: de (\\d{4}))?\\b'));
  if (m) {
    const d = +m[1];
    const mo = m[2] === 'setiembre' ? 8 : MESES.indexOf(m[2]);
    let year = m[3] ? +m[3] : hoy.getFullYear();
    let cand = new Date(year, mo, d);
    if (!m[3] && cand < hoy) cand = new Date(year + 1, mo, d);
    return isoDate(cand);
  }

  // relativas
  if (/\bpasado manana\b/.test(t)) return isoDate(addDays(hoy, 2));
  if (/\bmanana\b/.test(t)) return isoDate(addDays(hoy, 1));
  if (/\bhoy\b/.test(t)) return todayISO();

  m = t.match(/\ben (\d{1,2}) dias?\b/);
  if (m) return isoDate(addDays(hoy, +m[1]));

  if (/\b(la semana que viene|semana que viene|la proxima semana|proxima semana)\b/.test(t)) {
    return mondayOf(addDays(hoy, 7));
  }
  if (/\besta semana\b/.test(t)) {
    const viernes = addDays(parseDate(mondayOf(hoy)), 4);
    return isoDate(viernes < hoy ? hoy : viernes);
  }

  // día de la semana ("el lunes", "el próximo lunes"...)
  m = t.match(/\b(este |el |proximo |el proximo |la proxima )?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/);
  if (m) {
    const objetivo = DIAS_SEMANA[m[2]];
    let d = addDays(hoy, 1);
    while (d.getDay() !== objetivo) d = addDays(d, 1);
    if (m[1] && /proxim/.test(m[1])) d = addDays(d, 7);
    return isoDate(d);
  }

  // "el 14" (solo día del mes)
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

function detectarTipo(texto) {
  const t = normalize(texto);
  if (PAL_EXAMEN.some(p => new RegExp('\\b' + p).test(t))) return 'examen';
  if (PAL_ENTREGA.some(p => new RegExp('\\b' + p).test(t))) return 'entrega';
  return null;
}

function esRepaso(texto) {
  const t = normalize(texto);
  return PAL_REPASO.some(p => new RegExp('\\b' + p).test(t));
}

function clavesAsignatura(a) {
  return [a.nombre, ...(a.alias || [])]
    .map(normalize)
    .filter(x => x.length >= 3)
    .sort((x, y) => y.length - x.length);
}

function detectarAsignatura(texto) {
  const t = normalize(texto);
  let best = null, bestLen = 0;
  for (const a of DB.asignaturas) {
    for (const k of clavesAsignatura(a)) {
      if (t.includes(k) && k.length > bestLen) { best = a; bestLen = k.length; }
    }
  }
  return best;
}

function extraerNombreTema(texto, asignatura) {
  let t = normalize(texto);
  for (const p of PAL_REPASO) t = t.replace(new RegExp('\\b' + p + '\\b', 'g'), ' ');
  if (asignatura) {
    for (const k of clavesAsignatura(asignatura)) t = t.replace(new RegExp(k, 'g'), ' ');
  }
  t = t
    .replace(/\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?/g, ' ')
    .replace(/\b(de|del|la|el|los|las|un|una|para|y|en|a|mi|sobre)\b/g, ' ')
    .replace(/\b(manana|hoy|pasado|proximo|proxima|semana|que|viene|este|esta|dias?)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t;
}

function clasificar(texto) {
  const fecha = detectarFecha(texto);
  const tipo = detectarTipo(texto);
  const asignatura = detectarAsignatura(texto);
  const repaso = esRepaso(texto);

  if (repaso && !tipo && asignatura) {
    return { accion: 'tema', asignatura, nombre: extraerNombreTema(texto, asignatura) || 'general' };
  }
  if (fecha && tipo && asignatura) {
    return { accion: 'evento', asignatura, tipo, fecha };
  }
  return {
    accion: 'sin_clasificar',
    asignatura,
    tipo: repaso ? 'repaso' : (tipo || 'examen'),
    fecha: fecha || todayISO()
  };
}

/* ============ Captura ============ */

function capturar(textoRaw) {
  const texto = (textoRaw || '').trim();
  if (!texto) return;
  const r = clasificar(texto);

  if (r.accion === 'evento') {
    DB.eventos.push({
      id: uid(), asignatura_id: r.asignatura.id, tipo: r.tipo,
      fecha: r.fecha, temas_relacionados: [], texto_original: texto
    });
    flash(`✓ ${r.tipo === 'examen' ? 'Examen' : 'Entrega'} · ${r.asignatura.nombre} · ${formatDMY(r.fecha)}`);
  } else if (r.accion === 'tema') {
    let tema = DB.temas.find(t =>
      t.asignatura_id === r.asignatura.id && normalize(t.nombre) === normalize(r.nombre));
    if (!tema) {
      DB.temas.push({
        id: uid(), asignatura_id: r.asignatura.id, nombre: r.nombre,
        fecha_ultimo_repaso: todayISO(), dificultad: 'repaso_rapido', dias_evitado_consecutivos: 0
      });
      flash(`✓ Tema nuevo "${r.nombre}" (${r.asignatura.nombre}), repasado hoy`);
    } else {
      tema.fecha_ultimo_repaso = todayISO();
      tema.dias_evitado_consecutivos = 0;
      flash(`✓ Repaso registrado: "${tema.nombre}" (${r.asignatura.nombre})`);
    }
  } else {
    DB.sin_clasificar.push({
      id: uid(), texto_original: texto,
      asignatura_id: r.asignatura ? r.asignatura.id : null,
      tipo: r.tipo, fecha: r.fecha
    });
    flash('⚠ No pude clasificarlo con seguridad — está abajo en "Sin clasificar"');
  }
  saveDB();
}

function resolverSinClasificar(id, row) {
  const s = DB.sin_clasificar.find(x => x.id === id);
  if (!s) return;
  const asigId = row.querySelector('[data-f=asignatura]').value;
  const tipo = row.querySelector('[data-f=tipo]').value;
  const fecha = row.querySelector('[data-f=fecha]').value;
  if (!asigId) { flash('Elige una asignatura'); return; }

  if (tipo === 'repaso') {
    const asig = DB.asignaturas.find(a => a.id === asigId);
    const nombre = extraerNombreTema(s.texto_original, asig) || s.texto_original;
    let tema = DB.temas.find(t => t.asignatura_id === asigId && normalize(t.nombre) === normalize(nombre));
    if (tema) { tema.fecha_ultimo_repaso = fecha || todayISO(); tema.dias_evitado_consecutivos = 0; }
    else DB.temas.push({
      id: uid(), asignatura_id: asigId, nombre,
      fecha_ultimo_repaso: fecha || todayISO(), dificultad: 'repaso_rapido', dias_evitado_consecutivos: 0
    });
  } else {
    if (!fecha) { flash('Elige una fecha'); return; }
    DB.eventos.push({
      id: uid(), asignatura_id: asigId, tipo, fecha,
      temas_relacionados: [], texto_original: s.texto_original
    });
  }
  DB.sin_clasificar = DB.sin_clasificar.filter(x => x.id !== id);
  saveDB();
  flash('✓ Clasificado');
}

/* ============ Ciclo diario: sugerencia y evitación ============ */

function generarSugerencia() {
  const orden = DB.temas.slice().sort((a, b) => infoTema(b).score - infoTema(a).score);
  const duros = orden.filter(t => t.dificultad === 'cuesta_arriba');
  const ligeros = orden.filter(t => t.dificultad !== 'cuesta_arriba');
  const pick = [];
  let i = 0, j = 0;
  const objetivo = Math.min(3, DB.temas.length);
  while (pick.length < objetivo) {
    if (pick.length % 2 === 0 && i < duros.length) pick.push(duros[i++]);
    else if (j < ligeros.length) pick.push(ligeros[j++]);
    else if (i < duros.length) pick.push(duros[i++]);
    else break;
  }
  DB.meta.sugerencia = { fecha: todayISO(), tema_ids: pick.map(t => t.id) };
}

function cicloDiario() {
  const s = DB.meta.sugerencia;
  if (s && s.fecha !== todayISO()) {
    // Cierre del día anterior: lo sugerido y no repasado suma un día de evitación.
    for (const id of s.tema_ids) {
      const t = DB.temas.find(x => x.id === id);
      if (t && (!t.fecha_ultimo_repaso || t.fecha_ultimo_repaso < s.fecha)) {
        t.dias_evitado_consecutivos = (t.dias_evitado_consecutivos || 0) + 1;
      }
    }
    DB.meta.sugerencia = null;
  }
  if (!DB.meta.sugerencia && DB.temas.length) generarSugerencia();
  saveDB();
}

function marcarRepasado(id) {
  const t = DB.temas.find(x => x.id === id);
  if (!t) return;
  t.fecha_ultimo_repaso = todayISO();
  t.dias_evitado_consecutivos = 0;
  saveDB();
  flash(`✓ "${t.nombre}" repasado hoy`);
}

/* ============ Urgencia / deuda ============ */

function eventoProximoDeTema(t) {
  const hoy = todayISO();
  let mejor = null;
  for (const e of DB.eventos) {
    if (e.fecha < hoy) continue;
    const ligado = (e.temas_relacionados || []).includes(t.id);
    const mismaAsig = e.asignatura_id === t.asignatura_id;
    if (!ligado && !mismaAsig) continue;
    const dias = daysBetween(hoy, e.fecha);
    if (mejor === null || dias < mejor) mejor = dias;
  }
  return mejor;
}

function infoTema(t) {
  const nunca = !t.fecha_ultimo_repaso;
  const dias = nunca ? 999 : daysSince(t.fecha_ultimo_repaso);
  const evDias = eventoProximoDeTema(t);
  let bonus = 0;
  if (evDias !== null) bonus = evDias <= 7 ? 14 : evDias <= 14 ? 7 : 3;
  const score = dias + bonus;
  let color = 'verde';
  if (nunca || score >= 21) color = 'rojo';
  else if (score >= 10) color = 'ambar';
  return { nunca, dias, evDias, bonus, score, color };
}

/* ============ Carga semanal (heatmap) ============ */

function cargaSemana(lunesISO) {
  const finSemana = isoDate(addDays(parseDate(lunesISO), 6));
  const nEv = DB.eventos.filter(e => e.fecha >= lunesISO && e.fecha <= finSemana).length;
  let deuda = 0;
  for (const t of DB.temas) {
    if (!t.fecha_ultimo_repaso) { deuda += 3; continue; }
    const d = daysBetween(t.fecha_ultimo_repaso, lunesISO);
    if (d <= 0) continue;
    deuda += (Math.min(d, 70) / 7) * (t.dificultad === 'cuesta_arriba' ? 1.5 : 1);
  }
  return { nEv, deuda, total: nEv * 3 + deuda };
}

function nivelCarga(total, max) {
  if (total <= 0.5) return 0;
  if (!max || max <= 0) return 1;
  const r = total / max;
  if (r < 0.25) return 1;
  if (r < 0.5) return 2;
  if (r < 0.8) return 3;
  return 4;
}

/* ============ Calendario mensual ============ */

let calCursor = today(); // cualquier día dentro del mes que se muestra

function inicioCuadriculaMes(year, month) {
  return parseDate(mondayOf(new Date(year, month, 1)));
}

function celdasMes(year, month) {
  const inicio = inicioCuadriculaMes(year, month);
  const ultimoDia = new Date(year, month + 1, 0);
  const diasTotales = daysBetween(isoDate(inicio), isoDate(ultimoDia)) + 1;
  const semanas = Math.ceil(diasTotales / 7);
  const celdas = [];
  for (let i = 0; i < semanas * 7; i++) celdas.push(addDays(inicio, i));
  return celdas;
}

function eventosDelDia(iso) {
  return DB.eventos.filter(e => e.fecha === iso).sort((a, b) => a.tipo.localeCompare(b.tipo));
}

function renderCalendario() {
  const label = document.getElementById('cal-label');
  const grid = document.getElementById('calendario');
  const det = document.getElementById('calendario-detalle');
  const year = calCursor.getFullYear();
  const month = calCursor.getMonth();
  label.textContent = `${MESES[month]} ${year}`;

  const celdas = celdasMes(year, month);
  const hoyISO = todayISO();

  grid.innerHTML = celdas.map(d => {
    const iso = isoDate(d);
    const fuera = d.getMonth() !== month;
    const evs = fuera ? [] : eventosDelDia(iso);
    const clases = ['cal-day'];
    if (fuera) clases.push('fuera');
    if (iso === hoyISO) clases.push('hoy');
    if (evs.length >= 2) clases.push('colision');
    const chips = evs.slice(0, 2).map(e =>
      `<span class="cal-chip tipo-${e.tipo}">${e.tipo === 'examen' ? '📕' : '📄'} ${nombreAsig(e.asignatura_id)}</span>`
    ).join('') + (evs.length > 2 ? `<span class="cal-chip mas">+${evs.length - 2}</span>` : '');
    return `<button type="button" class="${clases.join(' ')}" data-iso="${iso}" data-fuera="${fuera}">
      <span class="cal-num">${d.getDate()}</span>
      <span class="cal-chips">${chips}</span>
    </button>`;
  }).join('');

  det.hidden = true;
  grid.querySelectorAll('.cal-day').forEach(btn => {
    btn.onclick = () => {
      if (btn.dataset.fuera === 'true') return;
      grid.querySelectorAll('.cal-day.seleccionado').forEach(x => x.classList.remove('seleccionado'));
      const iso = btn.dataset.iso;
      const evs = eventosDelDia(iso);
      if (!evs.length) {
        det.hidden = true;
        const input = document.getElementById('captura-input');
        input.value = `el ${formatDMY(iso).slice(0, 5)} `;
        input.focus();
        return;
      }
      btn.classList.add('seleccionado');
      det.hidden = false;
      det.innerHTML = `<strong>${formatDMY(iso)}</strong><ul>` +
        evs.map(e => `<li>${nombreAsig(e.asignatura_id)} · ${e.tipo}
          <span class="muted">— ${escapeHtml(e.texto_original || '')}</span></li>`).join('') +
        `</ul>`;
    };
  });
}

function cambiarMes(delta) {
  calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + delta, 1);
  renderCalendario();
}

/* ============ Próximos (agenda lateral) ============ */

function renderProximos() {
  const cont = document.getElementById('proximos');
  const hoy = todayISO();
  const evs = DB.eventos
    .filter(e => e.fecha >= hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, 6);
  if (!evs.length) {
    cont.innerHTML = '<p class="muted">No hay exámenes ni entregas por delante. Captura uno arriba.</p>';
    return;
  }
  cont.innerHTML = `<ul class="prox-list">` + evs.map(e => {
    const dias = daysBetween(hoy, e.fecha);
    const cuando = dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : `${dias} d.`;
    return `<li class="prox-row">
      <span class="prox-cuando ${dias <= 3 ? 'pronto' : ''}">${cuando}</span>
      <div class="prox-main">
        <div class="prox-asig">${nombreAsig(e.asignatura_id)}</div>
        <div class="prox-sub">${e.tipo === 'examen' ? 'Examen' : 'Entrega'} · ${formatDMY(e.fecha)}</div>
      </div>
    </li>`;
  }).join('') + `</ul>`;
}

/* ============ Resumen ejecutivo ============ */

function renderResumen() {
  const cont = document.getElementById('resumen');
  const chips = [];
  chips.push(`<span class="resumen-chip"><strong>${DB.asignaturas.length}</strong> asignatura${DB.asignaturas.length === 1 ? '' : 's'}</span>`);

  const hoy = todayISO();
  const proximo = DB.eventos.filter(e => e.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
  if (proximo) {
    const dias = daysBetween(hoy, proximo.fecha);
    const cuando = dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : `en ${dias} días`;
    chips.push(`<span class="resumen-chip next">Próximo: <strong>${nombreAsig(proximo.asignatura_id)}</strong> (${proximo.tipo}) ${cuando}</span>`);
  } else {
    chips.push(`<span class="resumen-chip">Sin exámenes ni entregas a la vista</span>`);
  }

  if (DB.temas.length) {
    const rojos = DB.temas.filter(t => infoTema(t).color === 'rojo').length;
    if (rojos > 0) {
      chips.push(`<span class="resumen-chip warn"><strong>${rojos}</strong> tema${rojos === 1 ? '' : 's'} muy atrasado${rojos === 1 ? '' : 's'}</span>`);
    } else {
      chips.push(`<span class="resumen-chip">Ningún tema en rojo ahora mismo</span>`);
    }
  }
  cont.innerHTML = chips.join('');
}

/* ============ Render ============ */

function nombreAsig(id) {
  const a = DB.asignaturas.find(x => x.id === id);
  return a ? escapeHtml(a.nombre) : '¿sin asignatura?';
}
function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let flashTimer;
function flash(msg) {
  const el = document.getElementById('captura-flash');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { el.hidden = true; }, 6000);
}

function render() {
  renderResumen();
  renderSinClasificar();
  renderCalendario();
  renderProximos();
  renderHeatmap();
  renderSugerencia();
  renderDeuda();
  renderAsignaturas();
  renderTemasPanel();
  renderEventosPanel();
  renderDatosPanel();
}

function renderSinClasificar() {
  const sec = document.getElementById('sin-clasificar-sec');
  const list = document.getElementById('sin-clasificar-list');
  if (!DB.sin_clasificar.length) { sec.hidden = true; list.innerHTML = ''; return; }
  sec.hidden = false;
  const opts = DB.asignaturas.map(a => `<option value="${a.id}">${escapeHtml(a.nombre)}</option>`).join('');
  list.innerHTML = DB.sin_clasificar.map(s => `
    <div class="sc-row" data-id="${s.id}">
      <div class="sc-texto">"${escapeHtml(s.texto_original)}"</div>
      <div class="sc-controls">
        <select data-f="asignatura"><option value="">asignatura…</option>${opts}</select>
        <select data-f="tipo">
          <option value="examen">examen</option>
          <option value="entrega">entrega</option>
          <option value="repaso">repaso (tema)</option>
        </select>
        <input type="date" data-f="fecha" value="${s.fecha || todayISO()}" />
        <button data-a="guardar">Guardar</button>
        <button data-a="borrar" class="ghost">Descartar</button>
      </div>
    </div>`).join('');
  list.querySelectorAll('.sc-row').forEach(row => {
    const id = row.dataset.id;
    const s = DB.sin_clasificar.find(x => x.id === id);
    if (s.asignatura_id) row.querySelector('[data-f=asignatura]').value = s.asignatura_id;
    row.querySelector('[data-f=tipo]').value = s.tipo || 'examen';
    row.querySelector('[data-a=guardar]').onclick = () => resolverSinClasificar(id, row);
    row.querySelector('[data-a=borrar]').onclick = () => {
      DB.sin_clasificar = DB.sin_clasificar.filter(x => x.id !== id);
      saveDB();
    };
  });
}

function renderHeatmap() {
  const cont = document.getElementById('heatmap');
  const det = document.getElementById('heatmap-detalle');
  det.hidden = true;
  const ini = parseDate(mondayOf(parseDate(DB.meta.cuatrimestre_inicio)));
  const fin = parseDate(DB.meta.cuatrimestre_fin);
  const celdas = [];
  let cursor = new Date(ini);
  let guard = 0;
  while (cursor <= fin && guard++ < 60) {
    const lunesISO = isoDate(cursor);
    celdas.push(Object.assign({ lunesISO }, cargaSemana(lunesISO)));
    cursor = addDays(cursor, 7);
  }
  const hoyLunes = mondayOf(today());
  const maxTotal = celdas.reduce((m, c) => Math.max(m, c.total), 0);
  cont.innerHTML = celdas.map((c, i) => {
    const dd = parseDate(c.lunesISO);
    const mes = dd.getDate() <= 7 ? MESES[dd.getMonth()].slice(0, 3) : '';
    return `<div class="hm-col">
      <span class="hm-mes">${mes}</span>
      <button class="hm-cell n${nivelCarga(c.total, maxTotal)} ${c.lunesISO === hoyLunes ? 'hoy' : ''}"
        data-i="${i}"
        title="Semana del ${formatDMY(c.lunesISO)} · ${c.nEv} evento(s) · deuda ${c.deuda.toFixed(1)}"></button>
    </div>`;
  }).join('');
  cont.querySelectorAll('.hm-cell').forEach(b => b.onclick = () => {
    const c = celdas[+b.dataset.i];
    const finSemana = isoDate(addDays(parseDate(c.lunesISO), 6));
    const evs = DB.eventos.filter(e => e.fecha >= c.lunesISO && e.fecha <= finSemana);
    const atrasados = DB.temas
      .map(t => ({ t, d: t.fecha_ultimo_repaso ? daysBetween(t.fecha_ultimo_repaso, c.lunesISO) : 999 }))
      .filter(x => x.d >= 10)
      .sort((a, b) => b.d - a.d)
      .slice(0, 6);
    det.hidden = false;
    det.innerHTML = `<strong>Semana del ${formatDMY(c.lunesISO)}</strong>` +
      `<div class="muted">${c.nEv} evento(s) · índice de carga ${c.total.toFixed(1)}</div>` +
      (evs.length
        ? `<ul>` + evs.map(e => `<li>${formatDMY(e.fecha)} · ${nombreAsig(e.asignatura_id)} · ${e.tipo}</li>`).join('') + `</ul>`
        : `<p class="muted">Sin eventos esa semana.</p>`) +
      (atrasados.length
        ? `<div class="muted">Temas más atrasados en ese momento:</div><ul>` +
          atrasados.map(x => `<li>${escapeHtml(x.t.nombre)} (${nombreAsig(x.t.asignatura_id)}) · ${x.d} días sin repasar</li>`).join('') + `</ul>`
        : '');
  });
}

function renderSugerencia() {
  const cont = document.getElementById('sugerencia');
  const s = DB.meta.sugerencia;
  if (!DB.temas.length) {
    cont.innerHTML = '<p class="muted">Añade temas (o captura un repaso) para recibir una sugerencia diaria.</p>';
    return;
  }
  if (!s) {
    cont.innerHTML = '<p class="muted">Sin sugerencia para hoy. <button id="gen-sug">Generar</button></p>';
    cont.querySelector('#gen-sug').onclick = () => { generarSugerencia(); saveDB(); };
    return;
  }
  const temas = s.tema_ids.map(id => DB.temas.find(t => t.id === id)).filter(Boolean);
  if (!temas.length) {
    cont.innerHTML = '<p class="muted">Sin sugerencia para hoy. <button id="gen-sug">Generar</button></p>';
    cont.querySelector('#gen-sug').onclick = () => { generarSugerencia(); saveDB(); };
    return;
  }
  cont.innerHTML =
    `<p class="hint">Mezcla de temas que cuestan y de repaso rápido, para no cargar siempre con lo más pesado.</p>
     <ul class="sug-list">` +
    temas.map(t => {
      const hecho = t.fecha_ultimo_repaso >= s.fecha;
      return `<li>
        <span class="dif-badge ${t.dificultad}">${t.dificultad === 'cuesta_arriba' ? 'cuesta arriba' : 'repaso rápido'}</span>
        <span class="sug-nombre ${hecho ? 'tachado' : ''}">${escapeHtml(t.nombre)}
          <span class="muted">· ${nombreAsig(t.asignatura_id)}</span></span>
        ${hecho ? '<span class="ok">repasado ✓</span>' : `<button data-rev="${t.id}">Marcar repasado</button>`}
      </li>`;
    }).join('') + `</ul>`;
  cont.querySelectorAll('[data-rev]').forEach(b => b.onclick = () => marcarRepasado(b.dataset.rev));
}

function renderDeuda() {
  const cont = document.getElementById('deuda');
  if (!DB.temas.length) {
    cont.innerHTML = '<p class="muted">Aún no hay temas. Captura un repaso o añádelos en la sección "Temas".</p>';
    return;
  }
  const filas = DB.temas
    .map(t => ({ t, info: infoTema(t) }))
    .sort((a, b) => b.info.score - a.info.score);
  cont.innerHTML = `<ul class="deuda-list">` + filas.map(({ t, info }) => `
    <li class="deuda-row">
      <span class="dot ${info.color}"></span>
      <div class="deuda-main">
        <div class="deuda-nombre">${escapeHtml(t.nombre)} <span class="muted">· ${nombreAsig(t.asignatura_id)}</span></div>
        <div class="deuda-sub muted">
          ${info.nunca ? 'nunca repasado' : `${info.dias} día(s) sin repasar`}${info.evDias !== null ? ` · examen/entrega en ${info.evDias} día(s)` : ''}${t.dias_evitado_consecutivos > 0 ? ` · llevas evitando esto ${t.dias_evitado_consecutivos} día(s)` : ''}
        </div>
      </div>
      <div class="deuda-acciones">
        <button class="dif-toggle ${t.dificultad}" data-dif="${t.id}">${t.dificultad === 'cuesta_arriba' ? 'cuesta arriba' : 'repaso rápido'}</button>
        <button data-rev="${t.id}">repasado hoy</button>
      </div>
    </li>`).join('') + `</ul>`;
  cont.querySelectorAll('[data-dif]').forEach(b => b.onclick = () => {
    const t = DB.temas.find(x => x.id === b.dataset.dif);
    t.dificultad = t.dificultad === 'cuesta_arriba' ? 'repaso_rapido' : 'cuesta_arriba';
    saveDB();
  });
  cont.querySelectorAll('[data-rev]').forEach(b => b.onclick = () => marcarRepasado(b.dataset.rev));
}

function renderAsignaturas() {
  const p = document.getElementById('asignaturas-panel');
  p.innerHTML = DB.asignaturas.map(a => `
    <div class="cfg-row" data-id="${a.id}">
      <input data-f="nombre" value="${escapeHtml(a.nombre)}" />
      <input data-f="alias" value="${escapeHtml((a.alias || []).join(', '))}" placeholder="alias separados por comas" />
      <button data-a="save">Guardar</button>
      <button data-a="del" class="ghost">Eliminar</button>
    </div>`).join('') + `
    <div class="cfg-row nueva">
      <input id="na-nombre" placeholder="nueva asignatura" />
      <input id="na-alias" placeholder="alias: conta, contabilidad…" />
      <button id="na-add">Añadir</button>
    </div>`;
  p.querySelectorAll('.cfg-row[data-id]').forEach(row => {
    const id = row.dataset.id;
    row.querySelector('[data-a=save]').onclick = () => {
      const a = DB.asignaturas.find(x => x.id === id);
      a.nombre = row.querySelector('[data-f=nombre]').value.trim() || a.nombre;
      a.alias = row.querySelector('[data-f=alias]').value.split(',').map(s => s.trim()).filter(Boolean);
      saveDB(); flash('✓ Asignatura guardada');
    };
    row.querySelector('[data-a=del]').onclick = () => {
      if (!confirm('¿Eliminar asignatura? Sus temas y eventos quedarán sin asignatura.')) return;
      DB.asignaturas = DB.asignaturas.filter(x => x.id !== id);
      saveDB();
    };
  });
  p.querySelector('#na-add').onclick = () => {
    const nombre = p.querySelector('#na-nombre').value.trim();
    if (!nombre) return;
    DB.asignaturas.push({
      id: uid(), nombre,
      alias: p.querySelector('#na-alias').value.split(',').map(s => s.trim()).filter(Boolean)
    });
    saveDB();
  };
}

function renderTemasPanel() {
  const p = document.getElementById('temas-panel');
  const asigOpts = DB.asignaturas.map(a => `<option value="${a.id}">${escapeHtml(a.nombre)}</option>`).join('');
  if (!DB.asignaturas.length) {
    p.innerHTML = '<p class="muted">Primero añade alguna asignatura.</p>';
    return;
  }
  p.innerHTML = (DB.temas.length ? DB.temas.map(t => `
    <div class="cfg-row" data-id="${t.id}">
      <input data-f="nombre" value="${escapeHtml(t.nombre)}" />
      <select data-f="asig">${asigOpts}</select>
      <label class="muted" style="font-size:.8rem">últ. repaso <input type="date" data-f="repaso" value="${t.fecha_ultimo_repaso || ''}" /></label>
      <button data-a="save">Guardar</button>
      <button data-a="del" class="ghost">Eliminar</button>
    </div>`).join('') : '<p class="muted">Sin temas.</p>') + `
    <div class="cfg-row nueva">
      <input id="nt-nombre" placeholder="nuevo tema" />
      <select id="nt-asig">${asigOpts}</select>
      <button id="nt-add">Añadir</button>
    </div>`;
  p.querySelectorAll('.cfg-row[data-id]').forEach(row => {
    const id = row.dataset.id;
    const t = DB.temas.find(x => x.id === id);
    row.querySelector('[data-f=asig]').value = t.asignatura_id;
    row.querySelector('[data-a=save]').onclick = () => {
      t.nombre = row.querySelector('[data-f=nombre]').value.trim() || t.nombre;
      t.asignatura_id = row.querySelector('[data-f=asig]').value;
      t.fecha_ultimo_repaso = row.querySelector('[data-f=repaso]').value || null;
      saveDB(); flash('✓ Tema guardado');
    };
    row.querySelector('[data-a=del]').onclick = () => {
      if (!confirm('¿Eliminar tema?')) return;
      DB.temas = DB.temas.filter(x => x.id !== id);
      DB.eventos.forEach(e => e.temas_relacionados = (e.temas_relacionados || []).filter(x => x !== id));
      saveDB();
    };
  });
  p.querySelector('#nt-add').onclick = () => {
    const nombre = p.querySelector('#nt-nombre').value.trim();
    const asig = p.querySelector('#nt-asig').value;
    if (!nombre || !asig) { flash('Nombre y asignatura'); return; }
    DB.temas.push({
      id: uid(), asignatura_id: asig, nombre,
      fecha_ultimo_repaso: todayISO(), dificultad: 'repaso_rapido', dias_evitado_consecutivos: 0
    });
    saveDB();
  };
}

function renderEventosPanel() {
  const p = document.getElementById('eventos-panel');
  const evs = DB.eventos.slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (!evs.length) { p.innerHTML = '<p class="muted">Sin eventos.</p>'; return; }
  p.innerHTML = evs.map(e => `
    <div class="cfg-row ev" data-id="${e.id}">
      <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center">
        <input type="date" data-f="fecha" value="${e.fecha}" />
        <select data-f="tipo"><option value="examen">examen</option><option value="entrega">entrega</option></select>
        <select data-f="asig">${DB.asignaturas.map(a => `<option value="${a.id}">${escapeHtml(a.nombre)}</option>`).join('')}</select>
        <button data-a="save">Guardar</button>
        <button data-a="del" class="ghost">Eliminar</button>
      </div>
      <div class="ev-temas">${
        DB.temas.filter(t => t.asignatura_id === e.asignatura_id).map(t => `
          <label><input type="checkbox" data-tema="${t.id}" ${(e.temas_relacionados || []).includes(t.id) ? 'checked' : ''}/> ${escapeHtml(t.nombre)}</label>`).join('')
        || '<span class="muted">Sin temas en esta asignatura</span>'}</div>
      <div class="muted" style="font-size:.8rem">${escapeHtml(e.texto_original || '')}</div>
    </div>`).join('');
  p.querySelectorAll('.cfg-row[data-id]').forEach(row => {
    const id = row.dataset.id;
    const e = DB.eventos.find(x => x.id === id);
    row.querySelector('[data-f=tipo]').value = e.tipo;
    row.querySelector('[data-f=asig]').value = e.asignatura_id;
    row.querySelector('[data-a=save]').onclick = () => {
      e.fecha = row.querySelector('[data-f=fecha]').value || e.fecha;
      e.tipo = row.querySelector('[data-f=tipo]').value;
      e.asignatura_id = row.querySelector('[data-f=asig]').value;
      e.temas_relacionados = [...row.querySelectorAll('[data-tema]:checked')].map(c => c.dataset.tema);
      saveDB(); flash('✓ Evento guardado');
    };
    row.querySelector('[data-a=del]').onclick = () => {
      if (!confirm('¿Eliminar evento?')) return;
      DB.eventos = DB.eventos.filter(x => x.id !== id);
      saveDB();
    };
  });
}

function renderDatosPanel() {
  const p = document.getElementById('datos-panel');
  p.innerHTML = `
    <div class="cfg-row">
      <label class="muted" style="font-size:.85rem">Cuatrimestre del <input type="date" id="q-ini" value="${DB.meta.cuatrimestre_inicio}" /></label>
      <label class="muted" style="font-size:.85rem">al <input type="date" id="q-fin" value="${DB.meta.cuatrimestre_fin}" /></label>
      <button id="q-save">Guardar rango</button>
    </div>
    <div class="cfg-row nueva">
      <button id="d-export">Exportar todo (JSON)</button>
      <label class="btnfile">Importar JSON<input id="d-import" type="file" accept="application/json,.json" hidden /></label>
      <button id="d-demo" class="ghost">Cargar datos de ejemplo</button>
      <button id="d-reset" class="ghost danger">Borrar todo</button>
    </div>
    <p class="muted">Los datos viven solo en este navegador. Exporta de vez en cuando para tener copia o pasarlos a otro equipo.</p>`;
  p.querySelector('#q-save').onclick = () => {
    const ini = p.querySelector('#q-ini').value;
    const fin = p.querySelector('#q-fin').value;
    if (ini && fin && ini < fin) {
      DB.meta.cuatrimestre_inicio = ini;
      DB.meta.cuatrimestre_fin = fin;
      saveDB(); flash('✓ Rango del cuatrimestre guardado');
    } else flash('⚠ Revisa las fechas (inicio antes que fin)');
  };
  p.querySelector('#d-export').onclick = exportarJSON;
  p.querySelector('#d-import').onchange = importarJSON;
  p.querySelector('#d-demo').onclick = () => {
    if (confirm('¿Cargar datos de ejemplo? Se añaden a lo que ya tengas.')) cargarDemo();
  };
  p.querySelector('#d-reset').onclick = () => {
    if (confirm('¿Borrar TODOS los datos de este navegador? No se puede deshacer.')) {
      DB = seedMeta(DEFAULT_DB());
      saveDB(); flash('Todo borrado');
    }
  };
}

/* ============ Exportar / importar / demo ============ */

function exportarJSON() {
  const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `organizador-estudio-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

function importarJSON(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.asignaturas) || !Array.isArray(data.temas) || !Array.isArray(data.eventos)) {
        throw new Error('estructura');
      }
      if (!confirm('Esto reemplaza los datos actuales de este navegador. ¿Continuar?')) return;
      const base = DEFAULT_DB();
      DB = seedMeta(Object.assign(base, data, { meta: Object.assign(base.meta, data.meta || {}) }));
      DB.sin_clasificar = Array.isArray(DB.sin_clasificar) ? DB.sin_clasificar : [];
      cicloDiario();
      flash('✓ Datos importados');
    } catch (e) {
      flash('⚠ Archivo JSON no válido');
    }
  };
  reader.readAsText(file);
  ev.target.value = '';
}

function cargarDemo() {
  const conta = { id: uid(), nombre: 'Contabilidad', alias: ['conta'] };
  const esta = { id: uid(), nombre: 'Estadística', alias: ['esta', 'stats', 'estadistica'] };
  const org = { id: uid(), nombre: 'Comportamiento organizacional', alias: ['organizacional', 'orga', 'cco'] };
  DB.asignaturas.push(conta, esta, org);

  const addTema = (a, n, dif, dias) => DB.temas.push({
    id: uid(), asignatura_id: a.id, nombre: n,
    fecha_ultimo_repaso: isoDate(addDays(today(), -dias)),
    dificultad: dif, dias_evitado_consecutivos: 0
  });
  addTema(conta, 'Asientos y libro diario', 'cuesta_arriba', 12);
  addTema(conta, 'Amortizaciones', 'cuesta_arriba', 26);
  addTema(esta, 'Distribución normal', 'repaso_rapido', 4);
  addTema(esta, 'Contraste de hipótesis', 'cuesta_arriba', 18);
  addTema(org, 'Motivación y liderazgo', 'repaso_rapido', 9);
  addTema(org, 'Cultura organizacional', 'repaso_rapido', 2);

  DB.eventos.push(
    { id: uid(), asignatura_id: conta.id, tipo: 'examen', fecha: isoDate(addDays(today(), 12)), temas_relacionados: [], texto_original: 'examen de conta el ' + formatDMY(isoDate(addDays(today(), 12))) },
    { id: uid(), asignatura_id: esta.id, tipo: 'examen', fecha: isoDate(addDays(today(), 14)), temas_relacionados: [], texto_original: 'parcial de estadística' },
    { id: uid(), asignatura_id: org.id, tipo: 'entrega', fecha: isoDate(addDays(today(), 13)), temas_relacionados: [], texto_original: 'entrega trabajo organizacional' }
  );
  DB.meta.sugerencia = null;
  cicloDiario();
  flash('✓ Datos de ejemplo cargados');
}

/* ============ Arranque ============ */

document.getElementById('captura-form').addEventListener('submit', e => {
  e.preventDefault();
  const input = document.getElementById('captura-input');
  capturar(input.value);
  input.value = '';
  input.focus();
});

document.getElementById('cal-prev').addEventListener('click', () => cambiarMes(-1));
document.getElementById('cal-next').addEventListener('click', () => cambiarMes(1));
document.getElementById('cal-hoy').addEventListener('click', () => { calCursor = today(); renderCalendario(); });

cicloDiario();
render();
