# Organizador de estudio

Herramienta de una sola pantalla para no perder el hilo en un curso con varias
asignaturas a la vez: ver venir los exámenes antes de que se amontonen y saber
siempre qué tema tienes más abandonado.

- **Sin backend, sin cuentas, sin login.** Todos los datos se guardan en el
  navegador (`localStorage`).
- **Sin IA en tiempo real.** El clasificador de texto funciona solo con reglas.
- **No es una PWA.** Sin `manifest.json`, sin service worker. Página web normal.
- **HTML/CSS/JS estático.** Se sirve tal cual desde GitHub Pages.

## Uso

Todo ocurre en una sola pantalla, de arriba abajo:

1. **Barra superior**: bandeja de captura (fija arriba) + resumen ejecutivo
   (nº de asignaturas, próximo examen/entrega con hora si la tiene, temas muy
   atrasados, aviso si llevas tiempo sin exportar copia) + filtro rápido por
   asignatura (aparece solo si tienes 2 o más activas; afecta al calendario,
   "Próximos" y la deuda). Escribe frases libres y pulsa Enter:
   - `examen de contabilidad el 14 a las 10`
   - `entrega del trabajo de organizacional el viernes`
   - `repasar tema 3 de estadística`
   El clasificador local detecta fecha, hora (opcional), tipo (examen/entrega)
   y asignatura. Si no lo tiene claro, la entrada **no se pierde**: cae en
   *Sin clasificar* y la corriges en dos clics. Justo tras capturar, un botón
   **Deshacer** (unos segundos) revierte la última captura si te has
   equivocado.
2. **Calendario mensual** (pieza central). Cada examen/entrega aparece como una
   etiqueta de color en su día, con la hora en el detalle; los días con 2+
   eventos se resaltan como colisión. Clic en un día con eventos para ver el
   detalle; clic en un día vacío para empezar a capturar algo con esa fecha
   ya puesta.
3. **Qué tocar hoy** y **Deuda de estudio**, bajo el calendario.
4. En la columna lateral: **Próximos** (agenda cronológica de exámenes/entregas)
   y el **mapa de calor del cuatrimestre** (una celda por semana; el color es
   la carga — eventos + deuda de estudio acumulada).

Debajo, en secciones plegables: **Asignaturas** (con alias para el clasificador
y un botón para **archivarlas** al terminar el cuatrimestre — dejan de salir en
la captura y en la deuda, pero sus datos no se borran), **Temas**, **Eventos**
y **Datos** (exportar/importar JSON, exportar a Calendario en `.ics`, datos de
ejemplo, rango del cuatrimestre, borrar todo).

### Primer arranque

1. Abre la web.
2. En **Asignaturas**, añade tus asignaturas y sus alias (p. ej. `Contabilidad`
   con alias `conta`).
3. Empieza a capturar. O pulsa **Cargar datos de ejemplo** en *Datos* para ver
   cómo queda.

## Desarrollo local

No hay build. Abre `docs/index.html` en el navegador, o sirve la carpeta:

```bash
cd docs
python -m http.server 8000
# http://localhost:8000
```

## Desplegar en GitHub Pages

El sitio ya está listo en la carpeta `docs/`.

1. Crea un repositorio en GitHub y sube este proyecto:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/organizador-estudio.git
   git push -u origin main
   ```
2. En GitHub, entra en **Settings → Pages**.
3. En **Build and deployment → Source**, elige **Deploy from a branch**.
4. En **Branch**, selecciona `main` y la carpeta **`/docs`**. Pulsa **Save**.
5. Espera un minuto y recarga. Pages mostrará la URL pública
   (`https://TU_USUARIO.github.io/organizador-estudio/`).

No hay variables de entorno ni secretos. Cualquier cambio que hagas en `docs/` y
subas a `main` se publica solo.

## Copia de seguridad y calendario nativo

Los datos son locales a cada navegador. Usa **Datos → Exportar todo (JSON)** para
guardar una copia completa (y **Importar JSON** para restaurarla o moverla a otro
equipo) — si pasan 14 días sin exportar, el resumen de arriba te lo recuerda.

Además, **Datos → Exportar a Calendario (.ics)** genera un archivo con todos los
exámenes/entregas para importar en el Calendario de iPhone (o cualquier app de
calendario): así es esa app, con permisos de verdad, la que te avisa con
notificaciones — esta web nunca las manda (ver "Fuera de esta versión"). En
iPhone, el botón intenta abrir directamente el panel "Compartir → Añadir a
Calendario"; si el navegador no lo soporta, descarga el `.ics` normal.

## Modelo de datos

`localStorage` bajo la clave `organizador_estudio_v1`:

- `asignaturas`: `{ id, nombre, alias[], archivada? }` (`archivada: true` la
  oculta del clasificador, la deuda y la sugerencia diaria, sin borrar nada)
- `eventos`: `{ id, asignatura_id, tipo: "examen"|"entrega", fecha, hora, temas_relacionados[], texto_original }`
  (`hora` es opcional, formato `"HH:MM"`; se detecta del texto — "a las 10", "10:30",
  "16h", "a las 3 de la tarde" — o se añade a mano en *Eventos*)
- `temas`: `{ id, asignatura_id, nombre, fecha_ultimo_repaso, dificultad: "cuesta_arriba"|"repaso_rapido", dias_evitado_consecutivos }`
- `sin_clasificar`: `{ id, texto_original, asignatura_id, tipo, fecha, hora }`
- `meta`: `{ cuatrimestre_inicio, cuatrimestre_fin, sugerencia, ultima_exportacion }`

## Fuera de esta versión

Sin sincronización entre dispositivos, sin login, sin llamadas a IA, sin PWA, sin
notificaciones push propias (para eso está la exportación a `.ics`), sin atajos
de teclado.
