# Plan 005 — Estilo de páginas: portadas, cabecera y opciones del archivo

> **Estado:** borrador · **Implementa:** `docs/specs/005-v-note-estilo-paginas/spec.md` (RF-1 a RF-9, RNF-1 a RNF-8, CL-1 a CL-17, D-1 a D-21).
> **Marco:** `docs/constitution.md` (incluida la excepción de Unsplash del art. 6). Este plan no contiene código de producción; fija el **cómo**: módulos, modelo de datos, algoritmos en pseudocódigo, contratos, decisiones con su alternativa descartada, hitos y pruebas.
> **Cómo leerlo:** cada parte indica entre corchetes lo que cubre, por ejemplo **[RF-3]**. La sección 15 es la matriz que comprueba que no queda ningún RF, RNF ni CL sin cubrir.
> **Punto de partida (estado actual del código):**
> - La tabla `pages` guarda `icon`, `cover` (texto `gradient:<nombre>` o `color:#hex`), `full_width` (migración 11), `created_at` y `updated_at` como columnas; los setters pasan por `setField` en `packages/core/src/pages/pagesRepo.ts`, que lista las columnas permitidas y actualiza `updated_at`. La última migración es la **13**.
> - Los archivos binarios viven en un almacén **direccionado por contenido** (SHA-256, `packages/core/src/assets/`), con implementación Tauri (Rust) y web (OPFS). **No hay limpieza** de archivos sin referencia: el respaldo escribe todo lo que devuelve `list()`.
> - Respaldo **formato v1** (`docs/backup-format.md`): `data/<id>.json` por página, Markdown legible, `assets/<sha256>`, archivos opcionales en la raíz (p. ej. `diagram-defaults.json`); JSON estable y campos nuevos solo cuando no son el valor predeterminado (`fullWidth` solo si es verdadero). El lector v1 ignora campos desconocidos y rechaza versiones más nuevas.
> - Llavero: puerto `Keychain` del núcleo y `GitHubTokenStore` como patrón; en escritorio va al llavero del sistema (crate `keyring`), en la web es solo memoria.
> - Red: `FetchLike` inyectado (patrón de `githubClient.ts`). La prueba `tests-e2e/privacy.e2e.test.ts` comprueba que el uso normal no sale del origen y que el respaldo solo llega a `api.github.com`.
> - Cabecera: `packages/ui/src/page/PageHeader.tsx` (portada de 128 px con degradado, ícono junto al título, fila de acciones con el interruptor de ancho completo). Barra superior: `layout/AppHeader.tsx` + `layout/HeaderBar.tsx` (ruta, estado de guardado, «editado hace…»).
> - Apariencia global (spec 002): preferencias del dispositivo aplicadas como `data-font` y `data-density` en `<html>`; variables CSS generadas desde `design/tokens.ts` (`--font-content`, `--text-reading-size/line`, `--size-reading-width`, `--cover-*`). Fuentes woff2 propias en `packages/ui/src/design/fonts/` con licencia OFL.
> - Índice: **ya existe** un índice flotante (`page/TableOfContents.tsx`, se muestra con 3 o más encabezados, resalta la sección visible) alimentado por `extractHeadings` en `page/toc.ts` desde el `XmlFragment` de Yjs.
> - Editor BlockNote con bloques propios en `editor/schema.tsx` y menú «/» propio en `editor/slashItems.tsx`. **No hay modo de solo lectura.**
> - Deshacer del núcleo (`undo/undo.ts`) solo cubre papelera, mover, duplicar, completar tarea y mover tarjeta. Existe la utilidad de instantáneas `Snapshots<T>` de la spec 004.
> - No hay código de redimensionado ni compresión de imágenes.

---

## 1. Resumen y cumplimiento de la constitución

### 1.1 Resumen
1. **Un objeto de estilo por página** (`PageStyle`), validado en el núcleo y guardado como JSON en una columna nueva. Todo lo opcional es «ausente = Predeterminado», así que una página sin estilo se ve exactamente como hoy.
2. **Tres columnas más en `pages`**: `description`, `locked` y `cover_credit`, y la gramática del campo `cover` se amplía para aceptar imágenes y degradados propios. Una sola migración (14) que además convierte `full_width` en `style.spacing.width = "full"`.
3. **Portadas de imagen en el almacén de archivos existente**, optimizadas en la interfaz (redimensionar a 2560 px y JPEG) dentro de un *worker*; el núcleo solo valida y decide dimensiones. Se añade una **limpieza segura** de archivos sin referencia.
4. **Cabecera y menú** se aplican con variables CSS **acotadas a la página** (no a `<html>`), por encima de la apariencia global.
5. **Unsplash** como cliente del núcleo con `fetch` inyectado, clave en el llavero y apagado por defecto; la prueba de privacidad gana un caso permitido.
6. **Respaldo formato v2**: campos nuevos aditivos y un archivo opcional `page-defaults.json`; los respaldos v1 se siguen restaurando.

### 1.2 Cumplimiento de la constitución
| Artículo | Cómo lo respeta este plan |
|---|---|
| 1 Stack mínimo | **Cero dependencias npm o Rust nuevas.** Solo se añaden siete archivos de fuente woff2 con licencia OFL (sección 3). |
| 2 La spec manda / hitos | Seis hitos en orden (sección 13). |
| 3 Lógica separada | Estilo, gramática de portada, dimensiones de imagen, estadísticas, índice, predeterminados, historial, cliente de Unsplash y limpieza de archivos viven en `packages/core` sin DOM; decodificar y codificar imágenes (requiere DOM/Canvas) vive en la interfaz; llavero y almacén siguen en los adaptadores. |
| 4 Tests | Cada regla de datos lleva prueba (sección 14). |
| 5 SQLite única fuente de verdad | Estilo, descripción, bloqueo, crédito y predeterminados se guardan en SQLite; las imágenes en el almacén del espacio. Todo funciona sin internet salvo la búsqueda de Unsplash. La limpieza de archivos solo borra lo que ninguna página, ni siquiera en la papelera, usa (DP-9). Migración versionada 14. |
| 6 Respaldo y privacidad | Respaldo v2 determinista y sin pérdida; la única conexión nueva es la excepción de Unsplash, opcional y con clave en el llavero. |
| 7 Idioma | Textos nuevos en `es-MX.ts` y `en.ts`; el nombre de la app para el crédito de Unsplash sale de `brand.ts`. |

