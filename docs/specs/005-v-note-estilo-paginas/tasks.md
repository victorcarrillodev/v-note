# Tareas 005 — Estilo de páginas: portadas, cabecera y opciones del archivo

> Deriva de `spec.md` y `plan.md` de esta carpeta. Cada tarea es pequeña (**máx. 20–30 min**), está en **orden de dependencia** y cubre uno o más RF/RNF/CL.
> **Regla de ejecución (TDD):** en cada tarea se escribe **primero la prueba** (debe fallar), luego la implementación, y se marca el checkbox solo cuando se cumple **«Hecho cuando»** y `bun run typecheck` y `bun run test` pasan (constitución, art. 4).
> Las verificaciones previas de la Fase 0 viven en `spikes/estilo/`, son desechables y sus resultados se anotan en `spikes/RESULTS-estilo.md`. Si una verificación falla, **se detiene el trabajo y se actualiza el plan** antes de seguir (AGENTS).
> **Fases cerradas en orden** (art. 2): no se empieza una fase hasta cerrar la anterior. Dentro de un grupo, el orden de las tareas es el de ejecución; **Requiere** indica de qué grupo depende.
> **Sin tareas manuales:** cada «Hecho cuando» se comprueba con una prueba, una medición anotada o un documento revisado.
> **Total:** 184 tareas · Fase 0: 11 · Fase 1: 63 · Fase 2: 40 · Fase 3: 37 · Fase 4: 24 · Fase 5: 9
> **Estado:** Fase 0 cerrada (11 de 184 tareas). Siguiente: Fase 1.

---

## FASE 0 — Verificaciones

### Verificaciones previas (código desechable en `spikes/estilo/`)

*Requiere: nada. Resultados en `spikes/RESULTS-estilo.md`.*

- [x] **E-001** Redimensionar una imagen de 20 MB y codificarla a JPEG 0,85 en un *worker* con `OffscreenCanvas` dentro de Tauri en Linux (WebKitGTK) — *Cubre:* RF-2.2, RNF-4 (DP-4). **Hecho cuando:** Tiempo medido y anotado; si `OffscreenCanvas` no existe en el *worker*, la alternativa en el hilo principal (sección 5.1 del plan) probada y medida.
- [x] **E-002** Repetir la prueba anterior en Chromium (versión web) — *Cubre:* RF-2.2, RNF-4. **Hecho cuando:** Tiempo medido y anotado en `RESULTS-estilo.md`.
- [x] **E-003** Comprobar que `createImageBitmap` con `imageOrientation: "from-image"` respeta la orientación EXIF en Tauri y en la web — *Cubre:* RF-2.2, CL-2. **Hecho cuando:** Foto vertical de prueba con EXIF girado sale derecha en ambos.
- [x] **E-004** Llamar a `api.unsplash.com/search/photos` con una clave de prueba desde el webview de Tauri y desde la web — *Cubre:* RF-2.4 (DP-10). **Hecho cuando:** Respuesta 200 en ambos, o el bloqueo de CORS anotado con su alternativa.
- [x] **E-005** Descargar una imagen de `images.unsplash.com` como `Blob` desde Tauri y desde la web — *Cubre:* RF-2.4 (DP-11). **Hecho cuando:** Bytes recibidos en ambos, o el problema anotado.
- [x] **E-006** Medir el peso de las 7 fuentes nuevas (woff2 variables, subconjunto latino) — *Cubre:* RF-5.1, RNF-6. **Hecho cuando:** Peso total anotado y menor de 5 MB; si no, fuente a sustituir propuesta.
- [x] **E-007** Confirmar licencia OFL y versión variable de Geist, Nunito, Lora, Merriweather, Fira Code, Atkinson Hyperlegible Next y Caveat — *Cubre:* RF-5.1 (D-16). **Hecho cuando:** Licencia y origen de cada una anotados.
- [x] **E-008** Cambiar `editable` de `BlockNoteView` en vivo y comprobar que no se pierde el estado de Yjs ni la posición del cursor — *Cubre:* RF-8.1 (DP-13). **Hecho cuando:** Spike indica funciona o falla; si falla, alternativa anotada.
- [x] **E-009** Confirmar que las vistas de base de datos editan propiedades sin pasar por el editor de la página — *Cubre:* RF-8.1.1 (D-17). **Hecho cuando:** Ruta de escritura de propiedades anotada.
- [x] **E-010** Medir la apertura de un `Popover` con cinco secciones y una lista de 11 fuentes con vista previa — *Cubre:* RNF-4. **Hecho cuando:** Tiempo de apertura anotado (objetivo menor de 100 ms).
- [x] **E-011** Cerrar la Fase 0: actualizar el plan con los resultados (DP-4, DP-10, DP-11, DP-13, sección 3) — *Cubre:* RNF-4, RNF-6. **Hecho cuando:** Plan actualizado y sin decisiones abiertas.

---

## FASE 1 — Núcleo y datos

### Estilo de página (`packages/core/src/pages/style.ts`)

*Requiere: Fase 0.*

