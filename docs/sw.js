// Service worker de Matrícula.
// - Archivos propios: primero la red (la app de pantalla de inicio coge
//   siempre la última versión) y, sin conexión, la copia guardada.
// - SDK de Firebase y fuentes: URLs con versión que no cambian, así que
//   primero la caché (y así la app arranca también sin conexión).
const CACHE = "matricula-v1";
const PROPIOS = [
  "./", "./index.html", "./manifest.webmanifest", "./css/estilo.css",
  "./js/app.js", "./js/captura.js", "./js/clasificador.js", "./js/config.js", "./js/datos.js",
  "./js/estudio.js", "./js/exportar.js", "./js/fechas.js", "./js/fichas.js", "./js/navegacion.js",
  "./js/nube.js", "./js/ui.js",
  "./js/vistas/hoy.js", "./js/vistas/calendario.js", "./js/vistas/foco.js", "./js/vistas/asignaturas.js", "./js/vistas/ajustes.js",
  "./icons/sello.png", "./icons/apple-touch-icon.png", "./icons/icon-192.png", "./icons/favicon.png",
];
const EXTERNOS = [
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js",
];
const INMUTABLES = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|fonts\.gstatic\.com\/)/;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(async (c) => {
    await c.addAll(PROPIOS);
    await Promise.all(EXTERNOS.map((u) => c.add(new Request(u, { mode: "cors" })).catch(() => {})));
  }));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req, { cache: "no-store" })
        .then((r) => { if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); } return r; })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("./index.html")))
    );
    return;
  }
  if (INMUTABLES.test(req.url)) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((resp) => {
      if (resp.ok || resp.type === "opaque") { const copia = resp.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
      return resp;
    })));
    return;
  }
  if (url.hostname === "fonts.googleapis.com") {
    // la hoja de estilos de la fuente: red y, sin conexión, la guardada
    e.respondWith(fetch(req).then((resp) => { const copia = resp.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); return resp; })
      .catch(() => caches.match(req)));
  }
  // Firestore (googleapis) va siempre directo: tiene su propia caché.
});