---

## 2. Decisiones de plan

| ID | Decisión | Alternativa descartada | Cubre |
|---|---|---|---|
| **DP-1** | El estilo de la página es **un JSON en la columna `pages.style`** con forma `PageStyle` (sección 4.1), validado y normalizado por el núcleo. Claves ausentes = «Predeterminado». | Una columna por opción: más de 20 columnas y una migración por cada opción futura. Guardarlo en el documento Yjs: mezcla presentación con contenido y obliga a abrir el documento para listar páginas. | RF-1, RF-3 a RF-8 |
| **DP-2** | `description`, `locked` y `cover_credit` son **columnas propias**, no parte del estilo, porque «Restablecer estilo» (RF-8.4) no debe borrar la descripción, desbloquear ni perder el crédito. | Meterlos en `style`: restablecer borraría contenido. | RF-1.2, RF-2.5, RF-8.1, RF-8.4 |
| **DP-3** | **Gramática ampliada de `cover`** (texto): `gradient:<nombre>` y `color:#hex` (actuales), `lgrad:<ángulo>:<#hex>,<#hex>[,<#hex>]` (degradado propio) y `asset:<sha256>` (imagen). | Un JSON para la portada: rompe la compatibilidad con los datos y respaldos actuales. | RF-2, CL-14 |
| **DP-4** | **Optimizar en la interfaz, decidir en el núcleo:** el núcleo valida bytes y formato y calcula las dimensiones de salida; la interfaz decodifica con `createImageBitmap` (respetando la orientación EXIF) y codifica en un *worker* con `OffscreenCanvas` a **JPEG de calidad 0.85**, con 2560 px de ancho como máximo. | WebP: WebKit (Tauri en Linux) no lo codifica en canvas, lo que daría resultados distintos por plataforma. Una librería de imágenes (sharp, wasm): dependencia nueva y pesada. | RF-2.2, RNF-4, RNF-6 |
| **DP-5** | Las variables de estilo se aplican **en el contenedor de la página** (`--font-content`, `--font-headings`, `--text-reading-size`, `--text-reading-line`, `--block-gap`, `--size-reading-width`, `--c-accent*`) y heredan de la apariencia global cuando la opción está en «Predeterminado». | Atributos en `<html>`: afectarían a toda la app y no permitirían dos páginas con estilos distintos (vista dividida, vista previa). | RF-5, RF-6, RF-8.2, D-11 |
| **DP-6** | La **anchura de 4 valores** sustituye a `full_width`: la migración 14 copia `full_width = 1` a `style.spacing.width = "full"` y desde entonces el repositorio deja de leer y escribir `full_width`. La columna se conserva sin uso (SQLite no la necesita borrar). | Mantener las dos fuentes sincronizadas: dos verdades que divergen. | RF-6.1, RF-6.2, CL-14 |
| **DP-7** | **Predeterminado del espacio** en la tabla `meta` con la clave `page.default.style`, igual que `diagram.default.*`, y en el respaldo como `page-defaults.json`. Se **copia** a la página al crearla; nunca se aplica en vivo. | Aplicarlo en vivo como capa: cambiar el predeterminado alteraría páginas existentes (contra RF-8.5). | RF-8.5, D-10 |
| **DP-8** | **Historial de propiedades de página** con `Snapshots<PageProps>` (límite 100 por página) para cubierta, estilo, descripción y bloqueo. Ctrl+Z se dirige al historial de Yjs si el foco está en el contenido del editor y al de propiedades en cualquier otro lugar (cabecera, menú, portada); cada cambio desde el menú muestra además el aviso «Deshacer». | Mover todo al documento Yjs para compartir historial: ver DP-1. Usar el `undo.ts` de operaciones: está pensado para operaciones sueltas con aviso, no para una pila. | RF-3.5, RF-4.6, RF-8.4, D-19 |
| **DP-9** | **Limpieza de archivos sin referencia** al abrir el espacio (no durante la sesión, para que deshacer un cambio de portada siga funcionando): se recogen las referencias `asset:<hash>` de todas las páginas, **incluidas las de la papelera** (portada y documento), bases de datos y demás JSON guardados; se borra solo lo que no aparece en ningún sitio. Si la recolección falla en cualquier punto, no se borra nada. | No limpiar: el espacio y el respaldo crecen para siempre con cada portada cambiada. Contador de referencias: frágil ante cualquier ruta de escritura olvidada. | RF-2.8, CL-5, CL-6 |
| **DP-10** | **Unsplash** como `UnsplashClient` del núcleo con `FetchLike` inyectado (mismo patrón que GitHub); la clave se guarda en el llavero con la cuenta `unsplash-access-key` (de dispositivo, no por espacio); el interruptor «Activar Unsplash» es una preferencia del dispositivo. | Llamar a Unsplash desde los componentes: lógica sin pruebas y sin punto único para la regla de privacidad. Una clave por espacio: la persona tendría que repetirla. | RF-2.4 a RF-2.6, RF-9 |
| **DP-11** | Al elegir una foto de Unsplash: (1) se avisa la descarga (`download_location`), (2) se descarga `urls.raw` con `w=2560&fm=jpg&q=85`, (3) pasa por la misma optimización que una imagen subida y (4) se guarda el crédito con enlaces que llevan `utm_source=<nombre de la app>&utm_medium=referral`. | Mostrar la foto desde el enlace de Unsplash: rompe el funcionamiento sin conexión (D-14). | RF-2.4, RF-2.5, D-14 |
| **DP-12** | El índice reutiliza `TableOfContents` y su extracción, que **pasa al núcleo** (`pages/toc.ts`, función pura sobre los bloques) con filtro de niveles. El nuevo **bloque `toc`** lee la misma lista. El índice flotante mantiene su umbral actual de 3 encabezados; con menos no aparece (cumple RF-7.6). | Un segundo extractor para el bloque: dos listas que pueden no coincidir. | RF-7, D-18 |
| **DP-13** | **Bloqueo** = `BlockNoteView editable={false}` + campos de cabecera de solo lectura + menú de portada oculto. Las vistas de base de datos no consultan `locked` (D-17). | Interceptar cada transacción del editor: más complejo y propenso a huecos (pegar, arrastrar). | RF-8.1, RF-8.1.1, CL-11 |
| **DP-14** | El **menú de opciones** es un `Popover` (Radix, ya presente) con un botón en `HeaderBar`, en el extremo derecho, visible solo cuando hay una página abierta. Las secciones usan `Segmented`, `Switch` y una lista de fuentes con vista previa. | Panel lateral fijo: descartado en D-5. Ponerlo en la fila de acciones de `PageHeader`: no queda arriba a la derecha y se desplaza con la página. | RF-4 |
| **DP-15** | **Respaldo formato v2.** Todo lo nuevo es aditivo y solo aparece si no es el valor predeterminado, pero **se sube `formatVersion` a 2** para que una versión anterior de la app rechace el respaldo en lugar de perder el estilo en silencio (CL-15). El lector acepta 1 y 2. | Seguir en v1: una app antigua restauraría sin estilo ni crédito sin avisar. | RNF-5, CL-14, CL-15 |
| **DP-16** | El **oscurecido** es un degradado de negro de transparente (arriba) a `alfa = oscurecido / 100` en el 55 % inferior. El valor predeterminado es **60**, que da contraste AA (≥ 4,5:1) al texto blanco incluso sobre una imagen totalmente blanca (sección 6.3). Por debajo de 55 con el título sobre la portada, el menú muestra el aviso de CL-3. | Analizar la luminancia de cada imagen: más complejo y no cambia la regla; queda como mejora futura. | RF-1.7, RF-3.3, RNF-3, CL-3 |