- [x] **E-012** Tipos `PageStyle` y `FontId` y constantes de rangos y valores — *Cubre:* RF-1.3, RF-5.1, RF-6.1. **Hecho cuando:** `typecheck` pasa; test: `FONT_IDS` tiene las 10 fuentes de D-16.
- [x] **E-013** `parseStyle`: JSON inválido o vacío devuelve `{}` — *Cubre:* RF-4.5. **Hecho cuando:** Test con texto dañado, `null` y `""`.
- [x] **E-014** `parseStyle`: recorta al rango `posX`, `posY`, `overlay` y `radius` — *Cubre:* RF-3.1, RF-3.3, RF-3.4. **Hecho cuando:** Test con valores negativos y mayores al máximo.
- [x] **E-015** `parseStyle`: descarta claves desconocidas y valores de enumeración inválidos — *Cubre:* RNF-5. **Hecho cuando:** Test: `{"x":1,"spacing":{"width":"huge"}}` → `{}`.
- [x] **E-016** `parseStyle`: radio como número o como tupla de cuatro esquinas — *Cubre:* RF-3.4. **Hecho cuando:** Test de ambas formas y de tuplas de longitud incorrecta.
- [x] **E-017** `normalizeStyle`: quita los valores predeterminados y los objetos vacíos; `{}` se guarda como `NULL` — *Cubre:* RNF-5. **Hecho cuando:** Test: estilo con solo predeterminados → `null`.
- [x] **E-018** `normalizeStyle` es determinista: dos estilos equivalentes dan el mismo texto — *Cubre:* RNF-5. **Hecho cuando:** Test con claves en distinto orden.
- [x] **E-019** `applyStylePatch`: mezcla profunda y vuelta a «Predeterminado» al pasar `undefined` — *Cubre:* RF-5.3, RF-6.5. **Hecho cuando:** Test de mezcla y de borrado de una clave.
- [x] **E-020** `cssVarsFor`: fuentes del texto y de los títulos — *Cubre:* RF-5.2. **Hecho cuando:** Test: `body` y `headings` producen `--font-content` y `--font-headings`; sin `headings`, este hereda del texto.
- [x] **E-021** `cssVarsFor`: tamaño de texto, interlineado y separación entre bloques — *Cubre:* RF-6.3, RF-6.4. **Hecho cuando:** Test de los tres valores de cada opción.
- [x] **E-022** `cssVarsFor`: los cuatro anchos de contenido («completo» sin límite) — *Cubre:* RF-6.1. **Hecho cuando:** Test de los cuatro valores.
- [x] **E-023** `cssVarsFor`: acento de la paleta — *Cubre:* RF-8.2. **Hecho cuando:** Test: un `accent` produce las variables `--c-accent*`.
- [x] **E-024** `cssVarsFor`: una opción ausente no emite variable (hereda el ajuste global) — *Cubre:* RF-5.3, RF-6.5. **Hecho cuando:** Test: estilo `{}` → objeto vacío.
- [x] **E-025** Tokens de anchos, tamaños, interlineados, separación y alturas de portada en `design/tokens.ts`, y `tokens.css` regenerado — *Cubre:* RF-3.2, RF-6.1, RF-6.3, RF-6.4. **Hecho cuando:** Prueba de `build-css` actualizada y en verde.

### Portada: gramática y crédito (`packages/core/src/pages/cover.ts`)

*Requiere: estilo de página.*

- [x] **E-026** `parseCover` acepta los valores actuales `gradient:<nombre>` y `color:#hex` — *Cubre:* RF-2.7, CL-14. **Hecho cuando:** Test con cada degradado y un color.
- [x] **E-027** `parseCover` acepta `lgrad:<ángulo>:<hex>,<hex>[,<hex>]` y rechaza ángulos o colores inválidos — *Cubre:* RF-2.7. **Hecho cuando:** Test con 2 y 3 colores, ángulo 360 y color sin `#`.
- [x] **E-028** `parseCover` acepta `asset:<sha256>` validado con `isValidHash` — *Cubre:* RF-2.2. **Hecho cuando:** Test con hash válido, corto y con mayúsculas.
- [x] **E-029** `formatCover` es el inverso de `parseCover` — *Cubre:* RF-2.1. **Hecho cuando:** Test de ida y vuelta de cada forma.
- [x] **E-030** `parseCoverCredit`: lista de claves permitidas y solo URLs `https` — *Cubre:* RF-2.5. **Hecho cuando:** Test con claves de más, URL `http` y `javascript:`.

### Imagen de portada (`packages/core/src/pages/coverImage.ts`)

*Requiere: nada.*

- [x] **E-031** Detección de formato por bytes mágicos (PNG, JPEG, WebP) — *Cubre:* RF-2.2, RF-2.3. **Hecho cuando:** Test con los tres formatos y un GIF.
- [x] **E-032** `validateCoverInput`: límite de 20 MB, archivo vacío y extensión engañosa — *Cubre:* RF-2.3, CL-7. **Hecho cuando:** Test: 20 MB exactos pasa, 20 MB + 1 byte falla, `.png` con bytes de PDF falla.
- [x] **E-033** `coverOutputSize`: ancho máximo de 2560 px, sin agrandar y conservando la proporción — *Cubre:* RF-2.2, CL-1, CL-2. **Hecho cuando:** Test con 300×200, 2560×1440, 6000×4000 y 1000×4000.
- [x] **E-034** `isLowResolution`: aviso por debajo de 1200 px de ancho — *Cubre:* CL-1. **Hecho cuando:** Test en 1199 y 1200.

### Migración 14 y repositorio de páginas

*Requiere: estilo de página y portada.*

- [x] **E-035** Migración 14: añadir `style`, `description`, `locked` y `cover_credit` a `pages` — *Cubre:* RF-1.2, RF-2.5, RF-8.1. **Hecho cuando:** Test: columnas presentes y `locked` vale 0 por defecto.
- [x] **E-036** Migración 14: copiar `full_width = 1` a `style = {"spacing":{"width":"full"}}` — *Cubre:* RF-6.2, CL-14. **Hecho cuando:** Test sobre una base de la versión 13 con páginas con y sin ancho completo.
- [x] **E-037** Migración 14 en una base de la versión 13 con datos de todas las specs anteriores; el respaldo previo se ejecuta — *Cubre:* RNF-5. **Hecho cuando:** Test: ningún dato anterior cambia salvo `style`.
- [x] **E-038** Tipo `Page` y lectura de filas con `style`, `description`, `locked` y `coverCredit` — *Cubre:* RF-4.5. **Hecho cuando:** Test de lectura con valores y con `NULL`.
- [x] **E-039** `setField` admite las columnas nuevas y actualiza `updated_at` — *Cubre:* RF-1.5. **Hecho cuando:** Test: cada columna nueva cambia `updated_at`.
- [x] **E-040** `setDescription`: recorta a 280 caracteres y quita saltos de línea — *Cubre:* RF-1.2, CL-4. **Hecho cuando:** Test con 300 caracteres y con `\n`.
- [x] **E-041** Poner una portada que no es imagen borra `cover_credit` en la misma escritura — *Cubre:* RF-2.5. **Hecho cuando:** Test: de `asset:` con crédito a `color:` → crédito `NULL`.
- [x] **E-042** El repositorio deja de leer y escribir `full_width`; `setFullWidth` se elimina y sus usos pasan a `style` — *Cubre:* RF-6.1 (DP-6). **Hecho cuando:** `typecheck` pasa sin referencias a `setFullWidth`; prueba `fullWidth.test.ts` reescrita sobre `style`.
- [x] **E-043** `duplicate` copia `style`, `description`, `locked` y `cover_credit` — *Cubre:* RF-4.5. **Hecho cuando:** Test.

