// Sincronización con Firestore.
//
// - Cada colección de datos.js es una colección de Firestore (un documento
//   por elemento, con el mismo id) y DB.meta es el documento meta/principal.
// - Caché persistente en el dispositivo: la app abre y funciona sin conexión;
//   lo que se cambie offline se sube solo al volver la red.
// - guardar() en datos.js llama a sincronizar(), que compara con lo último
//   que se sabe que hay en la nube y solo escribe lo que ha cambiado.
// - Los cambios de otro dispositivo (Safari por NFC, la app de inicio...)
//   llegan por onSnapshot y reemplazan la colección en memoria.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache,
  collection, doc, onSnapshot, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { FIREBASE_CONFIG } from "./config.js";
import { DB, COLECCIONES, alPersistir, notificar, normalizarTodo, estable } from "./datos.js";

const app = initializeApp(FIREBASE_CONFIG);
let db;
try {
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch (e) {
  console.warn("Sin caché persistente:", e);
  db = initializeFirestore(app, { localCache: memoryLocalCache() });
}

const TOTAL = COLECCIONES.length + 1;
const base = {};          // colección -> Map(id -> JSON) de lo que hay en la nube
let baseMeta = null;      // JSON de meta/principal en la nube
const recibido = new Set();
const delServidor = new Set();
const conPendientes = new Set();
let ultimoError = null;
const subidas = [];
let frenado = false;

const oyentesEstado = new Set();
export function alEstado(fn) { oyentesEstado.add(fn); return () => oyentesEstado.delete(fn); }
export function estado() {
  return {
    listo: recibido.size >= TOTAL,
    servidor: delServidor.size >= TOTAL,
    pendientes: conPendientes.size > 0,
    enLinea: navigator.onLine,
    error: ultimoError,
  };
}
const emitir = () => { const e = estado(); oyentesEstado.forEach((fn) => fn(e)); };
addEventListener("online", emitir);
addEventListener("offline", emitir);

function marcar(clave, meta) {
  recibido.add(clave);
  if (!meta.fromCache) delServidor.add(clave);
  if (meta.hasPendingWrites) conPendientes.add(clave); else conPendientes.delete(clave);
}

function iguales(a, b) {
  if (!a || a.size !== b.size) return false;
  for (const [k, v] of b) if (a.get(k) !== v) return false;
  return true;
}

function trasRecibir() {
  // datos de versiones anteriores o de otro dispositivo: completar campos
  if (normalizarTodo()) sincronizar();
  notificar();
}

// Resuelve cuando ya hay datos de todas las colecciones (aunque sean de la
// caché local) o, como mucho, a los 8 s, para no dejar la app colgada.
export function conectar() {
  return new Promise((resolve) => {
    let hecho = false;
    const quizaListo = () => { if (!hecho && recibido.size >= TOTAL) { hecho = true; resolve(); } };
    setTimeout(() => { if (!hecho) { hecho = true; resolve(); } }, 8000);

    for (const col of COLECCIONES) {
      onSnapshot(collection(db, col), { includeMetadataChanges: true }, (snap) => {
        marcar(col, snap.metadata);
        const items = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        const mapa = new Map(items.map((i) => [i.id, estable(i)]));
        if (!iguales(base[col], mapa)) {
          base[col] = mapa;
          DB[col] = items;
          trasRecibir();
        }
        emitir(); quizaListo();
      }, (err) => { ultimoError = err.message; recibido.add(col); emitir(); quizaListo(); });
    }

    onSnapshot(doc(db, "meta", "principal"), { includeMetadataChanges: true }, (snap) => {
      marcar("meta", snap.metadata);
      if (snap.exists()) {
        const json = estable(snap.data());
        if (json !== baseMeta) {
          baseMeta = json;
          DB.meta = snap.data();
          trasRecibir();
        }
      } else if (!snap.metadata.fromCache && baseMeta !== null) {
        // El servidor confirma que ya no existe (se borró) aunque lo teníamos:
        // volver a crearlo con lo que hay en memoria. Solo con dato del
        // servidor: una caché vacía no significa que no exista.
        baseMeta = null;
        sincronizar();
      }
      emitir(); quizaListo();
    }, (err) => { ultimoError = err.message; recibido.add("meta"); emitir(); quizaListo(); });
  });
}

export function esperarServidor() {
  return new Promise((res) => {
    if (estado().servidor) return res();
    const quitar = alEstado((e) => { if (e.servidor) { quitar(); res(); } });
  });
}

// Sube las diferencias entre DB y lo último conocido en la nube.
export function sincronizar() {
  const ops = [];
  for (const col of COLECCIONES) {
    const antes = base[col] || new Map(), ahora = new Map();
    for (const it of DB[col]) {
      const json = estable(it);
      ahora.set(it.id, json);
      if (antes.get(it.id) !== json) ops.push(["set", col, it.id, JSON.parse(json)]);
    }
    for (const id of antes.keys()) if (!ahora.has(id)) ops.push(["borrar", col, id]);
    base[col] = ahora;
  }
  const meta = estable(DB.meta);
  if (meta !== baseMeta) { ops.push(["set", "meta", "principal", JSON.parse(meta)]); baseMeta = meta; }
  if (!ops.length) return;

  // Freno de emergencia: si algún día un fallo provocase subidas en bucle,
  // pausar en vez de gastar la cuota gratuita de Firestore.
  const ahoraMs = Date.now();
  subidas.push(ahoraMs);
  while (subidas.length && ahoraMs - subidas[0] > 20000) subidas.shift();
  if (subidas.length > 40 || frenado) {
    frenado = true;
    ultimoError = "Demasiadas subidas seguidas: sincronización pausada. Cierra y vuelve a abrir la app.";
    emitir();
    return;
  }

  for (let i = 0; i < ops.length; i += 400) {
    const lote = writeBatch(db);
    for (const [op, col, id, datos] of ops.slice(i, i + 400)) {
      if (op === "set") lote.set(doc(db, col, id), datos); else lote.delete(doc(db, col, id));
    }
    lote.commit().catch((err) => { ultimoError = err.message; emitir(); console.error(err); });
  }
  emitir();
}

alPersistir(sincronizar);