---

## 3. Dependencias nuevas
**Ninguna dependencia npm ni Rust.** Se reutilizan Radix (popover, tabs, toggle-group), BlockNote, Yjs, el puerto `Keychain` con `keyring` y el almacén de archivos.

Se añaden **siete archivos de fuente** woff2 variables, con subconjunto latino y licencia OFL, a `packages/ui/src/design/fonts/`: Geist, Nunito, Lora, Merriweather, Fira Code, Atkinson Hyperlegible Next y Caveat (Inter, Source Serif 4 y JetBrains Mono ya están). Son recursos, no dependencias, pero se justifican aquí porque cuentan para el tamaño (RNF-6): estimación de 0,9 a 1,6 MB en total, comprobada en el Hito 0. Cada `@font-face` usa `font-display: swap`; el navegador solo carga las fuentes que una página usa.

---

## 4. Modelo de datos **[RF-1 a RF-8, RNF-5, CL-14]**

### 4.1 `PageStyle` (columna `pages.style`, JSON estable o `NULL`)
Todas las claves son opcionales; ausente significa «Predeterminado» (D-11) o, en la cabecera, el estilo clásico actual.

```
PageStyle {
  header?: {
    titleOverCover?: boolean      // RF-1.1   (predet.: false)
    description?: boolean         // RF-1.3   (predet.: true si hay descripción)
    tag?: boolean                 // RF-1.3   (predet.: false)
    tagText?: string              // RF-1.4   1–32 caracteres; ausente = nombre del espacio
    updated?: boolean             // RF-1.5   (predet.: false)
    iconOverlap?: boolean         // RF-1.3   (predet.: false)
    gradient?: boolean            // RF-1.3   (predet.: true si titleOverCover)
    rounded?: boolean             // RF-1.3   (predet.: false)
  }
  cover?: {
    height?: "low" | "medium" | "high"            // RF-3.2  160 / 240 / 340 px
    posX?: number, posY?: number                  // RF-3.1  0–100 (%), predet. 50
    overlay?: number                              // RF-3.3  0–100, predet. 60
    radius?: number | [number, number, number, number]  // RF-3.4  0–48 px; [sup-izq, sup-der, inf-der, inf-izq]
  }
  typography?: { body?: FontId, headings?: FontId }         // RF-5
  spacing?: {
    width?: "narrow" | "normal" | "wide" | "full"          // RF-6.1  600 / 720 / 960 / sin límite
    textSize?: "small" | "normal" | "large"                // RF-6.3  14 / 16 / 18 px
    leading?: "compact" | "normal" | "relaxed"             // RF-6.4  1,45 / 1,625 / 1,85 y separación 0,5 / 0,75 / 1,1 em
  }
  toc?: { floating?: boolean, maxLevel?: 1 | 2 | 3 }      // RF-7.1, RF-7.8 (predet.: true, 3)
  accent?: PaletteId                                        // RF-8.2 (paleta de la app, D-21)
}
FontId = "inter" | "geist" | "nunito" | "source-serif" | "lora" | "merriweather"
       | "jetbrains-mono" | "fira-code" | "atkinson" | "caveat"     // D-16
```

Reglas del núcleo (`pages/style.ts`):
- `parseStyle(text)`: JSON inválido → `{}` (la página se ve en el estilo predeterminado, nunca falla); valores fuera de rango se **recortan** al rango; claves desconocidas se descartan.
- `normalizeStyle(s)`: quita claves con el valor predeterminado y objetos vacíos; `{}` se guarda como `NULL`. Garantiza que dos estilos equivalentes produzcan el mismo texto (respaldo determinista).
- `applyStylePatch(s, patch)`: mezcla profunda y luego `normalizeStyle`.

**Ejemplo** (la cabecera de la captura de referencia, fuente Lora en títulos y ancho amplio):
```json
{
  "cover": { "height": "high", "posY": 35, "radius": 24 },
  "header": { "iconOverlap": true, "rounded": true, "tag": true, "titleOverCover": true, "updated": true },
  "spacing": { "width": "wide" },
  "toc": { "maxLevel": 2 },
  "typography": { "headings": "lora" }
}
```

