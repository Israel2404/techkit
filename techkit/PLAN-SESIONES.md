# TechKit — Plan de desarrollo en 3 sesiones

**Proyecto:** TechKit (DevToolbox + Generador de comandos + Bitácora técnica)
**Tecnologías:** HTML5, CSS3 y JavaScript puro (Vanilla JS), sin frameworks
**Alumno:** Israel · Ingeniería en Informática · ITESI

---

## Resumen general

| Sesión | Enfoque | Estado |
|---|---|---|
| **1** | Base de la app, 8 herramientas del DevToolbox y Bitácora con IndexedDB | ✅ Terminada |
| **2** | Generador de comandos, plantillas, gráficas y orden en la Bitácora | ✅ Terminada |
| **3** | PWA (instalable y offline), adjuntos, Lighthouse y entrega final | ✅ Terminada |

---

## Sesión 1 — Base del sistema ✅ TERMINADA

**Fecha:** 9 de noviembre de 2026

### Objetivo
Construir la estructura de la aplicación y dejar funcionando los dos módulos principales.

### Lo que se hizo
- [x] Estructura del proyecto (`index.html`, `css/`, `js/`)
- [x] Barra lateral de navegación y **router por hash** (`#/json`, `#/bitacora`, …)
- [x] Tema claro/oscuro guardado en `localStorage`
- [x] Diseño responsivo (PC y celular) y hoja de estilos para impresión
- [x] **DevToolbox**, con 8 herramientas:
  - [x] JSON: formatear, minificar y validar
  - [x] Base64 / URL: codificar y decodificar con soporte UTF-8
  - [x] Decodificar JWT con revisión de expiración
  - [x] Hash SHA-1/256/384/512 con Web Crypto API
  - [x] UUID v7 (ordenado por tiempo) y v4, con inspector de fecha
  - [x] Contraseñas: varias a la vez (una por usuario), fortaleza y exportación CSV
  - [x] Conversor de timestamp
  - [x] Probador de Regex con resaltado en vivo
- [x] **Bitácora técnica:**
  - [x] CRUD de incidentes en **IndexedDB**
  - [x] Búsqueda, filtros por estado, prioridad y categoría, y estadísticas
  - [x] Exportar a Markdown, respaldo e importación JSON, imprimir a PDF
- [x] Documentación (`README.md`) y pruebas de funcionamiento

### Archivos creados
`index.html`, `css/styles.css`, `js/utils.js`, `js/tools.js`, `js/db.js`, `js/bitacora.js`, `js/app.js`, `README.md`

### Bloques y APIs usados
Router por hash · delegación de eventos · escape XSS · `TextEncoder` · Web Crypto · IndexedDB con Promesas · `<dialog>` + `FormData` · Blob para descargas · `localStorage` · `@media print`

---

## Sesión 2 — Generador de comandos y mejoras a la Bitácora ✅ TERMINADA

**Fecha:** 16 de noviembre de 2026

### Objetivo
Agregar un tercer módulo que ahorre tiempo en terminal y hacer la Bitácora más útil con plantillas y gráficas.

### Lo que se hizo

#### A) Módulo nuevo: Generador de comandos (`js/comandos.js`)
- [x] **Cron:** 5 campos, plantillas rápidas, expresión editable en ambos sentidos, **explicación en español**, línea para crontab y **próximas 5 ejecuciones**. Acepta nombres (`mon-fri`) y macros (`@daily`, `@reboot`), y marca el campo con error.
- [x] **chmod:** tabla de checkboxes ↔ octal ↔ simbólico, permisos especiales (SUID, SGID, Sticky), presets, `-R`, vista `ls -l`, significado en español y aviso de seguridad con 777.
- [x] **docker run:** imagen, tag, nombre, reinicio, `-d`/`--rm`/`-it`, puertos, volúmenes, variables, red y comando. Incluye presets (nginx, mysql, postgres, redis, ubuntu), validación, modo multilínea y explicación de cada opción.
- [x] **tar:** crear, extraer o listar, con gzip, bzip2 o xz (la extensión se ajusta sola), exclusiones, destino `-C`, fecha automática en el nombre y explicación de cada letra.
- [x] Botón **Copiar** en cada comando generado
- [x] Sección "Comandos" en el menú y en `ROUTES`

#### B) Mejoras a la Bitácora
- [x] **Plantillas de incidente:** Sin red, Impresora, Usuario bloqueado, Equipo lento y Disco lleno.
- [x] **Gráficas dibujadas con Canvas, sin librerías** (`js/charts.js`):
  - [x] Barras con incidentes por categoría
  - [x] Dona con abiertos vs resueltos
  - [x] Tooltip al pasar el mouse, respetan los filtros y el tema claro/oscuro
- [x] **Ordenar:** más recientes, más antiguos, prioridad, abiertos primero y título A-Z

