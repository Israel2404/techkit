# Reporte de avance — Sesión 2

| | |
|---|---|
| **Proyecto** | TechKit — DevToolbox + Generador de comandos + Bitácora técnica |
| **Alumno** | Pedro Israel García García |
| **Carrera** | Ingeniería en Informática — ITESI |
| **Tecnologías** | HTML5, CSS3 y JavaScript puro (Vanilla JS), sin frameworks ni librerías |
| **Sesión** | 2 de 3 |
| **Fecha** | 16 de noviembre de 2026 |

---

## 1. Objetivo de la sesión

Agregar a TechKit un **tercer módulo, el Generador de comandos**, para ahorrar tiempo al trabajar en la terminal de Linux y con Docker. También hacer más útil la **Bitácora técnica** agregando plantillas de incidentes, gráficas y ordenamiento.

## 2. Resumen de lo realizado

| Actividad | Estado |
|---|---|
| Generador de expresiones **cron** con explicación en español y próximas ejecuciones | ✅ |
| Calculadora de permisos **chmod** (numérico ↔ simbólico, permisos especiales) | ✅ |
| Generador de comandos **docker run** con presets y validación | ✅ |
| Generador de comandos **tar** (crear, extraer, listar) | ✅ |
| Botón Copiar en cada comando y nueva sección "Comandos" en el menú | ✅ |
| **Plantillas** de incidentes en la Bitácora | ✅ |
| **Gráficas** con Canvas: barras por categoría y dona de abiertos vs resueltos | ✅ |
| **Ordenamiento** de la lista de incidentes | ✅ |
| Documentación (`README.md`) y plan (`PLAN-SESIONES.md`) actualizados | ✅ |

**Resultado:** todas las tareas planeadas para la sesión 2 quedaron terminadas y probadas.

---

## 3. Archivos de la sesión

| Archivo | Tipo | Descripción |
|---|---|---|
| `js/comandos.js` | **Nuevo** | Módulo Generador de comandos: cron, chmod, docker run y tar |
| `js/charts.js` | **Nuevo** | Gráficas de barras y de dona dibujadas con Canvas 2D |
| `js/bitacora.js` | Modificado | Plantillas, ordenamiento y conexión con las gráficas |
| `js/app.js` | Modificado | Registro de las nuevas rutas y evento de cambio de tema |
| `index.html` | Modificado | Nueva sección "Comandos" en el menú y carga de los scripts nuevos |
| `css/styles.css` | Modificado | Estilos de la tabla de permisos, la rejilla de cron, las gráficas y el tooltip |

**Estructura actual del proyecto**

```
techkit/
├── index.html
├── README.md
├── PLAN-SESIONES.md
├── css/
│   └── styles.css
└── js/
    ├── utils.js
    ├── tools.js
    ├── comandos.js      ← nuevo (sesión 2)
    ├── charts.js        ← nuevo (sesión 2)
    ├── db.js
    ├── bitacora.js
    └── app.js
```

**Integración con la arquitectura existente.** El módulo nuevo sigue el mismo patrón que las herramientas de la sesión 1: cada pantalla es un objeto `{ title, desc, html(), mount(root) }`. Por eso solo fue necesario registrarlo en el router, sin modificar ninguna herramienta anterior:

```js
const ROUTES = { ...Tools, ...Comandos, bitacora: Bitacora };
```

---

## 4. Desarrollo y funcionamiento

### 4.1 Generador de cron

**Para qué sirve:** cron es el programador de tareas de Linux. Su sintaxis de 5 campos (`minuto hora día mes día-semana`) es difícil de leer, y esta herramienta la arma y la explica.

**Funcionamiento:**
- Se puede llenar campo por campo, elegir una plantilla o pegar una expresión. Los campos y la expresión se mantienen sincronizados en ambos sentidos.
- Acepta valores (`5`), rangos (`1-5`), pasos (`*/15`), listas (`0,30`), nombres (`mon-fri`, `jan`) y macros (`@daily`, `@reboot`).
- Muestra la **explicación en español**, la **línea para `crontab -e`** con el comando y las **próximas 5 fechas de ejecución**.
- Si un valor está fuera de rango, muestra el error y marca el campo en rojo.