### 4.2 Columnas nuevas de `pages` (migración 14) **[RF-1.2, RF-2.5, RF-8.1, RF-6.2]**
| Columna | Tipo | Contenido |
|---|---|---|
| `style` | TEXT NULL | `PageStyle` normalizado (4.1). |
| `description` | TEXT NULL | Hasta 280 caracteres, sin saltos de línea. |
| `locked` | INTEGER NOT NULL DEFAULT 0 | 1 = bloqueada. |
| `cover_credit` | TEXT NULL | JSON `{ "source": "unsplash", "photoId", "author", "authorUrl", "photoUrl" }`, solo si la portada viene de Unsplash. |

Migración 14 «estilo de página», en una transacción: añade las cuatro columnas y ejecuta `UPDATE pages SET style = '{"spacing":{"width":"full"}}' WHERE full_width = 1`. Antes de migrar se ejecuta el respaldo previo de siempre (`beforeMigrate`).

`setField` admite `style`, `description`, `locked`, `cover`, `cover_credit` y actualiza `updated_at` (RF-1.5). Cambiar `cover` a algo que no sea `asset:` pone `cover_credit = NULL` en la misma escritura. `duplicate` copia las cuatro columnas nuevas. Crear una página copia `page.default.style` (DP-7).

### 4.3 Gramática de `cover` **[RF-2, DP-3]**
```
cover := "gradient:" nombre          ; sand|sage|sky|lavender|rose|graphite (actual)
       | "color:#" hex6              ; actual
       | "lgrad:" ángulo ":" hex6 "," hex6 ["," hex6]   ; ángulo 0–359
       | "asset:" sha256             ; imagen del almacén
```
`parseCover` (núcleo) devuelve una unión con tipo o `null` si el texto no es válido; la interfaz trata `null` como «sin portada» (nunca falla al pintar).

### 4.4 Predeterminado del espacio **[RF-8.5]**
`meta['page.default.style']` = `PageStyle` normalizado. Lectura con `parseStyle`; un valor dañado se ignora (igual que `diagram.default.*`).

---

## 5. Portadas **[RF-2, RF-3, CL-1, CL-2, CL-5 a CL-10]**

### 5.1 Entrada de imagen (subir, arrastrar, pegar) **[RF-2.2, RF-2.3, CL-1, CL-7]**
```
importCoverImage(file):
  bytes ← leer archivo
  v ← core.validateCoverInput(bytes, file.size)        // formato por bytes mágicos, no por extensión
  si v.error: avisar(v.error); terminar                 // portada anterior intacta (RF-2.3)
  bitmap ← createImageBitmap(blob, { imageOrientation: "from-image" })   // si falla → "imagen dañada"
  { w, h } ← core.coverOutputSize(bitmap.width, bitmap.height)            // ancho ≤ 2560, sin agrandar
  jpeg ← en worker: OffscreenCanvas(w, h) → fondo blanco → drawImage → convertToBlob(jpeg, 0.85)
  { hash } ← assetStore.put(jpeg)                       // dedup por contenido (CL-5)
  si bitmap.width < 1200: aviso "puede verse borrosa"   // CL-1
  setPageProps({ cover: "asset:" + hash, coverCredit: null })   // entra al historial (DP-8)

validateCoverInput(bytes, size):
  si size > 20 MB → error "tooLarge"
  tipo ← sniff(bytes)    // PNG 89 50 4E 47 · JPEG FF D8 FF · WebP "RIFF....WEBP"
  si tipo ∉ {png, jpeg, webp} → error "unsupported"
  ok

coverOutputSize(w, h):
  si w ≤ 2560: devolver (w, h)
  devolver (2560, round(h × 2560 / w))
```
El fondo blanco aplana la transparencia de PNG y WebP (JPEG no la admite). Mientras se procesa, la cabecera muestra un indicador de progreso y la interfaz no se bloquea (RNF-4). Si `OffscreenCanvas` no está disponible en un *worker* (se verifica en el Hito 0), se usa un canvas en el hilo principal tras ceder el turno con `requestIdleCallback` / `setTimeout`.

### 5.2 Colores y degradados **[RF-2.7]**
Pestaña Colores: la paleta de la app + selector de color propio (`ColorPicker` existente) → `color:#hex`. Pestaña Degradados: los seis degradados actuales + editor con 2 o 3 colores y ángulo (`Segmented` con 0°, 45°, 90°, 135°, 180° y control fino) → `lgrad:…`.

### 5.3 Ajustes **[RF-3]**
- **Reposicionar:** el botón «Reposicionar» activa un modo con cursor de arrastre; arrastrar cambia `posX/posY` (porcentaje para `object-position`) en vivo; «Guardar» confirma una sola entrada de historial, «Cancelar» o Esc descartan. Teclado: flechas ±1 %, Mayús+flechas ±10 % (RNF-3).
- **Altura:** `Segmented` baja, media y alta.
- **Oscurecido:** deslizador de 0 a 100 con vista previa; aviso de CL-3 según DP-16.
- **Esquinas:** deslizador único de 0 a 48 px con un botón «Esquinas por separado» que muestra cuatro deslizadores; al volver a unirlas se usa el valor de la esquina superior izquierda.
- Cada ajuste confirmado (al soltar el deslizador, no en cada movimiento) es una entrada del historial (RF-3.5).

### 5.4 Limpieza de archivos **[RF-2.8, DP-9]**
```
gcAssets(workspace):                          // al abrir el espacio, en segundo plano
  refs ← conjunto vacío
  para cada página (incluidas las de la papelera):
     refs += parseAssetRef(page.cover)
     refs += assetRefsIn(texto del documento Yjs de la página)      // busca "asset:<64 hex>"
  refs += assetRefsIn(cada JSON guardado de bases de datos y meta)
  si cualquier lectura falla: terminar sin borrar
  para cada hash en assetStore.list():
     si hash ∉ refs: assetStore.delete(hash)
```
Se ejecuta al abrir (no durante la sesión), así el historial de la sesión puede volver a una portada anterior cuyo archivo sigue en el almacén. Las páginas en la papelera conservan sus archivos (CL-6) hasta su borrado definitivo.

---

## 6. Cabecera tipo tarjeta **[RF-1, CL-4, CL-17, D-20]**

