# Matrícula

Tu cuatrimestre bajo control, como app en la pantalla de inicio del iPhone:
exámenes y entregas, repaso espaciado, plan hasta cada examen, modo
concentración y calculadora de nota. Antes se llamaba "Organizador de estudio".

**Web:** https://anderbasa.github.io/organizador-estudio/ (es también la URL
de la pegatina NFC).

## Pestañas

- **Hoy**: captura en texto libre (“examen de conta el 14 a las 10”,
  “entrega de organizacional el viernes”, “repasar tema 3 de estadística”),
  cuenta atrás del próximo examen, **Para hoy** (lo del plan de cada examen +
  los temas cuyo repaso ha vencido, alternando duros y ligeros; desliza a la
  derecha para marcar como repasado), “¿Qué tal te fue?” para apuntar notas,
  lo que quedó “Sin clasificar” y la semana.
- **Calendario**: mes con los exámenes y entregas en el color de cada
  asignatura, filtro por asignatura, próximos y carga del cuatrimestre.
- **Foco**: temporizador (15/25/45/60 min) ligado a una asignatura y un tema;
  al terminar pregunta qué tal el repaso y suma los minutos. Estadísticas de
  la semana.
- **Asignaturas**: cada una con sus exámenes, el **plan día a día** hasta el
  próximo examen, sus **temas** con repaso espaciado (vuelven a los 1, 3, 7,
  14, 30 y 60 días según “Me costó / Bien / Fácil”), la **calculadora de
  nota** (partes con peso y nota → nota actual y lo que necesitas para
  aprobado/notable/sobresaliente/MH) y sus ajustes (alias, color, archivar).
- **Ajustes**: estado de la sincronización, cuatrimestre, duraciones, nota
  para aprobar, días de plan, exportar a Calendario (`.ics` con avisos) y
  copia de seguridad (JSON).

## Datos

En **Firestore** (proyecto de Firebase `matricula-ander`, plan gratuito), con
caché en el dispositivo: funciona sin conexión y sincroniza al volver la red.
Así lo que se captura en Safari por NFC y lo de la app de pantalla de inicio
es lo mismo (en iPhone no comparten almacenamiento local).

- Colecciones `asignaturas`, `eventos`, `temas`, `sin_clasificar`, `sesiones`
  (un documento por elemento) y el documento `meta/principal`.
- Sin cuentas (como Control de gastos): las reglas de `firestore.rules`
  limitan colecciones, ids y tamaño. Para publicarlas:
  `firebase deploy --only firestore:rules --project matricula-ander`.
- Al abrir la nueva versión en un navegador que tenga datos del organizador
  antiguo (`localStorage` `organizador_estudio_v1`), se suben solos a la nube
  sin duplicar ni pisar nada.

## Instalar en el iPhone

Safari → Compartir → **Añadir a pantalla de inicio**. Icono, pantallas de
carga (claro/oscuro) y barra de estado van en `docs/index.html` y
`docs/manifest.webmanifest`.

## Desarrollo

Estático, sin build: HTML + CSS + módulos JS en `docs/` (GitHub Pages sirve
esa carpeta desde `main`). Para probar en local sirve `docs/` con cualquier
servidor estático. `docs/sw.js` cachea la app para usarla sin conexión: si
añades un archivo, añádelo a su lista y sube `CACHE`.

Iconos y pantallas de carga: `node herramientas/servidor.js`, abrir
`http://localhost:4193/generar-iconos.html` y en la consola
`await exportarTodo()`. Si cambian, sube el `?v=` de sus URLs (iOS cachea el
icono por URL).