**Bloque principal: parser de campos.** Cada campo se convierte en un conjunto (`Set`) con todos los valores que acepta:

```js
const m = parte.match(/^(\*|(\d+)(?:-(\d+))?)(?:\/(\d+))?$/);
// ...
for (let v = ini; v <= fin; v += paso) valores.add(v);
```

Para las **próximas ejecuciones**, el programa avanza minuto a minuto desde la hora actual y revisa si cada fecha pertenece a los cinco conjuntos. Respeta la regla de cron según la cual, si se restringen *día del mes* y *día de la semana*, basta con que se cumpla uno.

| Expresión | Explicación generada |
|---|---|
| `0 8 * * 1-5` | A las 8:00, de lunes a viernes |
| `*/15 * * * *` | Cada 15 minutos |
| `30 2 * * 0` | A las 2:30, los domingos |
| `0 9,13,18 * * *` | A las 9:00, 13:00 y 18:00, todos los días |
| `0 0 1,15 * *` | A las 0:00, los días 1 y 15 del mes |

### 4.2 Calculadora chmod

**Para qué sirve:** calcular permisos de archivos en Linux sin hacer la suma a mano.

**Funcionamiento:**
- Tabla de checkboxes (lectura, escritura y ejecución para propietario, grupo y otros), número octal y texto simbólico. **Los tres se sincronizan:** si cambias uno, los demás se actualizan.
- Permisos especiales **SUID (4), SGID (2) y Sticky (1)**, que agregan un cuarto dígito (`4755`, `1777`) y cambian la `x` por `s` o `t`.
- Presets comunes (644, 755, 600, 700, 775, 777, 1777), opción recursiva `-R`, vista como en `ls -l` y explicación en español.
- Advertencia de seguridad cuando "otros" tienen permiso de escritura.

**Bloque principal: operaciones a nivel de bits.** Cada permiso vale un bit (r = 4, w = 2, x = 1). Sumarlos da el dígito, y para regresar del dígito a los checkboxes se usa el operador AND (`&`):

```js
checkbox.checked = (digito & valor) !== 0;
// 5 & 4 = 4 → lectura: sí
// 5 & 2 = 0 → escritura: no
// 5 & 1 = 1 → ejecución: sí
```

### 4.3 Generador docker run

**Para qué sirve:** armar el comando para levantar un contenedor sin recordar cada opción.

**Funcionamiento:**
- Campos para imagen, tag, nombre, política de reinicio, `-d`, `--rm`, `-it`, puertos, volúmenes, variables de entorno, red y comando inicial.
- **Presets** de nginx, MySQL, PostgreSQL, Redis y Ubuntu.
- Salida en una línea o multilínea (con `\`), y una tabla que explica cada parte.
- **Validaciones:** puertos de 1 a 65535 en formato `host:contenedor`, volúmenes con destino en ruta absoluta, variables en formato `CLAVE=valor` y combinaciones incompatibles como `--rm` con `--restart`.

**Bloque principal: lista de fragmentos con explicación.** Cada opción se guarda como `[fragmento, explicación]`. Con la misma lista se arma el comando y la tabla, así nunca quedan desfasados:

```js
partes.push([`-p ${p}`, `Puerto ${host} de tu PC → puerto ${contenedor} del contenedor`]);
// ...
salida = 'docker run ' + partes.map(p => p[0]).join(' ');
```

### 4.4 Generador tar

**Para qué sirve:** comprimir, extraer o listar archivos `.tar` sin memorizar las letras.

**Funcionamiento:**
- Operación (crear, extraer o listar) y compresión (ninguna, gzip, bzip2 o xz). **La extensión del archivo se ajusta sola** (`.tar.gz`, `.tar.bz2`, `.tar.xz`).
- Archivos a incluir, exclusiones (`--exclude`), carpeta destino (`-C`) y opción de agregar la fecha al nombre con `$(date +%F)`.
- Tabla que explica cada letra del comando (`c` crear, `z` gzip, `v` mostrar archivos, `f` nombre del archivo).

**Bloque de seguridad compartido: escapado para el shell.** Los valores con espacios o caracteres especiales se envuelven en comillas simples, para que el comando copiado funcione tal cual en la terminal:

```js
const q = (v) => /^[\w@%+=:,./-]+$/.test(v) ? v : `'${v.replace(/'/g, `'\\''`)}'`;
```

### 4.5 Mejoras a la Bitácora

**a) Plantillas de incidentes.** Al crear un incidente se puede elegir *Sin red*, *Impresora*, *Usuario bloqueado*, *Equipo lento* o *Disco lleno*. La plantilla llena el título, la categoría, la prioridad, el problema, la causa con los puntos a revisar, la solución con los comandos típicos y las etiquetas. **No modifica el cliente ni la fecha.** Los botones llevan `type="button"` para que no cierren el `<dialog>` del formulario.