### 6.1 Estructura
`PageHeader` se divide en `CoverHeader` (portada con capas) y la cabecera clásica actual. Regla de elección:
```
modo ← (style.header.titleOverCover y página tiene portada) ? "tarjeta" : "clásico"   // RF-1.6
```
En modo tarjeta, dentro de la portada y alineados abajo: fila de etiqueta + fecha, título (textarea que crece, CL-4), descripción (dos líneas con puntos suspensivos fuera de edición, CL-4). El ícono que sobresale se coloca a caballo del borde inferior dentro de un cuadro claro de 56 px con esquinas redondeadas (D-20). En modo clásico, la descripción va bajo el título si está activa.

### 6.2 Piezas
- **Etiqueta** (RF-1.4): `Chip` translúcido con `tagText` o el nombre del espacio.
- **Fecha** (RF-1.5): reutiliza la función de tiempo relativo de `HeaderBar`; el texto exacto va en `title` y en un `Tooltip` accesible por foco.
- **«Cambiar portada»**: botón translúcido arriba a la derecha de la portada, visible al pasar el puntero o con foco dentro de la cabecera (RF-1.7); en pantallas táctiles siempre visible.
- **Crédito de Unsplash** (RF-2.5): texto pequeño abajo a la derecha de la portada, con enlaces al autor y a Unsplash.

### 6.3 Legibilidad **[RF-1.7, RNF-3, DP-16]**
Texto blanco con sombra suave sobre el oscurecido. Cálculo del valor predeterminado: el peor caso es una imagen blanca; con negro de alfa α encima, el fondo tiene valor `255·(1−α)`. Para contraste ≥ 4,5:1 con blanco hace falta una luminancia ≤ 0,183, que se alcanza con `1−α ≤ 0,46`, es decir **α ≥ 0,54**. El predeterminado 60 deja margen; la zona del texto está siempre en el tramo de alfa máximo.

---

## 7. Menú de opciones del archivo **[RF-4 a RF-6, RF-8]**

### 7.1 Estructura **[RF-4.1, RF-4.2, RF-4.4, DP-14]**
Botón «Opciones de la página» en el extremo derecho de `HeaderBar`. `Popover` de 320 px (ancho completo en pantallas estrechas, CL-17), con desplazamiento interno y estas secciones:

| Sección | Controles |
|---|---|
| Tipografía | Fuente del texto y de los títulos: lista con «Predeterminado» + 10 fuentes, cada nombre escrito en su fuente (RF-5.2). |
| Espaciado | Ancho (4 + Predeterminado), tamaño de texto (3 + Predeterminado), interlineado (3 + Predeterminado). |
| Cabecera y portada | Interruptores de RF-1.3, texto de la etiqueta, y accesos a «Cambiar portada» y a los ajustes de la sección 5.3. |
| Índice | Índice flotante (interruptor) y niveles (hasta H1, H2 o H3). |
| Página | Bloquear, color de acento, estadísticas (solo lectura), «Restablecer estilo», «Usar como predeterminado». |

Radix aporta el foco atrapado, Esc, el clic fuera y la devolución del foco al botón.

### 7.2 Aplicar el estilo **[RF-4.3, RF-5.3, RF-6.5, DP-5]**
```
cssVarsFor(style, appearance):          // núcleo devuelve valores; la interfaz los pone en el contenedor
  vars ← {}
  si style.typography.body: vars["--font-content"] = fontStack(body)
  vars["--font-headings"] = style.typography.headings ? fontStack(headings) : "var(--font-content)"
  si style.spacing.textSize: vars["--text-reading-size"], ["--text-reading-line"] = escala(textSize)
  si style.spacing.leading:  vars["--text-reading-line"] *= factor(leading); vars["--block-gap"] = gap(leading)
  si style.spacing.width:    vars["--size-reading-width"] = ancho(width)    // "full" → none
  si style.accent:           vars["--c-accent"…] = tokens del acento según el tema
  devolver vars                          // lo ausente hereda de <html> (apariencia global)
```
Los valores de cada opción viven como tokens en `design/tokens.ts` (fuente única, ya genera `tokens.css`).

### 7.3 Opciones de página **[RF-8]**
- **Bloquear** (RF-8.1, DP-13): indicador con candado en la cabecera, que desbloquea con un clic.
- **Acento** (RF-8.2, D-21): muestras de la paleta; los tokens de acento de cada color tienen variantes clara y oscura verificadas por la prueba de contraste existente.
- **Estadísticas** (RF-8.3): `core.pageStats(blocks)`:
  ```
  texto ← concatenar el texto de todos los bloques (incluidos código y celdas)
  palabras ← contar segmentos con isWordLike de Intl.Segmenter("es", { granularity: "word" })
  caracteres ← contar grafemas que no son salto de línea
  lectura ← palabras = 0 ? 0 : max(1, ceil(palabras / 200)) minutos
  ```
  Se recalcula al abrir el menú (no en cada pulsación). Las fechas salen de `created_at` y `updated_at`.
- **Restablecer estilo** (RF-8.4): `style ← NULL` en una entrada del historial; no toca `cover`, `description`, `locked` ni el contenido.
- **Usar como predeterminado** (RF-8.5, DP-7): escribe `meta['page.default.style']` y confirma con un aviso.

### 7.4 Historial **[RF-4.6, DP-8]**
```
PageProps = { cover, coverCredit, style, description, locked }
setPageProps(pageId, patch):
  antes ← props actuales
  escribir patch en SQLite (una transacción)
  history[pageId].push(antes)        // Snapshots<PageProps>, límite 100
undoPageProps(pageId): escribir history.undo(actual)    // y redo simétrico
```
Escribir varias props en una sola acción (por ejemplo, portada + crédito) es una sola entrada.

---

## 8. Índice **[RF-7, CL-12, CL-13, D-18]**

### 8.1 Núcleo
`core/pages/toc.ts` (movido desde la interfaz): `extractHeadings(blocks, maxLevel)` → `[{ blockId, level, text }]`. Cada entrada usa el **id del bloque**, así los encabezados repetidos no se confunden (CL-13).

