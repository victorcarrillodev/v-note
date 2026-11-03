# Plan 001 — Implementación del MVP de v-note

> Deriva de `specs/001-v-note-mvp/spec.md` (el **QUÉ**) y respeta `docs/constitution.md`. Este documento define el **CÓMO**: arquitectura, decisiones técnicas con su alternativa descartada, dependencias, estrategia de tests, hitos y trazabilidad. **No contiene código.**
> En cada sección, la línea **Cubre:** indica los RF/RNF/CL de la spec que esa parte satisface.

---

## 0. Aclaraciones previas

- **Sin contrato de CLI.** La spec no define ninguna CLI y el producto es una aplicación gráfica; por decisión de la persona usuaria esa sección se omite. La única "línea de comandos" que aparece es un **argumento interno** para que un atajo del sistema invoque la captura rápida (sección 5.8); no es una interfaz pública.
- **La spec manda** (constitución, art. 2). Donde este plan necesitó decidir algo que la spec no dice, queda marcado como **[DECISIÓN DEL PLAN]** y listado en la sección 14 para que se confirme o corrija.
- **El plan anterior** (`PLAN-CLON-NOTION.md`) quedó absorbido: el contenido de producto pasó a la spec y el contenido técnico pasa a este documento.

---

## 1. Resumen ejecutivo

| Aspecto | Decisión |
|---|---|
| Forma de la app | Una sola base de código TypeScript; **web (PWA)** y **escritorio (Tauri 2)** comparten interfaz y núcleo |
| Datos | **Un archivo SQLite por espacio de trabajo** + carpeta de adjuntos; en escritorio es un archivo nativo, en web vive en el almacenamiento privado del navegador |
| Documento | Cada página es un documento **Yjs**; de él se derivan texto de búsqueda, enlaces, tareas y formato de respaldo |
| Editor | **BlockNote** con bloques propios (diagrama, organizador, vista de base de datos, tarea, aviso, marcador web) |
| Núcleo | `packages/core`: TypeScript puro, sin React, DOM ni Tauri; define **puertos** que implementan los adaptadores de web y de Tauri |
| Respaldo | Cliente propio y ligero de la API Git de GitHub; un commit por ciclo, incremental, determinista; token en el llavero del sistema |
| Tareas en segundo plano | Un "tic" cada minuto emitido por la capa nativa; el núcleo decide qué toca (respaldo, recordatorios, purga de papelera) |
| Entrega | **Hito 0** (pruebas de viabilidad) y luego los **4 hitos** de la spec |

---

## 2. Arquitectura

### 2.1 Capas

```
┌──────────────────────────────────────────────────────────────┐
│ apps/web (PWA)                 apps/desktop (Tauri 2 + Rust) │  ← cascarones
├──────────────────────────────────────────────────────────────┤
│ packages/ui  — React, Tailwind, Radix, BlockNote, lienzos     │  ← presentación
├──────────────────────────────────────────────────────────────┤
│ packages/core — dominio puro (sin React / DOM / Tauri)        │  ← lógica
│   define PUERTOS (interfaces) que necesita del exterior        │
├───────────────────────────────┬──────────────────────────────┤
│ packages/adapters-web          │ packages/adapters-tauri       │  ← plataforma
│ SQLite WASM + OPFS, Web Locks, │ SQLite nativo, llavero, tray, │
│ Notification API, print        │ notificaciones, atajo global  │
└───────────────────────────────┴──────────────────────────────┘
```

**Cubre:** constitución art. 3; RF-19 (misma interfaz en web y escritorio), RNF-8.

### 2.2 Estructura del monorepo

| Carpeta | Contenido |
|---|---|
| `brand.config` (raíz) | Único lugar con el nombre del producto; lo leen la compilación, el identificador de la app, los títulos y el respaldo (art. 7) |
| `packages/core` | Páginas, jerarquía, papelera, enlaces, bases de datos, fórmulas, filtros, recurrencias, respaldo/restauración, importar/exportar (modelo de datos), migraciones |
| `packages/ui` | Árbol lateral, editor y bloques propios, vistas de base de datos, diagramas, organizadores, grafo, agenda, paleta de comandos, ajustes |
| `packages/adapters-web` / `adapters-tauri` | Implementaciones de los puertos para cada plataforma |
| `apps/web` | Cascarón PWA (service worker, manifiesto) |
| `apps/desktop` | Cascarón Tauri: ventanas, bandeja, comandos nativos en Rust |
| `tests/` | Pruebas de extremo a extremo, fixtures sintéticos y servidor GitHub falso |

Gestor de paquetes y *workspaces*: **Bun**. **[DECISIÓN DEL PLAN]** No se usa Turborepo (ver D-14).

### 2.3 Puertos (lo que el núcleo exige a la plataforma)

| Puerto | Función | Web | Escritorio |
|---|---|---|---|
| `SqlStore` | Abrir/cerrar la base de un espacio, ejecutar consultas y **transacciones** | SQLite WASM + OPFS | SQLite nativo (Rust) |
| `AssetStore` | Guardar/leer adjuntos por hash de contenido | OPFS | Carpeta del espacio |
| `Keychain` | Guardar/leer/borrar el token de GitHub | Solo memoria de la sesión | Llavero del sistema |
| `HttpTransport` | Llamadas a la API de GitHub | `fetch` | `fetch` (sin proxy) |
| `Clock` | Hora actual y zona horaria | Sistema | Sistema |
| `Ticker` | Evento periódico de 1 minuto y al reanudar | Temporizador de la pestaña | Temporizador **nativo** (Rust) |
| `Notifier` | Notificaciones y ventana de recordatorio | Notification API | Plugin de notificaciones + ventana propia |
| `ShortcutService` | Atajo global de captura | No disponible | Plugin de atajos globales + alternativas |
| `FolderPicker` / `DataLocation` | Elegir/mover la carpeta de datos | No aplica | Diálogo nativo + operaciones de archivos |
| `InstanceLock` | Un solo editor por espacio (CL-22) | Web Locks | Instancia única |
| `PrintToPdf` | Exportar a PDF | Impresión del navegador | Impresión nativa del webview |
| `Updater` | Actualizaciones | Service worker | Plugin de actualización |

**Cubre:** art. 3; RF-13, RF-14, RF-19, RF-22, RF-24, RF-25, CL-22.

### 2.4 Flujo de una edición (guardado automático)

1. La persona edita en BlockNote; el cambio se aplica al documento Yjs en memoria.
2. Cada actualización Yjs se escribe en la base en una **transacción** (registro de actualizaciones de la página).
3. Con *debounce*, el núcleo recalcula lo **derivado**: texto de búsqueda, enlaces/retroenlaces, tareas con fecha y vínculos de base de datos; todo en la misma transacción.
4. De forma periódica se **compactan** las actualizaciones en una instantánea.