### Archivos nuevos o modificados
- Nuevos: `js/comandos.js`, `js/charts.js`
- Modificados: `index.html` (menú y scripts), `js/app.js` (rutas y evento de tema), `js/bitacora.js`, `css/styles.css`, `README.md`

### Bloques y APIs nuevos
- Canvas 2D API (`arc`, `arcTo`, `fillText`, `measureText`) y `devicePixelRatio`
- Operaciones a nivel de bits para chmod (`r=4, w=2, x=1`, AND `&`)
- Parser de cron con `Set` y Regex, y búsqueda de las próximas fechas
- Escapado de valores para el shell (comillas simples)
- Eventos `input` y `change` para actualizar en vivo, y evento `themechange` propio

### Criterios de aceptación
| Prueba | Resultado esperado | Resultado |
|---|---|---|
| chmod con rwx / r-x / r-x | `755` y `rwxr-xr-x` | ✅ |
| Escribir `644` en chmod | Se marcan los checkboxes correctos | ✅ |
| Cron `0 8 * * 1-5` | "A las 8:00, de lunes a viernes" | ✅ |
| docker: imagen `nginx`, puerto 8080:80 | `docker run -d -p 8080:80 nginx` | ✅ |
| Plantilla "Sin red" | Formulario precargado con categoría Redes | ✅ |
| Gráfica con 3 incidentes de Redes | La barra de Redes marca 3 | ✅ |

---

## Sesión 3 — PWA, adjuntos y entrega final ✅ TERMINADA

**Fecha:** 16 de noviembre de 2026

### Objetivo
Convertir TechKit en una app instalable que funcione sin internet, agregar capturas a la bitácora y cerrar el proyecto.

### Lo que se hizo

#### A) Progressive Web App
- [x] `manifest.json` con nombre, colores, íconos (192, 512 y maskable), `display: standalone` y accesos directos
- [x] `sw.js` (**Service Worker**) que guarda en caché los 17 archivos de la app al instalarse
- [x] Estrategia **cache-first** y respaldo a `index.html` cuando no hay internet
- [x] Botón **"Instalar app"** con `beforeinstallprompt`
- [x] Etiqueta **Sin conexión** y **aviso de versión nueva** con botón Actualizar
- [x] Instalabilidad verificada: 0 errores de manifest y de instalación

#### B) Adjuntos en la Bitácora
- [x] Capturas con elegir archivo, **arrastrar y soltar** o **pegar con Ctrl+V**
- [x] Imagen guardada como `Blob` en IndexedDB
- [x] Miniaturas en el formulario y en la tarjeta, y visor con botón Descargar
- [x] Límites: 2 MB por imagen y 5 por incidente, con mensaje de aviso
- [x] Respaldo JSON con imágenes (Base64) e importación que las reconstruye

#### C) Calidad y publicación
- [x] Auditoría **Lighthouse** en las 9 vistas principales: 100 en accesibilidad, buenas prácticas y SEO, y de 98 a 100 en rendimiento
- [x] Correcciones: `defer`, etiquetas accesibles y CLS
- [x] Pruebas en Chromium (PC y móvil emulado), sin internet y de actualización
- [ ] Pruebas manuales en Firefox y en un celular real (las hace el alumno)
- [x] Guía de **publicación con HTTPS** (GitHub Pages / Hostinger) en el README
- [ ] Publicar en GitHub Pages u Hostinger (lo hace el alumno con su cuenta)

#### D) Entrega final
- [x] `README.md` final completo
- [x] `REPORTE-SESION-3.md`
- [ ] Capturas de pantalla para la documentación (las toma el alumno)

### Criterios de aceptación
| Prueba | Resultado esperado | Resultado |
|---|---|---|
| Abrir la app, quitar internet y recargar | La app sigue funcionando | ✅ |
| Botón "Instalar app" | Se instala y abre en su propia ventana | ✅ (instalabilidad verificada) |
| Adjuntar una captura a un incidente | Se ve la miniatura y persiste al recargar | ✅ |
| Imagen de más de 2 MB | Muestra aviso y no la guarda | ✅ |
| Lighthouse | Sin errores críticos | ✅ |

---

## Estructura final

```
techkit/
├── index.html
├── manifest.json        ← Sesión 3 ✅
├── sw.js                ← Sesión 3 ✅
├── README.md
├── PLAN-SESIONES.md
├── img/                 ← Sesión 3 ✅ (íconos)
├── css/
│   └── styles.css
└── js/
    ├── utils.js
    ├── tools.js
    ├── comandos.js      ← Sesión 2 ✅
    ├── charts.js        ← Sesión 2 ✅
    ├── db.js
    ├── bitacora.js
    ├── app.js
    └── pwa.js           ← Sesión 3 ✅
```