### Predeterminado del espacio (`pages/pageDefaults.ts`)

*Requiere: repositorio de páginas.*

- [ ] **E-044** Leer y escribir `meta['page.default.style']`; un valor dañado se ignora — *Cubre:* RF-8.5. **Hecho cuando:** Test con valor válido, dañado y ausente.
- [ ] **E-045** Crear una página copia el predeterminado; sin predeterminado queda en estilo clásico — *Cubre:* RF-8.5, D-10. **Hecho cuando:** Test de ambos casos.
- [ ] **E-046** Cambiar el predeterminado no altera las páginas existentes — *Cubre:* RF-8.5. **Hecho cuando:** Test.

### Historial de propiedades (`pages/pageProps.ts`)

*Requiere: repositorio de páginas.*

- [ ] **E-047** `PageProps` y `setPageProps` en una sola transacción — *Cubre:* RF-4.6. **Hecho cuando:** Test: un fallo a mitad no deja cambios a medias.
- [ ] **E-048** Historial por página con `Snapshots<PageProps>`: deshacer, rehacer y límite de 100 — *Cubre:* RF-3.5, RF-4.6. **Hecho cuando:** Test de 101 cambios y de deshacer y rehacer.
- [ ] **E-049** Una acción compuesta (portada + crédito) es una sola entrada del historial — *Cubre:* RF-2.5, RF-4.6. **Hecho cuando:** Test: un deshacer devuelve las dos.
- [ ] **E-050** Restablecer estilo: `style = NULL` en una entrada, sin tocar portada, descripción, bloqueo ni contenido — *Cubre:* RF-8.4. **Hecho cuando:** Test.

### Estadísticas (`pages/stats.ts`)

*Requiere: nada.*

- [ ] **E-051** Contar palabras con `Intl.Segmenter` (palabras con acentos, emojis y código) — *Cubre:* RF-8.3. **Hecho cuando:** Test con un texto en español de conteo conocido.
- [ ] **E-052** Contar caracteres por grafemas sin saltos de línea, incluidos código y celdas — *Cubre:* RF-8.3. **Hecho cuando:** Test con emojis compuestos y una tabla.
- [ ] **E-053** Tiempo de lectura: 0 en una página vacía, mínimo 1 minuto, `ceil(palabras / 200)` — *Cubre:* RF-8.3. **Hecho cuando:** Test con 0, 1, 200 y 201 palabras.

### Índice en el núcleo (`pages/toc.ts`)

*Requiere: nada.*

- [ ] **E-054** Mover `extractHeadings` de `packages/ui/src/page/toc.ts` al núcleo sin cambiar su comportamiento — *Cubre:* RF-7.1. **Hecho cuando:** Las pruebas actuales del índice pasan importando desde el núcleo.
- [ ] **E-055** Filtro de niveles `maxLevel` (1, 2 o 3) — *Cubre:* RF-7.8. **Hecho cuando:** Test con encabezados H1 a H3.
- [ ] **E-056** Cada entrada usa el id de su bloque, también con textos repetidos — *Cubre:* CL-13. **Hecho cuando:** Test con dos encabezados iguales.

### Limpieza de archivos (`assets/gc.ts`)

*Requiere: repositorio de páginas.*

- [ ] **E-057** `collectAssetRefs` de las portadas, incluidas las páginas en la papelera — *Cubre:* RF-2.8, CL-6. **Hecho cuando:** Test con una página viva y otra en la papelera.
- [ ] **E-058** `collectAssetRefs` de los documentos Yjs (texto `asset:<hash>`) — *Cubre:* RF-2.8. **Hecho cuando:** Test con una imagen dentro del contenido.
- [ ] **E-059** `collectAssetRefs` de las bases de datos y de `meta` — *Cubre:* RF-2.8. **Hecho cuando:** Test.
- [ ] **E-060** `gcAssets` borra los huérfanos y conserva los referenciados; es idempotente — *Cubre:* RF-2.8, CL-5. **Hecho cuando:** Test: la misma imagen en dos páginas no se borra al quitarla de una.
- [ ] **E-061** `gcAssets` no borra nada si falla cualquier lectura — *Cubre:* RF-2.8 (DP-9). **Hecho cuando:** Test con un documento ilegible: el almacén queda intacto.
- [ ] **E-062** Ejecutar `gcAssets` en segundo plano al abrir el espacio, en escritorio y en la web — *Cubre:* RF-2.8. **Hecho cuando:** Test de integración: abrir el espacio borra un huérfano sin bloquear el arranque.

### Respaldo formato v2 (`backup/`)

*Requiere: migración, predeterminado del espacio.*

- [ ] **E-063** `serialize`: `style`, `description`, `locked` y `coverCredit` solo si no son el valor predeterminado — *Cubre:* RNF-5. **Hecho cuando:** Test: una página sin estilo produce los mismos bytes que hoy, salvo `fullWidth`.
- [ ] **E-064** `serialize`: deja de escribir `fullWidth` y sube `formatVersion` a 2 — *Cubre:* RNF-5, CL-15. **Hecho cuando:** Test de `workspace.json`.
- [ ] **E-065** `serialize`: archivo opcional `page-defaults.json` — *Cubre:* RF-8.5, RNF-5. **Hecho cuando:** Test con y sin predeterminado.
- [ ] **E-066** `restore`: acepta las versiones 1 y 2 y rechaza las mayores — *Cubre:* CL-15. **Hecho cuando:** Test con `formatVersion` 1, 2 y 3.
- [ ] **E-067** `restore` de un respaldo v1: `fullWidth: true` pasa a ancho «completo» — *Cubre:* CL-14. **Hecho cuando:** Test con un respaldo v1 de muestra.
- [ ] **E-068** `restore` valida `style`, `cover`, `coverCredit` y `description`; un valor dañado se descarta sin abortar — *Cubre:* RNF-5. **Hecho cuando:** Test con cada campo dañado.
- [ ] **E-069** `restore` de `page-defaults.json` a `meta` — *Cubre:* RF-8.5. **Hecho cuando:** Test.
- [ ] **E-070** Ida y vuelta v2 sin pérdida; el mismo estado produce los mismos bytes y un respaldo sin cambios no genera commit — *Cubre:* RNF-5. **Hecho cuando:** Test.
- [ ] **E-071** Markdown legible: la descripción en cursiva bajo el título — *Cubre:* RNF-8. **Hecho cuando:** Prueba dorada actualizada.
- [ ] **E-072** `docs/backup-format.md`: sección «Cambios del formato v2» y pruebas de tolerancia actualizadas — *Cubre:* RNF-5, CL-15. **Hecho cuando:** Documento coincide con la sección 11 del plan; `formatTolerance.test.ts` en verde.