**Cubre:** RF-3, RF-4, RF-5, RF-6, RF-11; RNF-4; art. 5.

---

## 3. Modelo de datos (conceptual)

Una base SQLite **por espacio de trabajo**. El esquema cambia solo con **migraciones versionadas** (art. 5).

| Tabla | Propósito | RF |
|---|---|---|
| `meta` | Versión de esquema, versión de formato de respaldo, ajustes del espacio | RF-21, RF-17 |
| `pages` | Id estable, padre, posición (índice fraccionario), título, ícono, portada, tipo (nota/tablero/base de datos), favorita, `deleted_at`, `deleted_root_id` | RF-1, RF-2 |
| `page_docs` | Instantánea + registro de actualizaciones Yjs por página | RF-3, RF-4 |
| `page_text` | Texto derivado para búsqueda + índice de texto completo | RF-5 |
| `links` | Enlaces página→página (origen, destino, bloque) | RF-6, RF-7 |
| `assets` | Metadatos del adjunto: hash, nombre, tipo, tamaño | RF-3, RF-15, CL-21 |
| `databases` | Definición de bases de datos | RF-8, RF-22 |
| `properties` | Propiedades por base de datos (tipo, configuración, fórmula) | RF-22 |
| `db_rows` | Pertenencia de una página a una base (una página puede estar en varias) | RF-22, CL-34 |
| `cell_values` | Valor por (base, página, propiedad) | RF-22 |
| `relations` | Vínculos entre filas de dos bases (bidireccional) | RF-22 |
| `views` | Vistas guardadas: tipo, filtros, orden, agrupación, columnas visibles | RF-22 |
| `tasks` | Índice **derivado** de casillas, tarjetas y filas con fecha | RF-11, RF-12 |
| `reminder_state` | Estado propio: disparado, pospuesto hasta, vencido, descartado | RF-11 |
| `backup_runs` | Historial de ejecuciones del respaldo y su resultado | RF-15, RF-16 |
| `quick_capture_draft` | Borrador de la captura rápida | RF-13 |
| `import_reports` | Informes de importación | RF-23 |

Fuera de la base del espacio, un **registro de espacios** (nombre, ubicación, bandera de "predeterminado para captura") vive en la carpeta de configuración de la aplicación. **No contiene secretos.**

**[DECISIÓN DEL PLAN]** Las tablas derivadas (`page_text`, `links`, `tasks`) se pueden reconstruir completas a partir de los documentos: es la reparación ante cualquier inconsistencia.

---

## 4. Decisiones técnicas justificadas

Cada decisión indica su **alternativa descartada** y los requisitos que la motivan.