**b) Gráficas con Canvas 2D (`charts.js`), sin librerías:**
- **Barras horizontales:** incidentes por categoría, ordenadas de mayor a menor. Se eligieron horizontales para que los nombres de categoría no se encimen.
- **Dona:** abiertos vs resueltos, con el total al centro y la leyenda con porcentajes.
- **Tooltip** al pasar el mouse. Cada barra o segmento guarda una zona de detección, y en la dona se compara el ángulo del cursor con `Math.atan2`.
- **Nitidez en pantallas HiDPI:** el canvas se dibuja a `ancho × devicePixelRatio` y se escala con `setTransform`.
- **Integración:** las gráficas reflejan los filtros activos y se redibujan al cambiar el tema (con un evento propio `themechange`) o el tamaño de la ventana.

```js
const ratio = window.devicePixelRatio || 1;
canvas.width = ancho * ratio;
ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
```

**c) Ordenamiento.** Opciones: más recientes, más antiguos, prioridad (alta primero), abiertos primero y título A-Z. Se usa un mapa de funciones comparadoras sobre una **copia** de la lista, para no alterar los datos. La exportación a Markdown respeta el orden elegido.

```js
const peso = { alta: 0, media: 1, baja: 2 };
prioridad: (a, b) => peso[a.prioridad] - peso[b.prioridad] || porFecha(a, b)
```

---

## 5. Bloques y APIs utilizados en esta sesión

| Bloque / API | Dónde se usa |
|---|---|
| Expresiones regulares y `Set` | Parser de cron |
| Operadores a nivel de bits (`&`, `\|`) | chmod y permisos especiales |
| Objeto `Date` e `Intl` (`toLocaleString('es-MX')`) | Próximas ejecuciones de cron |
| Canvas 2D (`arc`, `arcTo`, `fillText`, `measureText`) | Gráficas de la Bitácora |
| `devicePixelRatio` y `setTransform` | Gráficas nítidas en pantallas HiDPI |
| `getComputedStyle` | Leer los colores del tema desde las variables CSS |
| `Event` / `dispatchEvent` | Avisar a las gráficas que cambió el tema |
| Eventos `input`, `change`, `mousemove`, `resize` | Actualización en vivo, tooltips y redibujado |
| Delegación de eventos con `data-*` | Presets, plantillas y botones de copiar |
| Clipboard API | Botones de copiar |

---

## 6. Pruebas realizadas

Todas las pruebas se ejecutaron en el navegador sobre la aplicación completa.