### Cierre de la Fase 1

*Requiere: todo lo anterior.*

- [ ] **E-073** Exportar desde `packages/core/src/index.ts` todo lo nuevo del núcleo — *Cubre:* RF-4.5. **Hecho cuando:** `index.test.ts` actualizado y en verde.
- [ ] **E-074** Revisar la fase: el núcleo no importa React, DOM ni Tauri — *Cubre:* RNF-5. **Hecho cuando:** Prueba de dependencias del núcleo en verde; `typecheck` y `test` pasan.

---

## FASE 2 — Portada y cabecera

### Textos y optimización de imágenes (interfaz)

*Requiere: Fase 1.*

- [ ] **E-075** Textos en `es-MX.ts` y `en.ts` para portada, ajustes y cabecera — *Cubre:* RNF-7. **Hecho cuando:** Prueba de claves i18n: sin claves faltantes en ninguno de los dos idiomas.
- [ ] **E-076** `imageWorker.ts`: `OffscreenCanvas` con fondo blanco y JPEG 0,85 — *Cubre:* RF-2.2. **Hecho cuando:** Test con un PNG transparente: sale JPEG con fondo blanco.
- [ ] **E-077** `optimize.ts`: alternativa en el hilo principal cuando no hay *worker* (según la Fase 0) — *Cubre:* RNF-4. **Hecho cuando:** Test con el *worker* simulado como no disponible.
- [ ] **E-078** `importCoverImage`: validar, decodificar, optimizar, guardar y llamar a `setPageProps` — *Cubre:* RF-2.2, RF-2.3. **Hecho cuando:** Test: un error en cualquier paso deja la portada anterior.
- [ ] **E-079** Indicador de progreso en la cabecera mientras se optimiza — *Cubre:* RNF-4. **Hecho cuando:** Test: el indicador aparece y desaparece; la página sigue respondiendo.
- [ ] **E-080** Aviso de imagen de baja resolución — *Cubre:* CL-1. **Hecho cuando:** Test con una imagen de 300 px.
- [ ] **E-081** Soltar o pegar una imagen sobre la cabecera la usa como portada — *Cubre:* CL-7. **Hecho cuando:** Test de arrastrar y de pegar.

### Selector de portada

*Requiere: textos y optimización.*

- [ ] **E-082** `CoverPicker` con las pestañas Subir, Colores y Degradados, y «Quitar portada» — *Cubre:* RF-2.1. **Hecho cuando:** Test: se abre desde «Cambiar portada» y se recorre con teclado.
- [ ] **E-083** Pestaña Subir: selector de archivos y mensajes de error — *Cubre:* RF-2.2, RF-2.3. **Hecho cuando:** Test con formato no admitido y archivo de 25 MB.
- [ ] **E-084** Pestaña Colores: paleta de la app y color propio — *Cubre:* RF-2.7. **Hecho cuando:** Test: elegir un color guarda `color:#hex`.
- [ ] **E-085** Pestaña Degradados: los seis actuales y editor de 2 o 3 colores con ángulo — *Cubre:* RF-2.7. **Hecho cuando:** Test: guarda `lgrad:` con los valores elegidos.
- [ ] **E-086** La portada pinta cualquier forma de `cover`; una inválida se trata como «sin portada» — *Cubre:* RF-2.1, CL-14. **Hecho cuando:** Test con cada forma y con un valor dañado.
- [ ] **E-087** El botón actual «añadir portada» (degradado al azar) abre el selector — *Cubre:* RF-2.1. **Hecho cuando:** Test.

### Ajustes de la portada

*Requiere: selector de portada.*

- [ ] **E-088** Altura: baja, media y alta — *Cubre:* RF-3.2. **Hecho cuando:** Test: cada valor cambia la altura de la portada.
- [ ] **E-089** Reposicionar arrastrando, con «Guardar», «Cancelar» y Esc — *Cubre:* RF-3.1, CL-2. **Hecho cuando:** Test: cancelar no cambia nada; guardar es una entrada del historial.
- [ ] **E-090** Reposicionar con teclado: flechas ±1 %, Mayús+flechas ±10 % — *Cubre:* RF-3.1, RNF-3. **Hecho cuando:** Test.
- [ ] **E-091** Oscurecido: deslizador de 0 a 100 con vista previa — *Cubre:* RF-3.3. **Hecho cuando:** Test: al soltar se guarda una sola vez.
- [ ] **E-092** Aviso de oscurecido bajo (menor de 55) con el título sobre la portada — *Cubre:* CL-3. **Hecho cuando:** Test en 54 y 55.
- [ ] **E-093** Esquinas: un valor para las cuatro o un valor por esquina — *Cubre:* RF-3.4. **Hecho cuando:** Test de separar y volver a unir.
- [ ] **E-094** Ctrl+Z fuera del editor deshace el último ajuste de la portada — *Cubre:* RF-3.5. **Hecho cuando:** Test.

### Cabecera tipo tarjeta

*Requiere: ajustes de la portada.*

