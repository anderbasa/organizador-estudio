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

1. **Bandeja de captura** (fija arriba). Escribe frases libres y pulsa Enter:
   - `examen de contabilidad el 14`
   - `entrega del trabajo de organizacional el viernes`
   - `repasar tema 3 de estadística`
   El clasificador local detecta fecha, tipo (examen/entrega) y asignatura. Si no
   lo tiene claro, la entrada **no se pierde**: cae en *Sin clasificar* y la
   corriges en dos clics.
2. **Radar de colisiones.** Próximas 10 semanas; en rojo las que juntan 2+ eventos.
3. **Mapa de calor del cuatrimestre.** Una celda por semana; el color es la carga
   (eventos + deuda de estudio acumulada). La deuda de semanas pasadas es una
   estimación a partir del último repaso de cada tema.
4. **Qué tocar hoy.** Mezcla temas que "cuestan arriba" con otros de "repaso
   rápido" para no proponer siempre lo más pesado.
5. **Deuda de estudio.** Lista ordenada por urgencia, con etiqueta de dificultad
   (editable) y contador de días evitados (dato neutro, sin regañina).

Debajo, en secciones plegables: **Asignaturas** (con alias para el clasificador),
**Temas**, **Eventos** y **Datos** (exportar / importar JSON, datos de ejemplo,
rango del cuatrimestre, borrar todo).

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

## Copia de seguridad

Los datos son locales a cada navegador. Usa **Datos → Exportar todo (JSON)** para
guardar una copia, y **Importar JSON** para restaurarla o moverla a otro equipo.

## Modelo de datos

`localStorage` bajo la clave `organizador_estudio_v1`:

- `asignaturas`: `{ id, nombre, alias[] }`
- `eventos`: `{ id, asignatura_id, tipo: "examen"|"entrega", fecha, temas_relacionados[], texto_original }`
- `temas`: `{ id, asignatura_id, nombre, fecha_ultimo_repaso, dificultad: "cuesta_arriba"|"repaso_rapido", dias_evitado_consecutivos }`
- `sin_clasificar`: `{ id, texto_original, asignatura_id, tipo, fecha }`
- `meta`: `{ cuatrimestre_inicio, cuatrimestre_fin, sugerencia }`

## Fuera de esta versión

Sin sincronización entre dispositivos, sin login, sin llamadas a IA, sin PWA, sin
exportar a `.ics`, sin notificaciones push, sin atajos de teclado.