| # | Decisión | Por qué | Alternativa descartada y razón | Cubre |
|---|---|---|---|---|
| D-1 | **Un archivo SQLite por espacio de trabajo** | Aísla espacios (RF-21), permite mover la carpeta completa (RF-25) y borrar/restaurar un espacio sin tocar otros | Una sola base con columna de espacio: mover/eliminar un espacio exigiría copiar/borrar filas y mezcla datos de contextos distintos | RF-21, RF-25, art. 5 |
| D-2 | **SQLite nativo (Rust) en escritorio y SQLite WASM + OPFS en web, con el mismo SQL y las mismas migraciones** | Una sola semántica de datos; el archivo nativo cumple "carpeta elegible" (RF-25) y rinde mejor con 50 000 filas | IndexedDB/Dexie: sin texto completo ni consultas relacionales; habría que reimplementar filtros, relaciones y rollups y mantener dos modelos | RF-5, RF-22, RF-25, RNF-11, art. 5 |
| D-3 | **Comandos propios de SQLite en Rust** (con transacciones explícitas, una conexión por espacio) | Control de transacciones y del cierre ordenado; archivo por espacio | Plugin SQL genérico de Tauri: orientado a un pool de conexiones, transacciones multi-sentencia incómodas y un solo archivo por configuración | RF-4, CL-17, CL-36 |
| D-4 | **SQLite WASM con el VFS "opfs-sahpool"** | No exige cabeceras de aislamiento de origen cruzado y obliga a un único escritor, lo que refuerza CL-22 | VFS "opfs" con SharedArrayBuffer: exige cabeceras COOP/COEP que complican el alojamiento estático | RF-18, CL-22 |
| D-5 | **Modo de escritura WAL con sincronización completa** | Cierres inesperados nunca corrompen; se pierde a lo sumo el último cambio en curso | Modo normal de sincronización: más rápido pero puede perder transacciones recientes tras un corte de luz | RF-4, RNF-4 |
| D-6 | **Documento por página en Yjs**; texto, enlaces, tareas y respaldo se **derivan** de él | Lo exige la constitución (art. 1); da deshacer/rehacer coherente y persistencia incremental | Guardar solo instantáneas JSON de BlockNote: más simple, pero cada cambio reescribe todo y el deshacer depende del editor | RF-3, RF-4 |
| D-7 | **Modelo canónico de bloques definido en el núcleo** y conversor puro entre el documento Yjs y ese modelo | El núcleo no puede importar BlockNote (depende de React/DOM, art. 3) y necesita leer el contenido para buscar, respaldar y exportar | Instanciar BlockNote sin interfaz dentro del núcleo: arrastra DOM y React al dominio y rompe el art. 3 | RF-5, RF-6, RF-15, RF-23, RF-24 |
| D-8 | **Diagramas y organizadores guardados como estructuras Yjs anidadas dentro del documento de la página** | Deshacer a nivel de elemento y escrituras incrementales; un diagrama de 500 elementos no reescribe un bloque entero en cada arrastre | JSON en una propiedad del bloque: cada movimiento reescribe todo el diagrama y el deshacer es tosco | RF-9, RF-10, RNF-3 |
| D-9 | **Lienzo de diagramas con React Flow (xyflow)** | Nodos, conectores que siguen a las formas, zoom y desplazamiento ya resueltos y accesibles | tldraw (licencia de producción restrictiva), Excalidraw (pizarra de trazo libre, conectores débiles), SVG propio (meses de trabajo) | RF-9, RNF-3 |
| D-10 | **Mapa mental y organigrama sobre el mismo lienzo, con disposición automática de árbol (d3-hierarchy)**; **línea de tiempo y matriz** como componentes propios | Reutiliza arrastrar/zoom y colapso de nodos; la línea de tiempo y la matriz no son grafos | elkjs (pesado) para la disposición; una librería distinta por cada organizador (cuatro dependencias para cuatro vistas) | RF-10 |
| D-11 | **Grafo de notas con d3-force dibujado en canvas** y vista local por defecto | Maneja miles de nodos sin saturar el DOM; coherente con d3-hierarchy | Cytoscape.js (más grande), Sigma/WebGL (requisitos de GPU innecesarios), SVG (se arrastra con >1 000 nodos) | RF-7, RNF-11 |
| D-12 | **Bases de datos: la página es la entidad y la fila es su pertenencia a una base** | Permite que una página esté en varias bases con valores propios (RF-22, CL-34) y que una tarjeta sea una página (RF-8) | Filas como entidad independiente de las páginas: contradice "cada tarjeta es una página" y obligaría a duplicar | RF-8, RF-22 |
| D-13 | **Motor de fórmulas propio**: analizador de expresiones + evaluador en el núcleo, grafo de dependencias y recálculo incremental en un *worker* | Sin `eval`, seguro, detecta ciclos al definir (CL-26) y controla mensajes de error en español | mathjs (grande, superficie de seguridad amplia), expr-eval (sin mantenimiento), jsep (solo analiza; falta evaluar) | RF-22, RNF-13, CL-26 |
| D-14 | **Sin Turborepo**; solo *workspaces* de Bun y scripts por paquete | Menos dependencias (art. 1); el volumen de paquetes no justifica caché de tareas | Turborepo/Nx: ayudan en monorepos grandes, no en 6 paquetes | art. 1 |
| D-15 | **Fechas con date-fns** | La suma de meses ya ajusta al último día del mes (CL-25) y es puro y probado | Aritmética propia con `Date` (errores clásicos); Temporal (no está en todos los webviews objetivo) | RF-11, CL-25, CL-32 |
| D-16 | **Hora de recordatorios "flotante"**: se guarda la hora local pretendida, sin zona | Al cambiar de zona horaria la hora seguirá siendo la prevista por la persona usuaria (CL-13) | Guardar un instante UTC fijo: el recordatorio de las 9:00 saltaría a otra hora local al viajar | RF-11, CL-13 |
| D-17 | **Un "tic" cada minuto emitido desde la capa nativa** y no temporizadores del webview | Una ventana oculta en la bandeja puede sufrir limitación de temporizadores; el tic nativo no | Confiar en `setInterval` del webview: riesgo de que recordatorios y respaldo se retrasen con la ventana oculta | RF-11, RF-15, RF-19 |
| D-18 | **Cerrar la ventana la oculta a la bandeja** (con opción "Salir" explícita) | Para que haya recordatorios y respaldo programado "con la app disponible en segundo plano" | Cerrar = salir: los recordatorios y el respaldo solo funcionarían con la ventana abierta | RF-11, RF-15 |
| D-19 | **Recordatorio = notificación del sistema + ventana propia pequeña** con Abrir / Hecho / Posponer | Las acciones en notificaciones de escritorio no son confiables en todos los sistemas; la ventana garantiza "abrir" y "posponer" | Solo notificación del sistema con botones: depende de cada entorno de escritorio | RF-11, RF-12, CL-14 |
| D-20 | **Respaldo con un cliente HTTP propio de la API Git de GitHub** (blobs, árboles, commits, referencias) | Funciona igual en web y escritorio, un commit atómico con muchos archivos, sin instalar Git | Octokit (dependencia grande para unos 8 endpoints); isomorphic-git (necesita proxy CORS en web); `git` nativo (solo escritorio) | RF-14, RF-15, RF-16 |
| D-21 | **Autenticación con token fino de un solo repositorio (permiso de contenido)** pegado por la persona | No requiere registrar aplicación ni servidor; funciona en web y escritorio | Flujo de dispositivo de GitHub: sin CORS desde navegador y requiere registrar una app | RF-14, RNF-6 |
| D-22 | **Token solo en el llavero del sistema; en web, solo en memoria de la sesión** | Cumple el art. 6; la web no tiene llavero, así que se pide al iniciar sesión | Guardarlo cifrado en el almacenamiento del navegador: queda legible por cualquier script del mismo origen y no es "llavero del sistema" | RF-14, RNF-6, art. 6 |
| D-23 | **Respaldo incremental comparando huellas Git calculadas localmente** con las del árbol remoto | Solo se suben archivos distintos y no se crea commit si el árbol es idéntico (RNF-7) | Subir todo cada vez: lento y con commits vacíos | RF-15, RNF-7 |
| D-24 | **Cada commit se crea encima de la cabeza remota; nunca se fuerza el empuje** | Nada se pierde si alguien escribió en el repositorio (CL-18); queda en el historial | Reemplazar la referencia a la fuerza: puede destruir versiones | RF-16, CL-18 |
| D-25 | **Adjuntos guardados por hash de contenido** | Evita nombres repetidos (CL-21), deduplica y da nombres deterministas al respaldo | Guardar por nombre original: colisiones y respaldos distintos para el mismo contenido | RF-3, RF-15, CL-21, RNF-7 |
| D-26 | **Búsqueda con el índice de texto completo de SQLite** sobre `page_text` | Rápido, sin servicio externo, con fragmentos resaltados y filtros por SQL | Índice en memoria (MiniSearch): reconstrucción al abrir y mayor memoria con 5 000 páginas | RF-5, RNF-1, RNF-11 |
| D-27 | **Orden de páginas y tarjetas con índices fraccionarios** | Reordenar toca una sola fila | Posiciones enteras consecutivas: reordenar reescribe cientos de filas | RF-1, RF-8, RNF-11 |
| D-28 | **Exportar HTML con el mismo renderizador de la interfaz** y PDF mediante impresión nativa del webview | Misma apariencia que en pantalla y texto seleccionable | Rasterizar (html2canvas + jsPDF): borroso y sin texto; navegador sin interfaz (Puppeteer): cientos de MB | RF-24 |
| D-29 | **Importar Markdown con unified/remark y ZIP con fflate; CSV con papaparse** | Analizadores probados que producen un árbol del que se generan los bloques canónicos | Analizadores propios (errores sutiles en Markdown y CSV) | RF-23 |
| D-30 | **Sanear todo HTML/Markdown pegado o importado con DOMPurify** y renderizar bajo una política de seguridad de contenido estricta | Nunca se ejecuta código del contenido (CL-24) | Confiar en el sanitizado interno del editor: no cubre importación ni HTML exportado | CL-24, RNF-5 |
| D-31 | **Cómputo pesado en *workers*** (fórmulas, grafo, importación, exportación, construcción del respaldo) | La interfaz no se bloquea y se puede cancelar (RNF-12) | Hilo principal con "ceder" periódico: se siente bien hasta que crece el dato | RNF-12, RNF-13 |
| D-32 | **Migración con copia previa** de la base antes de aplicar cambios de esquema | Si una migración falla, se conserva la versión anterior | Migrar "en caliente" sin copia | art. 5, RNF-4 |
| D-33 | **i18n con i18next**, español de México por defecto | Maduro, con pluralización y formatos de fecha | Soluciones de compilación (Lingui): más herramientas para un solo equipo | RF-20, RNF-10, art. 7 |
| D-34 | **PWA con vite-plugin-pwa** | Genera manifiesto y precaché sin escribir el service worker a mano | Service worker manual: más riesgo de errores de caché | RF-18, RF-19 |