- [ ] **E-095** Elegir modo tarjeta o clásico según `titleOverCover` y si hay portada — *Cubre:* RF-1.1, RF-1.6. **Hecho cuando:** Test de las cuatro combinaciones.
- [ ] **E-096** Modo tarjeta: título editable sobre la portada, que crece con el texto — *Cubre:* RF-1.8, CL-4. **Hecho cuando:** Test con un título de tres líneas.
- [ ] **E-097** Descripción editable; fuera de edición se corta en dos líneas — *Cubre:* RF-1.2, CL-4. **Hecho cuando:** Test.
- [ ] **E-098** Descripción bajo el título en el modo clásico — *Cubre:* RF-1.2. **Hecho cuando:** Test.
- [ ] **E-099** Etiqueta con el nombre del espacio o con un texto propio — *Cubre:* RF-1.4, D-13. **Hecho cuando:** Test de ambos casos.
- [ ] **E-100** Fecha de actualización relativa, con la fecha exacta al pasar el puntero o enfocar — *Cubre:* RF-1.5. **Hecho cuando:** Test con «hoy» y «hace 3 días».
- [ ] **E-101** Ícono que sobresale dentro de un cuadro claro redondeado — *Cubre:* RF-1.3, D-20. **Hecho cuando:** Test.
- [ ] **E-102** Interruptores de degradado y de esquinas redondeadas — *Cubre:* RF-1.3. **Hecho cuando:** Test.
- [ ] **E-103** Texto blanco con sombra; «Cambiar portada» solo con puntero o foco (siempre visible en táctil) — *Cubre:* RF-1.7. **Hecho cuando:** Test con puntero, foco y modo táctil.
- [ ] **E-104** Crédito de la foto abajo a la derecha de la portada cuando existe — *Cubre:* RF-2.5. **Hecho cuando:** Test con un `coverCredit` de muestra.
- [ ] **E-105** Prueba de contraste: el oscurecido predeterminado (60) da 4,5:1 o más con texto blanco sobre blanco — *Cubre:* RNF-3 (DP-16). **Hecho cuando:** Test del cálculo.
- [ ] **E-106** Cabecera adaptada a pantallas estrechas — *Cubre:* CL-17. **Hecho cuando:** Test con un ancho de 360 px.

### Menú de opciones (estructura y primera sección)

*Requiere: cabecera tipo tarjeta.*

- [ ] **E-107** Botón «Opciones de la página» en el extremo derecho de `HeaderBar`, solo con una página abierta — *Cubre:* RF-4.1. **Hecho cuando:** Test: aparece en una página y no en Ajustes.
- [ ] **E-108** `PageOptionsMenu`: `Popover` con las cinco secciones (vacías salvo la primera) — *Cubre:* RF-4.2. **Hecho cuando:** Test de estructura.
- [ ] **E-109** Teclado completo; Esc y el clic fuera cierran y devuelven el foco al botón — *Cubre:* RF-4.4. **Hecho cuando:** Test.
- [ ] **E-110** Sección «Cabecera y portada»: interruptores, texto de la etiqueta y accesos al selector y a los ajustes — *Cubre:* RF-1.3, RF-4.2. **Hecho cuando:** Test: cada interruptor cambia su pieza al instante.
- [ ] **E-111** Cada cambio del menú entra al historial y muestra el aviso «Deshacer» — *Cubre:* RF-4.6, D-19. **Hecho cuando:** Test.

### Cierre de la Fase 2

*Requiere: todo lo anterior.*

- [ ] **E-112** axe sin violaciones en cabecera, selector, ajustes y menú, en tema claro y oscuro — *Cubre:* RNF-3. **Hecho cuando:** Prueba en verde.
- [ ] **E-113** e2e: subir una imagen, pasar a modo tarjeta, reposicionar, recargar y comprobar que se conserva — *Cubre:* RF-1.1, RF-2.2, RF-3.1. **Hecho cuando:** Prueba e2e en verde.
- [ ] **E-114** e2e: sin red, la portada guardada se ve — *Cubre:* RNF-1. **Hecho cuando:** Prueba e2e en verde.

---

## FASE 3 — Menú de opciones e índice

### Fuentes y estilo aplicado

*Requiere: Fase 2.*

- [ ] **E-115** Añadir los 7 woff2 nuevos con `@font-face`, `font-display: swap` y sus licencias — *Cubre:* RF-5.1, CL-16. **Hecho cuando:** `fonts.test.ts`: cada `FontId` tiene `@font-face` y archivo con licencia.
- [ ] **E-116** Prueba de tamaño: el total de fuentes nuevas es menor de 5 MB — *Cubre:* RNF-6. **Hecho cuando:** Test en verde.
- [ ] **E-117** `PageStyleScope` pone las variables de `cssVarsFor` en el contenedor de la página, no en `<html>` — *Cubre:* RF-4.3 (DP-5). **Hecho cuando:** Test: `<html>` no cambia y el contenedor sí.
- [ ] **E-118** `--font-headings` se aplica al título y a los encabezados del editor — *Cubre:* RF-5.2. **Hecho cuando:** Test.
- [ ] **E-119** `--block-gap` se aplica a la separación entre bloques del editor — *Cubre:* RF-6.4. **Hecho cuando:** Test.

### Secciones del menú

*Requiere: fuentes y estilo aplicado.*