### 8.2 Índice flotante
`TableOfContents` existente + `style.toc.floating` (predeterminado: activado, así nada cambia para las páginas actuales) + filtro de niveles. En pantallas anchas va en el margen derecho; si no cabe (RF-7.7), usa su modo reducido actual (`Popover`). Con muchos encabezados, la lista tiene desplazamiento propio y el resaltado de la sección visible usa un `IntersectionObserver` en lugar de recalcular en cada evento de desplazamiento (CL-12).

### 8.3 Bloque `toc`
Bloque propio en `editor/schema.tsx`, sin propiedades: lee la lista de encabezados del mismo origen (actualizada con el *debounce* de 800 ms existente) y la pinta como enlaces. Sin encabezados muestra «Agrega encabezados para ver el índice» (RF-7.6). Entrada en el menú «/» como «Índice». Exportación: Markdown como lista anidada de enlaces `[texto](#ancla)`; HTML igual.

---

## 9. Unsplash **[RF-2.4 a RF-2.6, RF-9, D-14, D-15]**

### 9.1 Contrato del cliente (núcleo, `fetch` inyectado)
| Operación | Petición | Resultado |
|---|---|---|
| `search(query, page)` | `GET https://api.unsplash.com/search/photos?query=…&page=…&per_page=24&orientation=landscape` con cabeceras `Authorization: Client-ID <clave>` y `Accept-Version: v1` | `{ results: [{ id, thumbUrl, rawUrl, downloadLocation, author, authorUrl, photoUrl, width, height }], totalPages }` |
| `trackDownload(photo)` | `GET <downloadLocation>` con la misma autorización | sin resultado útil (requisito de Unsplash) |
| `download(photo)` | `GET <rawUrl>&w=2560&fm=jpg&q=85` (sin autorización, en `images.unsplash.com`) | bytes de la imagen |

Errores con tipo: `offline` (fallo de red), `unauthorized` (401), `rateLimited` (403 o `X-Ratelimit-Remaining: 0`), `server` (5xx), cada uno con un mensaje en `es-MX` y `en` (RF-2.6). La clave nunca se escribe en registros ni en mensajes de error.

### 9.2 Clave y activación
- `UnsplashKeyStore` copia el patrón de `GitHubTokenStore` (recorta espacios, detecta llavero no disponible). Cuenta: `unsplash-access-key`.
- En Ajustes > Privacidad: interruptor «Activar Unsplash» (preferencia del dispositivo, apagado por defecto), explicación de lo que sale del equipo (RF-9.1), campo de clave y enlace a la página de desarrolladores de Unsplash.
- **Web:** el llavero es solo de memoria, así que la clave se pierde al recargar; la pestaña lo explica y la vuelve a pedir (limitación conocida, coherente con el token de GitHub en la web).
- Mientras el interruptor está apagado, la pestaña Unsplash no se monta y el cliente no se crea (RF-9.4).

### 9.3 Flujo de elección **[DP-11]**
```
elegirFoto(photo):
  mostrar progreso en la cabecera
  intentar:
     client.trackDownload(photo)
     bytes ← client.download(photo)
  si falla: avisar; portada intacta (CL-8); terminar
  continuar como importCoverImage con bytes (5.1)
  setPageProps({ cover: "asset:" + hash, coverCredit: { source: "unsplash", photoId, author, authorUrl + utm, photoUrl + utm } })
```
Las miniaturas se muestran directamente desde `images.unsplash.com` (solo mientras la pestaña está abierta). Al desactivar Unsplash, las portadas ya guardadas y su crédito siguen visibles (CL-10); si se borra la clave, la pestaña la pide de nuevo (CL-9).

---

## 10. Bloqueo **[RF-8.1, RF-8.1.1, CL-11, DP-13]**
Mientras `locked = 1`: `BlockNoteView editable={false}` (cubre teclado, pegar y arrastrar); título, descripción y etiqueta de solo lectura; «Cambiar portada», reposicionar y el menú «/» ocultos; las opciones de estilo **sí** se pueden cambiar desde el menú (no tocan el contenido). Cualquier intento de escribir muestra el indicador con un pequeño aviso «Página bloqueada». Las vistas de base de datos siguen editando propiedades (D-17).

---

## 11. Respaldo, restauración y exportación **[RNF-5, RNF-8, CL-14, CL-15, DP-15]**
- **`workspace.json`:** `formatVersion: 2`.
- **`data/<id>.json`:** nuevos campos opcionales `style` (objeto normalizado), `description`, `locked: true`, `coverCredit`; cada uno solo si no es el valor predeterminado. `fullWidth` deja de escribirse.
- **`page-defaults.json`:** opcional, solo si existe `page.default.style`.
- **Archivos:** las portadas ya viajan en `assets/<sha256>` como cualquier archivo; tras la limpieza (DP-9) solo viajan los que se usan.
- **Restaurar v1:** `fullWidth: true` → `style.spacing.width = "full"`; sin campos nuevos → estilo predeterminado (CL-14). **Restaurar v2 en una app v1:** la app antigua ya rechaza versiones nuevas con su aviso (CL-15).
- **Validación al restaurar:** `style` pasa por `parseStyle`; `cover` por `parseCover`; `coverCredit` por un validador con lista de claves; `description` se recorta a 280.
- **Markdown legible:** debajo del título, la descripción en cursiva; el bloque `toc` como lista de enlaces (RNF-8). El estilo no aparece en el Markdown.
- `docs/backup-format.md` se actualiza con la sección «Cambios del formato v2».
- **Determinismo:** `normalizeStyle` + `stableJson` garantizan que el mismo estado produzca los mismos bytes; un respaldo sin cambios no genera commit. El paso a v2 produce un único commit (cambia `workspace.json` y las páginas que tenían `fullWidth`).

---

## 12. Estructura de módulos (sin código)