---

## 5. Diseño por área funcional

### 5.1 Páginas, papelera y espacios de trabajo — RF-1, RF-2, RF-21, CL-1 a CL-6, CL-29, CL-33

- Árbol de páginas con `parent_id` + posición fraccionaria. **Mover** valida con una consulta recursiva que el destino no sea descendiente (CL-4); **eliminar** marca la página y sus descendientes con `deleted_at` y `deleted_root_id` (restaurar vuelve al padre original o a la raíz si ya no existe).
- **Purga**: en cada inicio y una vez al día el tic ejecuta el borrado definitivo de elementos con más de 30 días (CL-33); la interfaz calcula los días restantes.
- **Duplicar** copia el documento Yjs y, si se pide, las hijas; se generan identificadores nuevos y se **remapean** enlaces internos entre las copias.
- **Espacios**: crear, renombrar, cambiar y eliminar; la eliminación exige escribir el nombre y muestra el último respaldo exitoso o una advertencia si no hay (CL-29). Cada espacio tiene su propia base, papelera, bandeja, recordatorios y configuración de respaldo. Búsqueda, enlaces y grafo consultan **una sola base**, por lo que no cruzan espacios.
- Títulos repetidos o vacíos se permiten (CL-1 a CL-3); la identidad es el id.

### 5.2 Editor — RF-3, RF-4, CL-24

- BlockNote con los bloques de RF-3. Bloques **propios**: tarea con fecha (comportamiento de casilla + fecha/recordatorio), aviso destacado, marcador web, diagrama, organizador y vista de base de datos.
- Menú `/`, atajos de Markdown, barra de formato, arrastre y sangría vienen de BlockNote; **color y resaltado** se configuran en su esquema de estilos.
- Deshacer/rehacer con el gestor de deshacer de Yjs, que persiste mientras la sesión esté abierta.
- Guardado automático según 2.4. Adjuntos: se copian al almacén por hash; al adjuntar un archivo mayor a **100 MB** (límite individual de GitHub) se muestra la advertencia de que no se respaldará.
- Pegado: se sanea (D-30).

### 5.3 Búsqueda y paleta — RF-5

- Tabla `page_text` + índice de texto completo (título, contenido, valores de bases de datos y etiquetas de diagramas).
- La paleta (con `cmdk`) muestra recientes si no hay texto, filtra por espacio, tipo y fecha, resalta con fragmentos y excluye la papelera salvo petición.
- Acciones de la paleta: se registran en un catálogo para poder asignarles atajos (RF-20).

### 5.4 Enlaces y grafo — RF-6, RF-7, CL-5, CL-6

- Menciones como contenido en línea que guarda el **id** del destino; el título se resuelve al mostrar, por lo que renombrar no rompe nada.
- `links` se recalcula al guardar; los retroenlaces son una consulta inversa. Un enlace a una página en papelera se muestra roto con acción para restaurar.
- Grafo: vista **local** (página actual y vecinas) por defecto, filtros y selección con resaltado; con 0 enlaces muestra la guía. Ciclos permitidos: el motor de fuerzas no depende de que el grafo sea acíclico.

### 5.5 Bases de datos y tableros — RF-8, RF-22, CL-7, CL-26, CL-34

- Una base es una definición + propiedades + vistas. Las **filas son páginas** con una entrada en `db_rows` y valores en `cell_values`.
- Tipos de propiedad de RF-22; **relación** guarda vínculos bidireccionales; **rollup** agrega (contar, sumar, promediar, mínimo, máximo) sobre filas relacionadas.
- **Fórmulas**: analizador sin `eval`, evaluación por fila, grafo de dependencias a nivel de propiedad. Antes de guardar una fórmula o un rollup se verifica que el grafo siga siendo acíclico (CL-26). Un error en una celda se guarda como valor de error con explicación y **no se propaga** a otras filas. Recálculo incremental: solo las filas y rollups afectados, en un *worker*.
- **Seis vistas**: tabla, lista, tablero, galería, calendario y línea de tiempo tipo Gantt; todas **virtualizadas**. El tablero (RF-8) es una vista de una base con una propiedad de estado: crear una tarjeta crea una página + fila; mover una tarjeta cambia el valor de estado **solo en esa base** (CL-34).
- Eliminar una columna con tarjetas pide mover antes; eliminar una página en varias bases advierte y la manda a la papelera, de modo que desaparece de todas (CL-7).

### 5.6 Diagramas y organizadores — RF-9, RF-10, CL-8 a CL-10

- **Diagrama**: formas de RF-9 con color y texto editable, conectores con etiqueta que siguen a las formas, zoom, desplazamiento y "ajustar a pantalla" (CL-8). Al borrar una forma, sus conectores se eliminan **de forma explícita** (se informa de cuántos), sin dejar huérfanos.
- **Mapa mental / organigrama**: árbol con colapso que se recuerda; disposición automática al agregar o mover.
- **Línea de tiempo**: eventos ordenados por fecha con orden estable y sin solapamiento visual cuando coinciden (CL-10).
- **Matriz** (incluida 2×2): cuadrícula con celdas editables.
- Todos son bloques del editor cuyo estado vive dentro del documento Yjs (D-8), por lo que se respaldan, buscan y exportan con la página.

### 5.7 Tareas, recordatorios y agenda — RF-11, RF-12, CL-11 a CL-14, CL-25, CL-32

- `tasks` es un índice **derivado** de tres fuentes (casillas, tarjetas, filas); `reminder_state` guarda lo que no se puede derivar (disparado, pospuesto, descartado).
- **Recurrencia** diaria, semanal, mensual y anual con date-fns; la siguiente repetición se calcula **desde la fecha original** (CL-32) y en meses cortos cae en el último día (CL-25).
- **Disparo**: en cada tic el núcleo busca recordatorios cuya hora llegó. Se muestran **agrupados** (CL-14). Si hay varias repeticiones acumuladas de una tarea recurrente, se muestra **solo la más reciente**.
- **Vencidos**: al iniciar, el resumen global (todos los espacios, con el nombre del espacio) y la agenda por espacio. Si el sistema bloquea notificaciones, se avisa **una vez** con instrucciones y todo sigue apareciendo como vencido al abrir.
- Recordatorio con fecha pasada: se avisa al crear y se ofrece guardar como vencido o cambiar la fecha (CL-11).
- Posponer: 10 minutos, 1 hora o mañana, desde la ventana de recordatorio.

### 5.8 Captura rápida — RF-13, CL-15, CL-16, CL-30