- [ ] **E-120** Tipografía: listas de fuente del texto y de los títulos, cada nombre escrito en su fuente, con «Predeterminado» — *Cubre:* RF-5.2, RF-5.3. **Hecho cuando:** Test.
- [ ] **E-121** Espaciado: ancho, tamaño de texto e interlineado, con «Predeterminado» — *Cubre:* RF-6.1, RF-6.3, RF-6.4, RF-6.5. **Hecho cuando:** Test: cada valor cambia la variable correcta.
- [ ] **E-122** Quitar el interruptor de ancho completo de `PageHeader` — *Cubre:* RF-6.1. **Hecho cuando:** Test: ya no existe; el ancho se elige en el menú.
- [ ] **E-123** Color de acento: muestras de la paleta con variantes clara y oscura — *Cubre:* RF-8.2, D-21. **Hecho cuando:** Prueba de contraste de los tokens de acento en verde.
- [ ] **E-124** El acento se aplica a enlaces, casillas, resaltados e índice de la página — *Cubre:* RF-8.2. **Hecho cuando:** Test.
- [ ] **E-125** Estadísticas en la sección Página, recalculadas al abrir el menú — *Cubre:* RF-8.3. **Hecho cuando:** Test.
- [ ] **E-126** «Restablecer estilo» con aviso «Deshacer» — *Cubre:* RF-8.4. **Hecho cuando:** Test: deshacer devuelve el estilo anterior.
- [ ] **E-127** «Usar como predeterminado» con aviso de confirmación — *Cubre:* RF-8.5. **Hecho cuando:** Test: una página nueva sale con ese estilo.
- [ ] **E-128** Ctrl+Z: al historial de Yjs si el foco está en el contenido y al de propiedades en cualquier otro lugar — *Cubre:* RF-4.6 (DP-8). **Hecho cuando:** Test de ambos casos.
- [ ] **E-129** Menú a ancho completo en pantallas estrechas — *Cubre:* CL-17. **Hecho cuando:** Test con 360 px.
- [ ] **E-130** Textos del menú en `es-MX.ts` y `en.ts` — *Cubre:* RNF-7. **Hecho cuando:** Prueba de claves i18n en verde.

### Bloqueo de página

*Requiere: secciones del menú.*

- [ ] **E-131** Interruptor «Bloquear página» en el menú (entra al historial) — *Cubre:* RF-8.1. **Hecho cuando:** Test.
- [ ] **E-132** Con la página bloqueada, `BlockNoteView` pasa a `editable={false}` — *Cubre:* RF-8.1, CL-11. **Hecho cuando:** Test: escribir, pegar y arrastrar no cambian el documento.
- [ ] **E-133** Título, descripción y etiqueta de solo lectura; «Cambiar portada», reposicionar y el menú «/» ocultos — *Cubre:* RF-8.1. **Hecho cuando:** Test.
- [ ] **E-134** Indicador con candado en la cabecera que desbloquea con un clic — *Cubre:* RF-8.1. **Hecho cuando:** Test.
- [ ] **E-135** Aviso «Página bloqueada» al intentar editar — *Cubre:* CL-11. **Hecho cuando:** Test.
- [ ] **E-136** Las vistas de base de datos siguen editando las propiedades de una página bloqueada; su celda de título queda de solo lectura (E-009) — *Cubre:* RF-8.1.1. **Hecho cuando:** Test con una tabla y un tablero: las propiedades cambian y el título no.

### Índice

*Requiere: Fase 1 (índice en el núcleo).*

- [ ] **E-137** `TableOfContents` usa la extracción del núcleo con `maxLevel` — *Cubre:* RF-7.8. **Hecho cuando:** Test.
- [ ] **E-138** Interruptor del índice flotante (activado por defecto) — *Cubre:* RF-7.1. **Hecho cuando:** Test: desactivado no se muestra.
- [ ] **E-139** Resaltado de la sección visible con `IntersectionObserver` — *Cubre:* RF-7.2, CL-12. **Hecho cuando:** Test.
- [ ] **E-140** La lista del índice flotante tiene desplazamiento propio — *Cubre:* CL-12. **Hecho cuando:** Test con 300 encabezados.
- [ ] **E-141** Modo reducido cuando no cabe en el margen — *Cubre:* RF-7.7, CL-17. **Hecho cuando:** Test a 900 px y a 360 px.
- [ ] **E-142** Bloque `toc` en `editor/schema.tsx` — *Cubre:* RF-7.4. **Hecho cuando:** Test: se inserta y se guarda.
- [ ] **E-143** El bloque `toc` muestra la lista viva y cada entrada lleva a su encabezado — *Cubre:* RF-7.3, RF-7.5. **Hecho cuando:** Test: añadir un encabezado actualiza el bloque.
- [ ] **E-144** Bloque `toc` sin encabezados: «Agrega encabezados para ver el índice» — *Cubre:* RF-7.6. **Hecho cuando:** Test.
- [ ] **E-145** Entrada «Índice» en el menú «/» — *Cubre:* RF-7.4. **Hecho cuando:** Test.
- [ ] **E-146** Sección «Índice» del menú: interruptor y niveles — *Cubre:* RF-7.8, RF-4.2. **Hecho cuando:** Test.
- [ ] **E-147** Exportación del bloque `toc`: Markdown como lista de enlaces y HTML igual — *Cubre:* RNF-8. **Hecho cuando:** Pruebas doradas de Markdown y HTML actualizadas.

### Cierre de la Fase 3

*Requiere: todo lo anterior.*

- [ ] **E-148** axe sin violaciones en el menú completo y en el índice — *Cubre:* RNF-3. **Hecho cuando:** Prueba en verde.
- [ ] **E-149** e2e: cambiar fuente, ancho y acento, recargar y comprobar que se conservan — *Cubre:* RF-4.3, RF-4.5. **Hecho cuando:** Prueba e2e en verde.
- [ ] **E-150** e2e: índice flotante y bloque de índice llevan a cada encabezado — *Cubre:* RF-7.3. **Hecho cuando:** Prueba e2e en verde.
- [ ] **E-151** Medir la apertura del menú y la aplicación de un cambio (menos de 100 ms) — *Cubre:* RNF-4. **Hecho cuando:** Medición en la prueba de rendimiento.

---

## FASE 4 — Unsplash

### Cliente y clave (núcleo)

*Requiere: Fase 3.*

