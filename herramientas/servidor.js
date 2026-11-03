// Regenerar el icono "Matrícula", el sello y las pantallas de carga de iOS:
//   node herramientas/servidor.js
//   abrir http://localhost:4193/generar-iconos.html y en la consola:
//     await exportarTodo()
// Sirve esta carpeta y acepta POST /guardar para escribir en ../docs/icons.
// Si cambian los iconos, sube el ?v= de sus URLs en docs/index.html y en el
// manifest: iOS cachea el icono por URL y no lo actualizaría.
const http = require("http");
const fs = require("fs");
const path = require("path");

const RAIZ = __dirname;
const DESTINO = path.join(__dirname, "..", "docs", "icons");
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".png": "image/png" };

http.createServer((req, res) => {
  if (req.method === "POST" && req.url.startsWith("/guardar")) {
    const nombre = new URL(req.url, "http://x").searchParams.get("nombre") || "";
    if (!/^[a-z0-9\-\/]+\.(png|jpg)$/i.test(nombre) || nombre.includes("..")) {
      res.writeHead(400); return res.end("nombre no valido");
    }
    let cuerpo = "";
    req.on("data", (c) => (cuerpo += c));
    req.on("end", () => {
      const destino = path.join(DESTINO, nombre);
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.writeFileSync(destino, Buffer.from(cuerpo.split(",").pop(), "base64"));
      res.writeHead(200); res.end("ok " + nombre);
    });
    return;
  }
  const ruta = path.join(RAIZ, decodeURIComponent(req.url.split("?")[0]));
  if (!ruta.startsWith(RAIZ) || !fs.existsSync(ruta) || fs.statSync(ruta).isDirectory()) {
    res.writeHead(404); return res.end();
  }
  res.writeHead(200, { "Content-Type": TIPOS[path.extname(ruta)] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(ruta).pipe(res);
}).listen(4193, () => console.log("listo en 4193"));