- Ventana mínima separada, abierta por el **atajo global** o desde la bandeja o dentro de la app. El borrador se guarda continuamente y se recupera la siguiente vez, con botón para descartarlo.
- Destino: la **Bandeja de entrada** del espacio marcado como predeterminado; si no existe se **recrea** (CL-16); si el espacio se eliminó, se pide elegir otro (CL-30).
- **Sin atajo global** (p. ej. Wayland): se avisa, se explica cómo asignar un atajo en el sistema que ejecute la aplicación con el argumento interno de captura —la instancia única reenvía la orden a la ventana en ejecución— y la captura sigue disponible desde la bandeja y dentro de la app (CL-15).

### 5.9 Importar y exportar — RF-23, RF-24, CL-27, CL-28, CL-31

- **Importar**: Markdown suelto o carpetas (incluida una bóveda de Obsidian, con conversión de `[[enlaces]]`), y el ZIP de exportación de Notion en su variante Markdown + CSV. Todo cae en una **página contenedora nueva** (nunca sobrescribe; CL-28), con **informe** de lo importado, lo aproximado y lo omitido, incluidos enlaces rotos (CL-27). Garantizado para Notion: páginas, jerarquía, texto con formato, listas, imágenes y bases de datos básicas. Progreso y cancelación sin dejar contenido a medias: la importación ocurre en una transacción lógica que se revierte entera al cancelar.
- **Exportar**: HTML autocontenido y PDF de una página, con o sin hijas; incluye diagramas y organizadores como vectores y la vista elegida de una base de datos. Si falta un adjunto, avisa y completa el resto. Progreso y cancelación en un *worker* (CL-31).

### 5.10 Ubicación de datos — RF-25, CL-20, CL-35, CL-36

- Ubicación por defecto: carpeta estándar de datos del sistema; configurable por espacio.
- **Mover**: se copia el espacio completo a la nueva carpeta, se **verifica** (huellas de la base y de todos los adjuntos) y solo entonces se actualiza el registro y se retira la ubicación vieja. Si se interrumpe, la ubicación anterior sigue siendo la válida (CL-36). Antes de empezar se comprueba que exista, se pueda escribir y haya espacio.
- Si la carpeta de un espacio no está disponible al abrir, se avisa y **no se crea uno vacío** (CL-35). Disco lleno al guardar: aviso inmediato sin perder lo ya confirmado (CL-20).

### 5.11 Apariencia, idioma y atajos — RF-20, RNF-9, RNF-10

- Tema claro/oscuro/sistema con variables de diseño; español de México por defecto e inglés seleccionable; **catálogo de acciones** con atajos por defecto, reasignables y con detección de conflictos.
- Accesibilidad: componentes de Radix, foco visible, navegación por teclado completa y contraste AA verificados en pruebas.

---

## 6. Respaldo a GitHub (diseño detallado) — RF-14 a RF-17, RNF-6, RNF-7

### 6.1 Disposición del repositorio

| Ruta | Contenido |
|---|---|
| `workspace.json` | Versión de formato, nombre, identificadores, ajustes **del espacio** (no los de la aplicación) |
| `pages/…` | Un Markdown legible por página, con ruta basada en la jerarquía y un nombre estable (título + id corto) |
| `data/…` | Un JSON **sin pérdida** por página (modelo canónico, diagramas y organizadores incluidos) |
| `databases/…` | Definición, propiedades, vistas, filas y vínculos por base de datos |
| `reminders.json` | Fechas, recurrencias y estados |
| `assets/` | Adjuntos con nombre = hash |
| `trash.json` | Elementos en papelera con fecha de eliminación (D-18 de la spec) |

**[DECISIÓN DEL PLAN]** Los ajustes **de la aplicación** (tema, idioma, atajos) y cualquier secreto **no** se respaldan; la restauración en otro equipo usa los valores por defecto.

### 6.2 Determinismo e incremento

- Claves de JSON ordenadas, fin de línea fijo, sin marcas de tiempo propias del respaldo en el contenido; el mismo contenido produce los mismos bytes (RNF-7).
- Se calcula localmente la huella Git de cada archivo, se compara con el árbol remoto, se suben solo los blobs distintos y **si el árbol resultante es igual no hay commit**.
- El mensaje del commit resume la fecha y la cantidad de páginas modificadas.

### 6.3 Ciclo de ejecución

1. El tic evalúa si venció el plazo (último éxito + frecuencia). Al abrir la app, si ya venció, se ejecuta **una sola vez** aunque hayan pasado varios plazos (CL-19). **Respaldar ahora** lo fuerza.
2. La base y los adjuntos solo pueden leerse en el hilo que los posee, así que la **instantánea** se lee y serializa allí (`snapshotWorkspace`); el trabajo pesado —huellas, comparación, subida y commit— corre en un *worker* sin acceso a la base (`serveBackup`, T-190). El token viaja al worker solo en memoria.
3. Se compara la cabeza remota con el último commit conocido: si cambió por fuera, se pide decisión antes de continuar (CL-18).
4. Se suben los blobs, se crea el árbol y el commit **sobre la cabeza remota** y se avanza la referencia sin forzar.
5. Se registra el resultado en `backup_runs`.

### 6.4 Fallos — RF-16, CL-17

| Causa | Comportamiento |
|---|---|
| Sin conexión / error temporal / límite de uso | Reintentos con espera creciente (1, 5, 15 y 60 minutos) y luego aviso visible con causa y botón de reintento |
| Credenciales vencidas, repositorio inexistente o sin permisos | Sin reintentos automáticos inútiles: aviso inmediato con la causa |
| Repositorio público elegido | Advertencia y confirmación explícita al configurar |
| Adjunto mayor al límite | Se omite, se avisa cuál es y se respalda el resto |
| Límite de tamaño del repositorio | Se detiene, se explica el límite y qué hacer; reintento en el siguiente plazo |
| Equipo apagado a mitad | Nada queda a medias: la referencia solo avanza al final; se repite en el siguiente plazo o inicio |

En **todos** los casos el respaldo es de solo lectura sobre los datos locales: no modifica ni borra notas (RF-16).

### 6.5 Restauración — RF-17, CL-23

- Se listan los commits del repositorio por fecha, se elige uno y se lee su árbol.
- Se valida la **versión de formato**: si es más nueva que la soportada o el contenido está dañado, se rechaza sin tocar nada.
- Por defecto restaura como **espacio nuevo**. Para reemplazar uno existente se muestra qué se sustituirá, se exige confirmación, se construye el nuevo contenido aparte y solo al final se hace el intercambio.
- Se reconstruyen páginas, jerarquía, tableros, bases de datos, diagramas, organizadores, enlaces, fechas, recordatorios y adjuntos (no el historial de deshacer).
- En un equipo nuevo: conectar GitHub y restaurar manualmente; sin sincronización posterior.