- [ ] **E-152** `UnsplashClient.search`: URL, parámetros y cabeceras `Authorization` y `Accept-Version` — *Cubre:* RF-2.4. **Hecho cuando:** Test con `fetch` simulado.
- [ ] **E-153** Convertir la respuesta de búsqueda en resultados con autor, enlaces y tamaño — *Cubre:* RF-2.4. **Hecho cuando:** Test con una respuesta grabada.
- [ ] **E-154** `trackDownload` se llama antes de `download` — *Cubre:* RF-2.5, D-14. **Hecho cuando:** Test del orden de las llamadas.
- [ ] **E-155** `download` pide `w=2560&fm=jpg&q=85` sin cabecera de autorización — *Cubre:* RF-2.4 (DP-11). **Hecho cuando:** Test.
- [ ] **E-156** Errores con tipo: `offline`, `unauthorized`, `rateLimited` y `server` — *Cubre:* RF-2.6. **Hecho cuando:** Test de cada caso, incluido `X-Ratelimit-Remaining: 0`.
- [ ] **E-157** La clave nunca aparece en mensajes ni registros — *Cubre:* RF-9.2. **Hecho cuando:** Test: ningún error contiene la clave.
- [ ] **E-158** `UnsplashKeyStore` con la cuenta `unsplash-access-key` (patrón de `GitHubTokenStore`) — *Cubre:* RF-9.2. **Hecho cuando:** Test: recorta espacios, llavero no disponible y borrar.
- [ ] **E-159** Enlaces del crédito con `utm_source` (nombre de la app desde `brand.ts`) y `utm_medium=referral` — *Cubre:* RF-2.5. **Hecho cuando:** Test.

### Ajustes y montaje

*Requiere: cliente y clave.*

- [ ] **E-160** Preferencia del dispositivo «Activar Unsplash», apagada por defecto — *Cubre:* RF-9.1. **Hecho cuando:** Test.
- [ ] **E-161** Ajustes: interruptor, explicación de qué sale del equipo, campo de clave y enlace para desarrolladores — *Cubre:* RF-9.1, RF-9.2. **Hecho cuando:** Test.
- [ ] **E-162** Web: aviso de que la clave no se guarda al recargar — *Cubre:* RF-9.2. **Hecho cuando:** Test en la plataforma web.
- [ ] **E-163** Escritorio y web crean el cliente con su `fetchLike` solo si Unsplash está activado — *Cubre:* RF-9.4. **Hecho cuando:** Test: apagado, no se crea el cliente.

### Pestaña Unsplash

*Requiere: ajustes y montaje.*

- [ ] **E-164** La pestaña Unsplash solo aparece con Unsplash activado — *Cubre:* RF-2.1, RF-9.4. **Hecho cuando:** Test.
- [ ] **E-165** Búsqueda con miniaturas y más resultados por página — *Cubre:* RF-2.4. **Hecho cuando:** Test con el cliente simulado.
- [ ] **E-166** Elegir foto: progreso, aviso de descarga, descarga, optimización y portada con crédito — *Cubre:* RF-2.4, RF-2.5. **Hecho cuando:** Test: una sola entrada del historial con portada y crédito.
- [ ] **E-167** Mensaje de cada error en la pestaña; las demás pestañas siguen funcionando — *Cubre:* RF-2.6. **Hecho cuando:** Test.
- [ ] **E-168** Fallo de red durante la descarga: la portada anterior no cambia — *Cubre:* CL-8. **Hecho cuando:** Test.
- [ ] **E-169** Clave borrada o revocada: la pestaña la vuelve a pedir — *Cubre:* CL-9. **Hecho cuando:** Test.
- [ ] **E-170** Desactivar Unsplash con portadas ya guardadas: se siguen viendo con su crédito — *Cubre:* CL-10. **Hecho cuando:** Test.
- [ ] **E-171** Textos de Unsplash en `es-MX.ts` y `en.ts` — *Cubre:* RNF-7. **Hecho cuando:** Prueba de claves i18n en verde.

### Privacidad

*Requiere: pestaña Unsplash.*

- [ ] **E-172** Prueba de privacidad, caso 1: con Unsplash apagado, ninguna petición fuera del origen (sin cambios) — *Cubre:* RNF-2, RF-9.4. **Hecho cuando:** Prueba e2e en verde.
- [ ] **E-173** Prueba de privacidad, caso 2: con Unsplash encendido y una búsqueda, solo `api.unsplash.com` e `images.unsplash.com`, sin datos de páginas — *Cubre:* RF-9.3, RNF-2. **Hecho cuando:** Prueba e2e en verde.
- [ ] **E-174** Prueba de privacidad, caso 3: el respaldo sigue llegando solo a `api.github.com` — *Cubre:* RNF-2. **Hecho cuando:** Prueba e2e en verde.
- [ ] **E-175** e2e: una portada de Unsplash simulada se ve sin red — *Cubre:* RNF-1. **Hecho cuando:** Prueba e2e en verde.

---

## FASE 5 — Cierre

### Datos y rendimiento

*Requiere: Fase 4.*

- [ ] **E-176** e2e: respaldo y restauración de punta a punta con portadas, estilos, descripción, bloqueo y predeterminado — *Cubre:* RNF-5. **Hecho cuando:** Prueba e2e en verde.
- [ ] **E-177** e2e: restaurar un respaldo v1 de muestra — *Cubre:* CL-14. **Hecho cuando:** Prueba e2e en verde.
- [ ] **E-178** Prueba: un respaldo con versión mayor se rechaza con aviso y sin modificar nada — *Cubre:* CL-15. **Hecho cuando:** Test en verde.
- [ ] **E-179** Rendimiento: optimizar 20 MB mantiene la interfaz respondiendo — *Cubre:* RNF-4. **Hecho cuando:** Medición en la prueba de rendimiento.

### Calidad y documentación

*Requiere: datos y rendimiento.*

- [ ] **E-180** Recorrer los casos límite CL-1 a CL-17 y enlazar la prueba que cubre cada uno — *Cubre:* CL-1, CL-2, CL-3, CL-4, CL-5, CL-6, CL-7, CL-8, CL-9, CL-10, CL-11, CL-12, CL-13, CL-14, CL-15, CL-16, CL-17. **Hecho cuando:** Lista con la prueba de cada caso en el informe de cierre.
- [ ] **E-181** Revisión de los textos en inglés — *Cubre:* RNF-7. **Hecho cuando:** Sin textos en español en la interfaz en inglés.
- [ ] **E-182** Manual de usuario (`docs/manual/`): portadas, cabecera, menú de opciones, índice y Unsplash — *Cubre:* RNF-7. **Hecho cuando:** Sección nueva revisada.
- [ ] **E-183** Demostrar los criterios de finalización 1 a 10 de la spec con la prueba de cada uno — *Cubre:* RF-1.1, RF-2.1, RF-3.1, RF-4.1, RF-5.1, RF-6.1, RF-7.1, RF-8.1, RF-9.1, RNF-5. **Hecho cuando:** Tabla criterio → prueba en el informe de cierre; `typecheck` y `test` pasan.
- [ ] **E-184** Marcar la spec y el plan como implementados — *Cubre:* RNF-5. **Hecho cuando:** Estado actualizado en `spec.md`, `plan.md` y este archivo.

