# Resultados de las verificaciones previas — spec 005 (estilo de páginas)

Fecha: 2026-11-16 · Fase 0. Código desechable en `spikes/estilo/`.

**Cómo se ejecutó.** Una misma página de prueba se cargó en los dos motores:
- **WebKitGTK 2.52.6** (la `webkit2gtk-4.1` del sistema, la misma que usa Tauri en Linux) con `run_webkit.py`: una ventana GTK normal con `WebKit2.WebView`. Con `SCHEME=tauri` la página se sirve desde `tauri://localhost`, registrado como esquema seguro y con CORS, igual que Tauri. Una ventana fuera de pantalla (`Gtk.OffscreenWindow`) **no sirve**: WebKitGTK aborta al no poder crear un contexto OpenGL.
- **Chrome 157** sin interfaz, con el arnés e2e del proyecto (`tests-e2e/cdp.ts`), en `run_chrome.ts`.
Las imágenes de prueba (`make_images.py`), las fuentes y el paquete del menú no se versionan.

## E-001 / E-002 — Redimensionar y codificar en un *worker* → FUNCIONA EN LOS DOS
PNG de ruido de 19,2 MB y 3200×2000 (el peor caso para decodificar), a JPEG 0,85 de 2560×1600:

| | WebKitGTK | Chrome |
|---|---|---|
| `OffscreenCanvas` en el *worker* | sí | sí |
| Decodificar / total | 49 / 202 ms | 22 / 87 ms |
| Pausa máxima del hilo principal mientras tanto | 14 ms | 10 ms |
| Alternativa en el hilo principal (total) | 173 ms | 88 ms |
| Codifica WebP | **no** | sí |

Con una **foto real** de 4000×2670 (2,4 MB): 289 ms en WebKitGTK y 178 ms en Chrome, y el resultado pesa **706 KB** (cumple el «menos de 1 MB» de RNF-6). La imagen de ruido sale de 2,5 MB: es un caso extremo que no representa una portada.
Decisión: **se mantiene DP-4** (JPEG 0,85 en un *worker*); WebP queda descartado con dato, porque WebKitGTK no lo codifica. La alternativa en el hilo principal se conserva solo como respaldo.

## E-003 — Orientación EXIF → FUNCIONA
JPEG de 400×200 con orientación EXIF 6: `createImageBitmap(..., { imageOrientation: "from-image" })` devuelve 200×400 en los dos motores.

## E-004 / E-005 — Llamar a Unsplash desde la app → FUNCIONA
Sin clave real (respuesta 401 legible = CORS deja pasar), desde `tauri://localhost` y `http://` en WebKitGTK y desde Chrome:
- `api.unsplash.com` con la cabecera `Authorization: Client-ID …` y `Accept-Version: v1`: **401 legible** en los tres casos. El preflight acepta `Authorization` (Unsplash lo permite aunque `Access-Control-Allow-Headers` sea `*`).
- `images.unsplash.com` descargada como `Blob`: `image/jpeg` en los tres casos.
- `X-RateLimit-Remaining` viene en `Access-Control-Expose-Headers`, así que será legible; en un 401 no se envía, por lo que su lectura con una clave válida se comprueba en la Fase 4.
Decisión: **se mantienen DP-10 y DP-11** con la cabecera `Authorization` (la clave no va en la URL).

## E-006 / E-007 — Fuentes → MUY POR DEBAJO DEL LÍMITE
Variables, subconjunto latino, de Fontsource (`<id>:vf`, archivo `latin-wght-normal.woff2`, mismo formato que las tres actuales). Todas **OFL-1.1**:

| Fuente | Bytes | Pesos |
|---|---|---|
| Geist | 29 400 | 100–900 |
| Nunito | 39 128 | 200–900 |
| Lora | 37 788 | 400–700 |
| Merriweather | 97 548 | 300–900 |
| Fira Code | 36 276 | 300–700 |
| Atkinson Hyperlegible Next | 33 996 | 200–800 |
| Caveat | 74 932 | 400–700 |
| **Total** | **349 068** | |

El plan estimaba de 0,9 a 1,6 MB: son **0,35 MB**. Los textos de licencia se copian de cada repositorio de origen al añadirlas (E-115).

## E-008 — Cambiar `editable` de BlockNote en vivo → FUNCIONA
Prueba con Testing Library (`editableToggle.spike.test.tsx`; Mantine necesita simular `window.matchMedia` en jsdom): al pasar `editable` de `true` a `false` y de vuelta, el nodo del editor **no se remonta**, `contenteditable` cambia, el documento Yjs **no recibe ninguna actualización**, el contenido es idéntico y el cursor sigue en el mismo bloque.
Decisión: **se mantiene DP-13**.

## E-009 — Cómo editan las vistas de base de datos → CONFIRMADO, CON UNA EXCEPCIÓN
- Las propiedades se escriben con `DatabaseService.setCell` en la tabla `cell_values`: no pasan por el editor ni por `pages`, así que el bloqueo no las toca (D-17 se cumple sin cambios).
- **Excepción:** la columna de título de la tabla usa `DatabaseController.setTitle` → `PageService.rename`, que sí cambia el **título**, protegido por el bloqueo. Se añade al plan (sección 10): en una página bloqueada, la celda de título de las vistas de base de datos es de solo lectura.

## E-010 — Apertura del menú → CUMPLE
`Popover` de Radix con las cinco secciones, dos listas de 10 fuentes escritas en su fuente, interruptores y botones. Tiempo de clic a menú pintado (incluye dos fotogramas):

| | Primera apertura | Siguientes |
|---|---|---|
| WebKitGTK (`tauri://`) | 76 ms | 29–30 ms |
| Chrome | 62 ms | 29–33 ms |

Las 10 fuentes cargan. Por debajo de los 100 ms de RNF-4.

## E-011 — Cierre de la Fase 0
Plan actualizado: DP-4 (dato de WebP y foto real), sección 3 (peso medido de las fuentes), DP-10 y DP-11 (confirmados), sección 10 (título de solo lectura en las vistas de base de datos) y riesgo técnico de la sección 16 (resuelto). Sin decisiones abiertas.