---

## 7. Dependencias nuevas (justificación — constitución, art. 1)

La constitución ya fija: TypeScript, React, Vite, Bun, Tailwind, Radix, BlockNote, SQLite, Yjs, Tauri 2, PWA, Vitest y Playwright. Todo lo demás se justifica aquí.

| Dependencia | Para qué | Por qué esa y no otra | Decisión |
|---|---|---|---|
| `@sqlite.org/sqlite-wasm` | SQLite en navegador | Compilación oficial; soporta OPFS | D-2, D-4 |
| `rusqlite` (Rust, con SQLite incluido y texto completo) | SQLite nativo | Control de transacciones | D-3 |
| `keyring` (Rust) | Llavero del sistema | Abstrae libsecret, Credential Manager y Keychain | D-22 |
| Plugins de Tauri: notificación, atajo global, instancia única, diálogo, actualización, abrir enlaces | Funciones nativas | Oficiales | D-17, D-19 |
| `@xyflow/react` | Lienzo de diagramas y organizadores | Conectores que siguen a las formas, zoom, accesibilidad | D-9 |
| `d3-hierarchy`, `d3-force` | Disposición de árboles y grafo | Módulos pequeños y puros | D-10, D-11 |
| `@dnd-kit` | Arrastrar y soltar en árbol, tablero y galería | Accesible por teclado | RF-1, RF-8 |
| `@tanstack/react-virtual` | Listas y tablas virtualizadas | Necesario para RNF-2 y RNF-11 | RF-22 |
| `cmdk` | Paleta de comandos | Estándar, accesible | RF-5 |
| `zustand` | Estado de interfaz | Minúsculo; el estado de dominio vive en el núcleo | — |
| `date-fns` | Aritmética de fechas | Ajuste a fin de mes y pureza | D-15 |
| `fractional-indexing` | Orden de páginas y tarjetas | Pequeña, probada | D-27 |
| `unified`, `remark-parse`, `remark-gfm` | Analizar Markdown al importar | Estándar de facto | D-29 |
| `fflate` | Leer/escribir ZIP | Ligera y rápida; funciona en *workers* | D-29 |
| `papaparse` | Leer CSV de Notion | Maneja comillas y saltos de línea | D-29 |
| `dompurify` | Sanear HTML | Estándar de seguridad | D-30 |
| `i18next`, `react-i18next` | Traducciones | Madura | D-33 |
| `vite-plugin-pwa` | Manifiesto y precaché | Evita errores de caché manual | D-34 |
| `y-prosemirror` | Enlace del editor con Yjs | **Opcional en BlockNote 0.57: si falta, el editor no sincroniza y no avisa** (hallazgo del Hito 0) | D-6 |
| `tauri-driver` (herramienta de desarrollo) | Pruebas e2e de la app real de escritorio con WebKitWebDriver | Único modo de automatizar el webview real en Linux | Sección 9 |
| `fast-check` (desarrollo) | Pruebas basadas en propiedades | Excelente para árboles, fórmulas y determinismo | Sección 9 |
| `@axe-core/playwright` (desarrollo) | Accesibilidad automatizada | Verifica RNF-9 | Sección 9 |

---

## 8. Seguridad y privacidad — RNF-5, RNF-6, CL-24, art. 6

- **Única salida de red**: la API de GitHub. La política de seguridad de contenido y las pruebas de red lo verifican. Sin telemetría, analítica ni fuentes o scripts remotos.
- **Token**: llavero del sistema (escritorio) o memoria de sesión (web). Nunca en la base, el respaldo, los registros ni los archivos de configuración. Los registros **redactan** cualquier valor con forma de token.
- **Contenido**: todo HTML y Markdown externo se sanea; se aplica política de seguridad de contenido estricta; el HTML exportado no incluye scripts.
- **Instancia única** y bloqueo de escritura por espacio (CL-22).
- **Permisos de Tauri** mínimos: solo los plugins necesarios y las rutas de datos elegidas.

---

## 9. Estrategia de tests (constitución, art. 4)

### 9.1 Niveles

| Nivel | Qué prueba | Herramienta |
|---|---|---|
| Unitarias del núcleo | Árbol y papelera, enlaces, fórmulas y ciclos, rollups, filtros y orden, recurrencias y zonas horarias, cálculo del plazo del respaldo, serialización y determinismo, migraciones | Vitest |
| Propiedades | Mover/duplicar páginas nunca crea ciclos; respaldar→restaurar es identidad; el mismo contenido da los mismos bytes; ninguna fórmula "inventa" una evaluación circular | fast-check |
| Contrato de puertos | La **misma batería** se ejecuta contra una implementación en memoria, SQLite nativo y SQLite WASM; garantiza que ambos adaptadores se comportan igual | Vitest |
| Integración del respaldo | Cliente de GitHub contra un **servidor GitHub falso** local que simula la API Git, límites de uso, repositorio lleno, credenciales vencidas, cambios externos y cortes a mitad | Vitest + servidor en memoria con Bun |
| Inyección de fallos | Cortar el proceso durante guardado, respaldo, movimiento de carpeta, importación y restauración; verificar que no quedan datos a medias | Adaptador de fallos |
| Importar / exportar | Fixtures **sintéticos** (bóveda de Obsidian, ZIP de Notion Markdown+CSV, archivos dañados); exportación comparada con archivos de referencia | Vitest + archivos dorados |
| Componentes | Árbol, tablero, vistas, diagramas, atajos (conflictos) | Vitest + testing library |
| Extremo a extremo (web) | Flujos completos de cada hito | Playwright |
| Extremo a extremo (escritorio) | Humo de arranque, bandeja, captura, notificación, instancia única | Controlador WebDriver de Tauri en Linux y Windows |
| Rendimiento | Presupuestos de RNF-1, 2, 3, 11 y 13 con datos generados | Pruebas de *benchmark* con umbrales |
| Accesibilidad | Reglas de contraste, etiquetas y navegación por teclado | axe + Playwright |
| Privacidad | Interceptar toda la red: solo GitHub; buscar el token en base, respaldo y registros | Playwright + pruebas de núcleo |
| i18n | Mismas claves en español e inglés; sin textos fijos | Vitest |

**Reglas**: los relojes se **simulan** (recordatorios, plazos, 30 días de papelera, cambio de zona horaria); ningún test depende de internet ni de datos personales; los fixtures son siempre sintéticos.

### 9.2 Pruebas por casos límite