---

## Matriz de cobertura (generada de las etiquetas de cada tarea)

| Requisito | Tareas | Nº |
|---|---|---|
| **RF-1.1** | E-095, E-113, E-183 | 3 |
| **RF-1.2** | E-035, E-040, E-097, E-098 | 4 |
| **RF-1.3** | E-012, E-101, E-102, E-110 | 4 |
| **RF-1.4** | E-099 | 1 |
| **RF-1.5** | E-039, E-100 | 2 |
| **RF-1.6** | E-095 | 1 |
| **RF-1.7** | E-103 | 1 |
| **RF-1.8** | E-096 | 1 |
| **RF-2.1** | E-029, E-082, E-086, E-087, E-164, E-183 | 6 |
| **RF-2.2** | E-001, E-002, E-003, E-028, E-031, E-033, E-076, E-078, E-083, E-113 | 10 |
| **RF-2.3** | E-031, E-032, E-078, E-083 | 4 |
| **RF-2.4** | E-004, E-005, E-152, E-153, E-155, E-165, E-166 | 7 |
| **RF-2.5** | E-030, E-035, E-041, E-049, E-104, E-154, E-159, E-166 | 8 |
| **RF-2.6** | E-156, E-167 | 2 |
| **RF-2.7** | E-026, E-027, E-084, E-085 | 4 |
| **RF-2.8** | E-057, E-058, E-059, E-060, E-061, E-062 | 6 |
| **RF-3.1** | E-014, E-089, E-090, E-113, E-183 | 5 |
| **RF-3.2** | E-025, E-088 | 2 |
| **RF-3.3** | E-014, E-091 | 2 |
| **RF-3.4** | E-014, E-016, E-093 | 3 |
| **RF-3.5** | E-048, E-094 | 2 |
| **RF-4.1** | E-107, E-183 | 2 |
| **RF-4.2** | E-108, E-110, E-146 | 3 |
| **RF-4.3** | E-117, E-149 | 2 |
| **RF-4.4** | E-109 | 1 |
| **RF-4.5** | E-013, E-038, E-043, E-073, E-149 | 5 |
| **RF-4.6** | E-047, E-048, E-049, E-111, E-128 | 5 |
| **RF-5.1** | E-006, E-007, E-012, E-115, E-183 | 5 |
| **RF-5.2** | E-020, E-118, E-120 | 3 |
| **RF-5.3** | E-019, E-024, E-120 | 3 |
| **RF-6.1** | E-012, E-022, E-025, E-042, E-121, E-122, E-183 | 7 |
| **RF-6.2** | E-036 | 1 |
| **RF-6.3** | E-021, E-025, E-121 | 3 |
| **RF-6.4** | E-021, E-025, E-119, E-121 | 4 |
| **RF-6.5** | E-019, E-024, E-121 | 3 |
| **RF-7.1** | E-054, E-138, E-183 | 3 |
| **RF-7.2** | E-139 | 1 |
| **RF-7.3** | E-143, E-150 | 2 |
| **RF-7.4** | E-142, E-145 | 2 |
| **RF-7.5** | E-143 | 1 |
| **RF-7.6** | E-144 | 1 |
| **RF-7.7** | E-141 | 1 |
| **RF-7.8** | E-055, E-137, E-146 | 3 |
| **RF-8.1** | E-008, E-035, E-131, E-132, E-133, E-134, E-183 | 7 |
| **RF-8.1.1** | E-009, E-136 | 2 |
| **RF-8.2** | E-023, E-123, E-124 | 3 |
| **RF-8.3** | E-051, E-052, E-053, E-125 | 4 |
| **RF-8.4** | E-050, E-126 | 2 |
| **RF-8.5** | E-044, E-045, E-046, E-065, E-069, E-127 | 6 |
| **RF-9.1** | E-160, E-161, E-183 | 3 |
| **RF-9.2** | E-157, E-158, E-161, E-162 | 4 |
| **RF-9.3** | E-173 | 1 |
| **RF-9.4** | E-163, E-164, E-172 | 3 |
| **RNF-1** | E-114, E-175 | 2 |
| **RNF-2** | E-172, E-173, E-174 | 3 |
| **RNF-3** | E-090, E-105, E-112, E-148 | 4 |
| **RNF-4** | E-001, E-002, E-010, E-011, E-077, E-079, E-151, E-179 | 8 |
| **RNF-5** | E-015, E-017, E-018, E-037, E-063, E-064, E-065, E-068, E-070, E-072, E-074, E-176, E-183, E-184 | 14 |
| **RNF-6** | E-006, E-011, E-116 | 3 |
| **RNF-7** | E-075, E-130, E-171, E-181, E-182 | 5 |
| **RNF-8** | E-071, E-147 | 2 |
| **CL-1** | E-033, E-034, E-080, E-180 | 4 |
| **CL-2** | E-003, E-033, E-089, E-180 | 4 |
| **CL-3** | E-092, E-180 | 2 |
| **CL-4** | E-040, E-096, E-097, E-180 | 4 |
| **CL-5** | E-060, E-180 | 2 |
| **CL-6** | E-057, E-180 | 2 |
| **CL-7** | E-032, E-081, E-180 | 3 |
| **CL-8** | E-168, E-180 | 2 |
| **CL-9** | E-169, E-180 | 2 |
| **CL-10** | E-170, E-180 | 2 |
| **CL-11** | E-132, E-135, E-180 | 3 |
| **CL-12** | E-139, E-140, E-180 | 3 |
| **CL-13** | E-056, E-180 | 2 |
| **CL-14** | E-026, E-036, E-067, E-086, E-177, E-180 | 6 |
| **CL-15** | E-064, E-066, E-072, E-178, E-180 | 5 |
| **CL-16** | E-115, E-180 | 2 |
| **CL-17** | E-106, E-129, E-141, E-180 | 4 |