### 12.1 Núcleo `packages/core/src/`
| Módulo | Contenido | Cubre |
|---|---|---|
| `pages/style.ts` | `PageStyle`, `FontId`, `parseStyle`, `normalizeStyle`, `applyStylePatch`, `cssVarsFor` (valores, no DOM) | RF-1, RF-3, RF-5, RF-6, RF-8.2 |
| `pages/cover.ts` | Gramática `parseCover` / `formatCover`, `parseCoverCredit` | RF-2, RF-2.5 |
| `pages/coverImage.ts` | `validateCoverInput`, `coverOutputSize` | RF-2.2, RF-2.3 |
| `pages/pageDefaults.ts` | Leer y escribir `page.default.style` | RF-8.5 |
| `pages/pageProps.ts` | `PageProps`, `setPageProps`, historial con `Snapshots<T>` | RF-3.5, RF-4.6, RF-8.4 |
| `pages/stats.ts` | `pageStats` | RF-8.3 |
| `pages/toc.ts` | `extractHeadings(blocks, maxLevel)` (movido desde la interfaz) | RF-7 |
| `pages/pagesRepo.ts` | Columnas nuevas, `setField` ampliado, `duplicate` y creación con predeterminado | RF-1.2, RF-6.2, RF-8.1 |
| `db/migrations.ts` | Migración 14 | RF-6.2, CL-14 |
| `assets/gc.ts` | `collectAssetRefs`, `gcAssets` | RF-2.8 |
| `unsplash/client.ts`, `unsplash/keyStore.ts` | Cliente con `FetchLike`, errores con tipo, clave en el llavero | RF-2.4 a RF-2.6, RF-9 |
| `backup/serialize.ts`, `restore.ts`, `markdown.ts` | Formato v2, `page-defaults.json`, descripción y bloque `toc` | RNF-5, RNF-8 |

### 12.2 Interfaz `packages/ui/src/`
| Módulo | Contenido |
|---|---|
| `page/CoverHeader.tsx`, `page/PageHeader.tsx` | Modo tarjeta y clásico, piezas, crédito, indicador de bloqueo |
| `page/cover/CoverPicker.tsx` | Pestañas Subir, Unsplash, Colores, Degradados |
| `page/cover/CoverAdjust.tsx` | Reposicionar, altura, oscurecido, esquinas |
| `page/cover/imageWorker.ts`, `page/cover/optimize.ts` | Decodificar y codificar (DOM y *worker*) |
| `page/options/PageOptionsMenu.tsx` | Menú y sus cinco secciones |
| `page/PageStyleScope.tsx` | Aplica `cssVarsFor` al contenedor de la página |
| `page/TableOfContents.tsx`, `editor/blocks/TocBlock.tsx` | Índice flotante con opciones y bloque `toc` |
| `layout/HeaderBar.tsx` | Botón del menú |
| `settings/PrivacyPanel.tsx` (o sección de Ajustes existente) | Activar Unsplash y clave |
| `design/tokens.ts`, `design/fonts/`, `design/fonts.css` | Tokens de ancho, tamaño, interlineado y acento; 7 fuentes nuevas |
| `i18n/es-MX.ts`, `i18n/en.ts` | Textos nuevos (`page.cover.*`, `page.options.*`, `settings.unsplash.*`) |

### 12.3 Adaptadores
Sin cambios de interfaz: `Keychain` y `AssetStore` ya cubren lo necesario. `apps/desktop` y `apps/web` solo crean el `UnsplashClient` con su `fetchLike` existente.

---

## 13. Hitos de entrega **[art. 2]**
| Hito | Contenido | Cierre |
|---|---|---|
| **0 — Verificaciones** | Código desechable en `spikes/`, resultados en `spikes/RESULTS-estilo.md`: (a) redimensionar y codificar a JPEG una imagen de 20 MB en un *worker* con `OffscreenCanvas` en WebKitGTK (Tauri, Linux) y Chromium, medir tiempo; (b) `fetch` a `api.unsplash.com` e `images.unsplash.com` desde el webview de Tauri y desde la web (CORS); (c) peso real de las 7 fuentes; (d) cambiar `editable` de BlockNote en vivo sin perder la posición del cursor ni el estado de Yjs. | Si (a) o (b) fallan sin arreglo, **se detiene y se pregunta** antes de cambiar el diseño. |
| **1 — Núcleo y datos** | `style.ts`, `cover.ts`, `coverImage.ts`, `pageDefaults.ts`, `pageProps.ts`, `stats.ts`, `toc.ts`, migración 14, repositorio, limpieza de archivos, respaldo v2 y restauración, `backup-format.md`. | Pruebas del núcleo en verde; respaldo v1 → v2 sin pérdida. |
| **2 — Portada y cabecera** | Selector de portada (sin Unsplash), optimización, ajustes, cabecera tarjeta y clásica, descripción, etiqueta, fecha, ícono que sobresale. | RF-1 a RF-3 demostrados. |
| **3 — Menú de opciones e índice** | Menú, tipografía y fuentes, espaciado, acento, bloqueo, estadísticas, restablecer, predeterminado, historial; índice flotante con opciones y bloque `toc`. | RF-4 a RF-8 demostrados. |
| **4 — Unsplash** | Ajustes, clave, cliente, pestaña, crédito, prueba de privacidad ampliada. | RF-2.4 a RF-2.6 y RF-9; privacidad en verde. |
| **5 — Cierre** | Accesibilidad (axe y teclado), rendimiento, e2e completos, matriz de cobertura, revisión de textos en `en`. | Criterios de finalización 1 a 10 de la spec. |

---

## 14. Estrategia de pruebas **[art. 4, RNF-1 a RNF-8]**