| Casos | Cómo se verifican |
|---|---|
| CL-1 a CL-3 (títulos) | Unitaria del núcleo + e2e |
| CL-4 (mover a descendiente) | Propiedades + e2e |
| CL-5, CL-6, CL-27 (enlaces rotos y ciclos) | Unitaria + grafo con ciclos |
| CL-7, CL-34 (tarjetas y bases múltiples) | Integración con el modelo de datos |
| CL-8 a CL-10 (diagramas, línea de tiempo) | Componentes + e2e |
| CL-11 a CL-14, CL-25, CL-32 (recordatorios) | Unitaria con reloj simulado + e2e de ventana de recordatorio |
| CL-15, CL-16, CL-30 (captura rápida) | e2e de escritorio + simulación de atajo no disponible |
| CL-17, CL-36 (cortes) | Inyección de fallos |
| CL-18, CL-19, CL-21, CL-23 (respaldo) | Servidor GitHub falso |
| CL-20 (disco lleno), CL-35 (carpeta ausente) | Adaptador de fallos |
| CL-22 (dos ventanas) | e2e con dos contextos |
| CL-24 (contenido inseguro) | Unitaria con corpus de entradas maliciosas |
| CL-26 (ciclos de fórmulas) | Propiedades |
| CL-28 (importar dos veces), CL-29 (eliminar espacio) | Integración + e2e |
| CL-31 (exportación grande) | Rendimiento + cancelación |
| CL-33 (30 días en papelera) | Reloj simulado |

### 9.3 Requisitos no funcionales

| RNF | Verificación |
|---|---|
| RNF-1, 2, 3, 11, 13 | *Benchmarks* con umbrales en cada fusión a la rama principal |
| RNF-4 | Inyección de fallos |
| RNF-5, RNF-6 | Prueba de red y búsqueda del token |
| RNF-7 | Propiedades de determinismo + archivos dorados |
| RNF-8 | Matriz de CI: Linux, Windows y macOS |
| RNF-9 | axe + revisión por teclado |
| RNF-10 | Prueba de claves de i18n |
| RNF-12 | e2e con cancelación a mitad de operación |

### 9.4 Puertas de calidad

- `bun run typecheck` y `bun run test` pasan **antes de cerrar cualquier tarea** (art. 4).
- Cada hito se cierra con su e2e en verde, los presupuestos de rendimiento cumplidos y el criterio de finalización correspondiente de la spec (sección 9 de la spec) demostrado.

---

## 10. Hitos

> **Resultado del Hito 0:** GO con Tauri 2 (ver `spikes/RESULTS.md`). Cambios derivados: RNF-2 acotado a 2 000 bloques; `y-prosemirror` y `withCollaboration` obligatorios; SQLite WASM solo en Worker y excluido de la optimización de Vite; PDF con el diálogo de impresión del sistema en el MVP.

### Hito 0 — Pruebas de viabilidad (antes de construir)

Responde con evidencia si el plan es viable; si algo falla se decide aquí.

| Prueba | Pregunta | Si falla |
|---|---|---|
| WebKitGTK + BlockNote | ¿Escribir, arrastrar bloques, pegar y el menú `/` funcionan bien en Linux? | Pasar a Electron (la capa de adaptadores lo permite) |
| Rendimiento del editor | ¿Una página de 2 000 bloques cumple RNF-2 con Yjs activo? | **Resultado: sí** (mediana 23 ms); con 10 000 bloques no (≈780 ms por tecla), por lo que RNF-2 se fijó en 2 000 bloques y se avisa al superar 5 000 |
| Lectura del documento sin interfaz | ¿El conversor puro Yjs → modelo canónico (D-7) es fiel a lo que escribe BlockNote? | Rediseñar el puente |
| SQLite nativo | ¿Texto completo y transacciones con 50 000 filas? | Ajustar la compilación de SQLite |
| Bandeja y ventana oculta | ¿El tic nativo sigue funcionando con la ventana oculta en Linux y Windows? | Replantear D-17/D-18 |
| Atajo global y notificaciones | ¿Qué funciona en X11, Wayland, Windows? | Quedarse con las alternativas de RF-13 |
| Impresión a PDF nativa | ¿El webview puede guardar PDF sin diálogo en cada sistema? | Usar el diálogo de impresión del sistema |
| Actualizaciones | ¿Dónde se alojan los binarios (ver punto P-2)? | **Resultado:** GitHub Releases con aviso manual informado (P-2) |
| Empaquetado | ¿AppImage/.deb y .msi se generan en CI? | — |

### Hito 1 — Núcleo y respaldo
**RF-1 a RF-5, RF-14 a RF-21, RF-25.** Espacios, páginas, editor, papelera, búsqueda, sin conexión, instalación (web y escritorio), apariencia e idioma, ubicación de datos, respaldo y restauración, actualización de escritorio.
*Demostración:* criterios 1, 2 (sin enlaces ni grafo), 7, 8, 9, 10 y 11 de la sección 9 de la spec.

### Hito 2 — Kanban, bases de datos y recordatorios
**RF-8, RF-11, RF-12, RF-22.** Modelo de bases de datos, seis vistas, fórmulas/relaciones/rollups, tableros, tareas con fecha, recordatorios, agenda y resumen de vencidos.
*Demostración:* criterios 3, 5 y 12.

### Hito 3 — Diagramas y organizadores
**RF-9, RF-10.** Diagramas de flujo y los cuatro organizadores.
*Demostración:* criterio 4.

### Hito 4 — Enlaces, grafo, captura rápida, importar y exportar
**RF-6, RF-7, RF-13, RF-23, RF-24.**
*Demostración:* criterios 2 (enlaces y grafo), 6 y 13.

Al cerrar el Hito 4: criterios 14 a 18 (hitos, RNF, casos límite, calidad y plan).

---

## 11. Integración y entrega

- **CI (GitHub Actions)**: tipos y pruebas en Linux, Windows y macOS; e2e web en Linux; e2e de escritorio en Linux y Windows; *benchmarks* con umbral.
- **Empaquetado**: AppImage, `.deb` y `.rpm` (Linux), `.msi`/`.exe` (Windows), `.dmg` (macOS); la PWA como sitio estático.
- **Versionado**: versión de la aplicación, de **esquema** de base y de **formato de respaldo** por separado; el respaldo rechaza versiones futuras (CL-23).
- **Registros**: locales, con rotación, sin secretos, sin envío.

**Cubre:** RF-19, RNF-8.

---

## 12. Matriz de trazabilidad RF → plan → pruebas