| # | Prueba | Resultado esperado | Resultado |
|---|---|---|---|
| 1 | Cron `0 8 * * 1-5` | "A las 8:00, de lunes a viernes" y 5 fechas entre semana | ✅ |
| 2 | Cron `61 * * * *` | Error "fuera de rango (0-59)" y campo en rojo | ✅ |
| 3 | Cron `* * *` | Error "Se esperan 5 campos y hay 3" | ✅ |
| 4 | Cambiar el campo Hora a 22 | La expresión cambia a `0 22 * * 1-5` | ✅ |
| 5 | Cron `@reboot` | "Una vez, cada vez que el sistema arranca" | ✅ |
| 6 | chmod rwx / r-x / r-x | `755` y `rwxr-xr-x` | ✅ |
| 7 | Escribir `750` en octal | Checkboxes correctos y `rwxr-x---` | ✅ |
| 8 | Escribir `rwsr-xr-x` | `4755` (SUID activado) | ✅ |
| 9 | Preset `1777` | `rwxrwxrwt` y aviso de seguridad | ✅ |
| 10 | Octal inválido `9` | Campo marcado en rojo | ✅ |
| 11 | docker: nginx, puerto 8080:80, `-d` | `docker run -d -p 8080:80 nginx` | ✅ |
| 12 | Preset MySQL en multilínea | Comando completo con `--restart`, `-v` y `-e` | ✅ |
| 13 | docker: puerto `99999:80` | Error "Puerto inválido" | ✅ |
| 14 | tar con gzip | `tar -czvf respaldo.tar.gz proyecto/ notas.txt` | ✅ |
| 15 | Cambiar compresión a xz | Nombre `respaldo.tar.xz` y bandera `J` | ✅ |
| 16 | tar extraer con destino | `tar -xJvf respaldo.tar.xz -C /srv/app` | ✅ |
| 17 | Plantilla "Sin red" | Categoría Redes y prioridad alta precargadas | ✅ |
| 18 | Al editar un incidente | Las plantillas no aparecen | ✅ |
| 19 | 3 incidentes de Redes | La barra de Redes marca 3 | ✅ |
| 20 | 4 abiertos y 2 resueltos | Dona con 67% y 33% | ✅ |
| 21 | Ordenar por prioridad | Primero los de prioridad alta | ✅ |
| 22 | Ordenar por título | Orden alfabético | ✅ |
| 23 | Bitácora vacía | Las gráficas se ocultan | ✅ |
| 24 | Cambiar a tema claro | Las gráficas se redibujan con los nuevos colores | ✅ |
| 25 | Vista en celular (390 px) | Todo en una columna, sin desbordes | ✅ |
| 26 | Consola del navegador | Sin errores | ✅ |

---

## 7. Problemas encontrados y solución

| Problema | Solución |
|---|---|
| Con 5 filtros en la misma fila, el texto de las listas desplegables de la Bitácora se cortaba ("Todos los estado…") | El buscador pasó a su propia fila y los 4 selectores quedaron debajo, en columnas iguales |
| En las tablas de "qué hace cada parte" de docker y tar, las opciones largas se encimaban con la explicación | Se creó un estilo propio (`.kv.parts`) con columnas proporcionales y salto de línea en el texto largo |
| En cron, días como `0` se explicaban como "los domingo" | Se separó la descripción: los días sueltos usan plural ("los domingos") y los rangos usan singular ("de lunes a viernes") |
| La explicación de cron decía "todos los días" incluso en tareas que corren cada pocos minutos | "Todos los días" solo se agrega cuando la tarea tiene una hora fija |
| En pantallas de alta densidad las gráficas se veían borrosas | El canvas se dibuja usando `devicePixelRatio` |
| Al cambiar de tema, las gráficas conservaban los colores anteriores | `app.js` lanza un evento `themechange` y la Bitácora redibuja las gráficas al recibirlo |

---

## 8. Evidencias

> Insertar aquí las capturas de pantalla de cada vista:

1. Cron con la explicación y las próximas ejecuciones
2. chmod con la tabla de permisos
3. docker run con un preset cargado
4. tar con la explicación de cada letra
5. Formulario de la Bitácora con una plantilla aplicada
6. Bitácora con las gráficas y la lista ordenada
7. Bitácora en tema claro

---

## 9. Conclusión

En esta sesión, TechKit pasó de ser una caja de herramientas a cubrir también el trabajo diario en la terminal. El generador de comandos **evita memorizar sintaxis y reduce errores**, porque valida lo que escribes y explica cada parte del comando, lo que también lo hace útil para aprender. Las mejoras a la Bitácora permiten **registrar incidentes más rápido** con las plantillas y **ver de un vistazo** qué tipo de fallas son más frecuentes.

Gracias a la arquitectura de módulos de la sesión 1, el nuevo módulo se integró **sin modificar ninguna herramienta existente**. Todo se construyó con JavaScript puro, incluyendo las gráficas, que se dibujaron desde cero con Canvas.

## 10. Siguiente sesión (3 de 3)

- Convertir TechKit en **PWA**: `manifest.json` y Service Worker para instalarla y usarla sin internet.
- **Adjuntar capturas de pantalla** a los incidentes (como `Blob` en IndexedDB).
- Revisión con Lighthouse y pruebas en varios navegadores.
- **Publicación con HTTPS** y documentación final.