### 14.1 Unitarias del núcleo (Vitest)
- `parseStyle` / `normalizeStyle`: valores fuera de rango, claves desconocidas, JSON dañado, equivalencia (dos entradas equivalentes → mismo texto), `{}` → `NULL`.
- `parseCover`: cada forma de la gramática, ángulos y colores inválidos, compatibilidad con los valores actuales.
- `validateCoverInput`: PNG, JPEG y WebP por bytes mágicos; extensión engañosa; 20 MB exactos y 20 MB + 1 byte; archivo vacío. `coverOutputSize`: imágenes pequeñas no se agrandan, proporción conservada.
- Migración 14: `full_width = 1` → `style` con ancho «full»; páginas sin ancho completo quedan con `style = NULL`; se ejecuta sobre una base con datos de la versión 13.
- Repositorio: `setField` de cada columna nueva actualiza `updated_at`; cambiar a una portada que no es imagen borra el crédito; `duplicate` copia todo; crear página copia el predeterminado; cambiar el predeterminado no altera páginas existentes.
- Historial de propiedades: deshacer y rehacer, límite 100, una entrada por acción compuesta, restablecer estilo se deshace.
- `pageStats`: español con acentos y emojis, código, página vacía (0 minutos), redondeo de lectura.
- `extractHeadings`: niveles 1–3, filtro de `maxLevel`, encabezados repetidos con ids distintos, sin encabezados.
- `gcAssets`: conserva lo referenciado por portada, documento, papelera y bases; borra lo huérfano; **no borra nada si una lectura falla**; idempotente.
- `UnsplashClient` con `fetch` simulado: forma de las peticiones y cabeceras, aviso de descarga antes de la descarga, cada tipo de error, la clave no aparece en ningún mensaje.
- `UnsplashKeyStore`: recortes, llavero no disponible, borrar.
- Respaldo: v2 con estilo, descripción, bloqueo, crédito y `page-defaults.json` → restaurar → idéntico; restaurar un v1 con `fullWidth`; mismo estado → mismos bytes; prueba dorada del Markdown con descripción y bloque `toc`; un estilo dañado en el respaldo se descarta sin abortar la restauración.

### 14.2 Interfaz (Vitest + Testing Library)
- Cabecera: modo tarjeta frente a clásico según la portada (RF-1.6); cada interruptor muestra u oculta su pieza; título y descripción editables sobre la portada; botón «Cambiar portada» solo con puntero o foco.
- Selector de portada: errores de formato y tamaño dejan la portada anterior; pestaña Unsplash oculta con Unsplash apagado; mensajes de cada error de Unsplash.
- Ajustes: reposicionar con teclado; esquinas unidas y separadas; aviso de oscurecido bajo.
- Menú: recorrido completo con teclado, Esc devuelve el foco; cada opción cambia la variable CSS correcta en el contenedor de la página y no en `<html>`; «Predeterminado» hereda del ajuste global.
- Bloqueo: el editor no acepta escritura ni pegado; el indicador desbloquea.
- Índice: niveles, entradas repetidas, bloque `toc` sin encabezados.
- Contraste: los tokens de acento de cada color pasan AA en tema claro y oscuro (prueba de contraste existente).
- axe sin violaciones en cabecera, selector y menú.

### 14.3 De extremo a extremo
- Flujo completo: subir una imagen → cabecera tarjeta → reposicionar → recargar → se conserva.
- Sin internet: la portada guardada (incluida una de Unsplash simulada) se ve.
- **Privacidad:** (1) con Unsplash apagado, el caso actual sin cambios (ninguna petición fuera del origen); (2) con Unsplash encendido y una búsqueda, solo peticiones a `api.unsplash.com` e `images.unsplash.com`, sin datos de páginas en las URL ni en los cuerpos; (3) el respaldo sigue llegando solo a `api.github.com`.
- Rendimiento: el menú se abre en menos de 100 ms; optimizar 20 MB no bloquea la interfaz (se mide que el hilo principal responde durante el proceso).
- Respaldo y restauración de punta a punta con portadas.

---

## 15. Matriz de cobertura

| Requisito | Secciones |
|---|---|
| RF-1.1 a RF-1.8 | 4.1, 6.1 a 6.3 |
| RF-2.1 a RF-2.3 | 4.3, 5.1, 5.2 |
| RF-2.4 a RF-2.6 | 9.1 a 9.3 |
| RF-2.7 | 5.2 |
| RF-2.8 | 5.4 |
| RF-3.1 a RF-3.5 | 5.3, 7.4 |
| RF-4.1 a RF-4.6 | 7.1, 7.2, 7.4 |
| RF-5.1 a RF-5.3 | 3, 4.1, 7.1, 7.2 |
| RF-6.1 a RF-6.5 | 4.1, 4.2, 7.2 |
| RF-7.1 a RF-7.8 | 8.1 a 8.3 |
| RF-8.1, RF-8.1.1 | 7.3, 10 |
| RF-8.2 a RF-8.5 | 4.4, 7.3 |
| RF-9.1 a RF-9.4 | 9.2, 14.3 |
| RNF-1 Sin internet | 5.1, 9.3, 14.3 |
| RNF-2 Privacidad | 9, 14.3 |
| RNF-3 Accesibilidad | 5.3, 6.3, 7.1, 14.2 |
| RNF-4 Rendimiento | 5.1, 8.2, 14.3 |
| RNF-5 Datos y respaldo | 4.2, 11 |
| RNF-6 Tamaño | 3, 5.1 |
| RNF-7 Idioma | 12.2 |
| RNF-8 Exportación | 8.3, 11 |
| CL-1, CL-2, CL-7 | 5.1, 5.3 |
| CL-3 | 6.3, DP-16 |
| CL-4 | 6.1 |
| CL-5, CL-6 | 5.4 |
| CL-8 a CL-10 | 9.2, 9.3 |
| CL-11 | 10 |
| CL-12, CL-13 | 8.1, 8.2 |
| CL-14, CL-15 | 4.2, 11 |
| CL-16 | 3 (`font-display` y pila de fuentes con alternativa) |
| CL-17 | 7.1, 8.2 |

---

## 16. Riesgos y fuera de alcance del plan
- **Riesgo aceptado (D-14):** la copia local de fotos de Unsplash puede no ajustarse del todo a sus condiciones.
- **Riesgo técnico:** WebKitGTK puede no tener `OffscreenCanvas` en *workers*; el Hito 0 lo verifica y la sección 5.1 define la alternativa.
- **Riesgo de datos:** la limpieza de archivos es el único borrado definitivo nuevo; por eso es conservadora (DP-9) y tiene las pruebas más estrictas.
- **Web sin llavero:** la clave de Unsplash no persiste en la web (9.2).
- La exportación HTML y PDF conserva su aspecto actual; incluir la cabecera tipo tarjeta en esas exportaciones queda para una spec futura.