| RF | Componentes del plan | Decisiones | Hito | Pruebas principales |
|---|---|---|---|---|
| RF-1 | 5.1, tabla `pages` | D-27 | 1 | Unitarias del árbol, propiedades, e2e de arrastre |
| RF-2 | 5.1, purga | D-5 | 1 | Reloj simulado (30 días), e2e papelera |
| RF-3 | 5.2, 2.4 | D-6, D-7, D-25, D-30 | 1 | Componentes del editor, e2e, corpus inseguro |
| RF-4 | 2.4, 3 | D-5, D-32 | 1 | Inyección de fallos |
| RF-5 | 5.3, `page_text` | D-26 | 1 | Unitarias de búsqueda, benchmark |
| RF-6 | 5.4, `links` | D-7 | 4 | Unitarias de enlaces, e2e de renombrado |
| RF-7 | 5.4 | D-11 | 4 | Grafo con ciclos y grande |
| RF-8 | 5.5 | D-12 | 2 | Integración de tablero, e2e de arrastre |
| RF-9 | 5.6 | D-8, D-9 | 3 | Componentes de lienzo, benchmark de 500 elementos |
| RF-10 | 5.6 | D-8, D-10 | 3 | Componentes, línea de tiempo con empates |
| RF-11 | 5.7, `reminder_state` | D-15, D-16, D-17, D-19 | 2 | Reloj simulado, e2e de ventana de recordatorio |
| RF-12 | 5.7 | D-19 | 2 | Integración multi-espacio, e2e de resumen |
| RF-13 | 5.8 | D-17 | 4 | e2e de escritorio, simulación sin atajo |
| RF-14 | 6.1, 6.4 | D-20, D-21, D-22 | 1 | Servidor GitHub falso, prueba del token |
| RF-15 | 6.1 a 6.3 | D-23, D-24, D-25 | 1 | Determinismo, archivos dorados |
| RF-16 | 6.4 | D-20, D-24 | 1 | Servidor falso: todos los fallos |
| RF-17 | 6.5 | D-24 | 1 | Respaldar→restaurar como propiedad, versión futura |
| RF-18 | 2.3, D-2 | D-2, D-4 | 1 | e2e sin red |
| RF-19 | 11, 5.11 | D-18, D-34 | 1 | CI en tres sistemas, e2e de PWA |
| RF-20 | 5.11 | D-33 | 1 | i18n, conflictos de atajos, axe |
| RF-21 | 5.1, D-1 | D-1 | 1 | Integración multi-espacio, e2e de eliminación |
| RF-22 | 5.5 | D-12, D-13 | 2 | Fórmulas, ciclos, rollups, vistas, benchmark |
| RF-23 | 5.9 | D-29, D-30 | 4 | Fixtures de Obsidian y Notion, archivos dañados |
| RF-24 | 5.9 | D-28 | 4 | Archivos dorados, cancelación |
| RF-25 | 5.10 | D-1, D-3 | 1 | Inyección de fallos, carpeta ausente |

**Cobertura:** los 25 RF tienen componente, decisión, hito y prueba asignados.

---

## 13. Riesgos técnicos

| Riesgo | Efecto | Mitigación |
|---|---|---|
| WebKitGTK se comporta distinto a Chromium | Fallos de editor o arrastre en Linux | Hito 0; adaptadores aislados para pasar a Electron |
| El conversor Yjs → modelo canónico depende del formato interno del editor | Roturas al actualizar BlockNote | Fijar versiones, pruebas de contrato con un editor real, actualizaciones deliberadas |
| Páginas de más de 5 000 bloques | Escritura lenta (≈780 ms por tecla a 10 000) | RNF-2 acotado a 2 000 bloques y aviso para dividir la página (RF-3); medido en el Hito 0 |
| Temporizadores con ventana oculta | Recordatorios o respaldo retrasados | Tic nativo (D-17) y verificación en Hito 0 |
| Impresión a PDF dispar entre sistemas | Exportar PDF inconsistente | Respaldo: diálogo de impresión del sistema |
| Atajo global y notificaciones en Wayland | RF-13 y RF-11 degradados | Alternativas ya especificadas (bandeja, atajo del sistema) |
| Hito 2 es muy grande (bases de datos completas) | Retrasa todo | Dividir internamente: modelo y tabla → relaciones/rollups/fórmulas → resto de vistas → recordatorios |
| Token en web solo en memoria | Fricción al iniciar sesión | Documentarlo; el uso principal es escritorio |

---

## 14. Decisiones del plan (confirmadas por la persona usuaria)

| ID | Tema | Decisión confirmada |
|---|---|---|
| P-1 | Cerrar la ventana | Oculta a la bandeja (con opción "Salir"), para que recordatorios y respaldo sigan (D-18). Si prefieres que cerrar sea salir, esas funciones solo trabajarían con la ventana abierta |
| P-2 | Alojamiento de las actualizaciones de escritorio | **Decidido (T-165):** los binarios se publican en **GitHub Releases** del repositorio del proyecto. La app de escritorio hace al abrir una consulta anónima a `api.github.com/repos/<propietario>/<repo>/releases/latest` (sin token ni datos de la persona; compatible con RNF-5), compara la versión y, si hay una mayor, muestra un aviso con botón «Descargar» que abre la página del release en el navegador. La actualización sigue siendo **manual informada**: la app nunca instala ni descarga por su cuenta, por lo que no hacen falta firmas de actualización automática en el MVP. El repositorio se configura en un solo lugar (`updateRepo` en `brand.config.json`); vacío = sin aviso. Los releases deben ser públicos para que la consulta anónima funcione; si el repositorio es privado, el aviso queda desactivado hasta publicar los binarios en un repositorio público. Las firmas y la actualización automática (plugin de actualización de Tauri) quedan fuera del MVP |
| P-3 | Token en web | Solo en memoria (D-22), por no existir llavero en navegador |
| P-4 | Qué se respalda de los ajustes | Solo los del espacio; no los de la aplicación (6.1) |
| P-5 | Límite de advertencia de adjuntos | 100 MB, que es el límite individual de GitHub (5.2) |
| P-6 | Reintentos del respaldo | 1, 5, 15 y 60 minutos y luego aviso (6.4) |
| P-7 | Variante de exportación de Notion | Markdown + CSV (5.9); la variante HTML queda fuera |
| P-8 | Sin Turborepo | Solo *workspaces* de Bun (D-14) |

---

## 15. Cumplimiento de la constitución

| Artículo | Cómo lo cumple este plan |
|---|---|
| 1. Stack mínimo | Parte del stack fijado; toda dependencia nueva está justificada en la sección 7 |
| 2. La spec manda | El plan deriva de la spec; las decisiones propias están marcadas y listadas en la sección 14 |
| 3. Lógica separada | Núcleo puro + puertos + adaptadores (2.1 a 2.3); D-7 evita importar el editor en el núcleo |
| 4. Tests obligatorios | Sección 9; todo comportamiento de datos tiene pruebas y puertas de calidad |
| 5. SQLite como única fuente de verdad | Sección 3 y D-1 a D-6; migraciones versionadas con copia previa; papelera; confirmaciones |
| 6. Respaldo a GitHub abierto y privado | Sección 6; token solo en llavero; determinista; un commit por ciclo |
| 7. Idioma | i18n con español de México por defecto; identificadores en inglés; nombre del proyecto en un solo lugar |
