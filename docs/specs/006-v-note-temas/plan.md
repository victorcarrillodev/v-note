# Plan 006 — Temas de color

> **Estado:** implementada · **Implementa:** `docs/specs/006-v-note-temas/spec.md` (RF-1 a RF-6, RNF-1 a RNF-7, CL-1 a CL-12, D-1 a D-10).
> **Marco:** `docs/constitution.md`. Este plan no contiene código de producción; fija el **cómo**: módulos, contratos, algoritmos en pseudocódigo, decisiones con su alternativa descartada, fases y pruebas.
> **Cómo leerlo:** cada parte indica entre corchetes lo que cubre, por ejemplo **[RF-2]**. La sección 12 es la matriz que comprueba que no queda ningún RF, RNF ni CL sin cubrir.
> **Punto de partida (estado actual del código, leído antes de escribir este plan):**
> - Tema = atributo `data-theme="light|dark"` en `<html>`. Las variables CSS salen de `packages/ui/src/design/tokens.ts` y se **generan** a `tokens.css` con `build-css.ts` (`cssTokens.test.ts` comprueba que coinciden). Hay un bloque `:root, [data-theme="light"]` y otro `:root[data-theme="dark"], [data-theme="dark"]`, cada uno con `color-scheme`.
> - Preferencia `theme` ∈ `light | dark | system` (clave `vnote:theme`, del dispositivo). `theme/theme.tsx` (`ThemeProvider`, `useTheme`) la lee y fija `data-theme`; `theme/resolveTheme.ts` la resuelve; `theme/bootPlugin.ts` inyecta un script clásico en `<head>` para fijarlo **antes del primer pintado** (lee `vnote:theme` y `matchMedia`).
> - Otras ventanas y dispositivos: `design/appearance.ts` (`useStorageSync`, evento `storage`) y `design/SyncedAppearance.tsx` (ventanas de captura y recordatorio) vuelven a calcular `data-theme` con su propia copia de la lógica.
> - Ajustes: `settings/SettingsView.tsx` tiene un `<select>` con tres opciones (`theme.system/light/dark`). El comando `theme.toggle` de `app/App.tsx` hace `setMode(resolved === "dark" ? "light" : "dark")`.
> - El editor (BlockNote) toma **todos** sus colores de las variables CSS por medio de `editor/editor.css` y `page/pageStyle.css`; recibe además `theme={resolved}` (la variante).
> - Diagramas y mapas mentales: la paleta de formas (`design/diagramPalette.ts`) depende de la **variante** (`data-theme`) y sus fondos salen de variables CSS. El grafo lee variables CSS **en cada dibujo** (`design/canvasColors.ts`, `readTokens`).
> - Color de acento de página (spec 005): `--c-accent: var(--block-<id>-text)`; `accentContrast.test.ts` lo comprueba sobre lienzo y tarjeta en las dos variantes.
> - **Exportación** (`packages/core/src/export/exportDocument.ts`): el HTML lleva una hoja **fija** (`:root{color-scheme:light}`, paleta de grises azulados escrita a mano); **no lee el tema**. Hay un archivo dorado `tests/golden/export-v1.html`. El diálogo (`page/ExportDialog.tsx`) llama a `controller.exportPages` → `exportHtml`; el PDF abre el diálogo de impresión con ese mismo HTML.

---

## 1. Resumen y cumplimiento de la constitución

### 1.1 Resumen
1. **Dos atributos, una sola idea:** `data-theme` sigue siendo la *variante* (`light`/`dark`) y todo lo que ya depende de ella no cambia; un atributo nuevo `data-palette="<id>"` se añade solo para los diez temas nuevos y sobrescribe los 15 colores propios del tema.
2. **Un catálogo cerrado** en `packages/ui/src/design/` (valores en `tokens.ts`, identificadores y variante en `themes.ts`) del que salen el CSS generado, el script de arranque, el selector y las pruebas. Añadir un tema = una entrada.
3. **Una sola función `applyTheme`** que pone los dos atributos; la usan el proveedor, la sincronización entre ventanas y la prueba del script de arranque.
4. **Selector en Ajustes** con tarjetas de vista previa, hecho con radios nativos (sin dependencia nueva).
5. **Exportación con aspecto elegible:** el núcleo recibe una **paleta como datos** (`ExportPalette`); sin ella produce **los mismos bytes de siempre**.
6. **Sin cambios** de esquema, migraciones, respaldo ni dependencias.

### 1.2 Cumplimiento de la constitución
| Artículo | Cómo lo respeta este plan |
|---|---|
| 1 Stack mínimo | **Cero dependencias nuevas** (ni npm ni Rust ni fuentes). El selector usa `<input type="radio">` nativo porque no hay `@radix-ui/react-radio-group` en el proyecto. |
| 2 La spec manda / fases | Seis fases en orden (sección 10). La spec 006 ya no tiene dudas abiertas. |
| 3 Lógica separada | El catálogo es presentación y vive en `packages/ui` (igual que `tokens.ts`). `packages/core` solo gana `ExportPalette` y `buildExportCss`, **datos y texto puros, sin importar nada de la interfaz**; la interfaz le pasa los valores. |
| 4 Tests | Contraste y coherencia de cada tema, resolución, arranque y exportación llevan prueba (sección 11). |
| 5 SQLite fuente de verdad | El tema es preferencia **del dispositivo** (como hoy); no hay datos nuevos en la base. |
| 6 Respaldo y privacidad | El tema no viaja en el respaldo (D-6); no hay peticiones de red. |
| 7 Idioma | Textos nuevos en `es-MX.ts` y `en.ts`; los nombres de los temas son claves i18n. |

---

## 2. Decisiones de plan

| ID | Decisión | Alternativa descartada | Cubre |
|---|---|---|---|
| **DP-1** | `data-theme` = **variante** (sin cambios) y `data-palette` = tema con color (ausente para Claro, Oscuro y Sistema). | Cambiar `data-theme` a 12 valores: rompería BlockNote, diagramas, mapas, `Catalog` y todo código que compara con `"dark"`. | RF-1.4, RF-1.5, RF-3.2, D-2 |
| **DP-2** | Los temas sobrescriben **solo 15 tokens** (`canvas, sidebar, card, raised, border, borderControl, text, textMuted, textPlaceholder, textDisabled, accent, onAccent, success, warning, danger`). `scrim`, elevaciones, chips, colores de bloque y portadas **no se tocan**: heredan de la variante. | Definir también chips, bloques y portadas por tema: 40 valores más por tema y riesgo de que lo guardado cambie de aspecto (D-3). | RF-1.3, RF-1.5, D-3 |
| **DP-3** | El CSS de cada tema es un bloque `:root[data-palette="<id>"] { … }` **generado** por `build-css.ts` **después** del bloque oscuro (misma especificidad que `:root[data-theme]`; gana por orden). `cssTokens.test.ts` se amplía para comprobarlo. | Escribir el CSS a mano: divergiría de `tokens.ts`. Clases en lugar de atributo: el resto del sistema de tokens ya usa atributos en `:root` (`data-theme`, `data-density`, `data-font`); un portal de Radix hereda las variables igual porque están en `:root`. | RF-1.3, RF-3.1, RNF-7 |
| **DP-4** | `ThemeMode` pasa a `"system" \| ThemeId` (`ThemeId` = `"light" \| "dark" \| PaletteId`). `ResolvedTheme` sigue siendo la variante. `resolveTheme` mantiene su firma y se añade `resolvePalette(mode)`. Un valor desconocido = `system`. | Una segunda preferencia `palette` junto a `theme`: dos claves que pueden quedar incoherentes (CL-1, CL-10). | RF-2.3, RF-2.5, RNF-5, CL-1, CL-10 |
| **DP-5** | Una única función **`applyTheme(root, mode, systemDark)`** pone `data-theme` y `data-palette` (y quita este último cuando no aplica). La usan `ThemeProvider`, `useStorageSync` y `SyncedAppearance`, que hoy repiten la lógica. | Dejar cada sitio con su copia: ya hay tres copias de la lógica de `data-theme` y añadir `data-palette` obligaría a mantener las tres iguales. | RF-2.3, RF-3.4 |
| **DP-6** | **Arranque sin destello:** `themeBootScript` se **construye desde el catálogo** (mapa `id → variante` serializado dentro del script clásico) y hace lo mismo que `applyTheme`. Una prueba ejecuta el script en jsdom y lo compara con `applyTheme` para los 13 valores y para valores inválidos. | Copiar la lista a mano en el script: un tema nuevo sin añadir allí parpadearía al abrir. | RF-3.5, RNF-7 |
| **DP-7** | **Selector** (`settings/ThemePicker.tsx`) con `<fieldset>`, `<legend>` y **radios nativos** visualmente ocultos más una tarjeta con miniatura; las flechas y el foco los da el navegador. Grupos: Sistema · Temas claros · Temas oscuros. | `@radix-ui/react-radio-group` (dependencia nueva) o el `<select>` actual (sin vista previa, no cumple RF-2.2). | RF-2.1, RF-2.2, RF-2.4, RNF-2 |
| **DP-8** | **Exportación = datos, no tema:** `exportHtml` acepta `opts.palette?: ExportPalette`. `buildExportCss(palette?)` devuelve **exactamente** la hoja actual cuando no hay paleta (el archivo dorado no cambia) y, con paleta, sustituye los colores fijos por los suyos. La interfaz construye la paleta con `exportPaletteFor(themeId)` (en `design/`), porque los valores viven allí. | Que el núcleo lea el tema o importe `tokens.ts`: rompe el art. 3 y haría depender la exportación del estado de la pantalla. | RF-6.1 a RF-6.5, D-10 |
| **DP-9** | En un documento con paleta: `a{color:<acento>}` (hoy los enlaces usan el azul del navegador, ilegible sobre oscuro), `color-scheme` de la variante y `print-color-adjust:exact` para que el fondo **se imprima** al guardar PDF; el bloque `@media print` **no fuerza `#000`** cuando hay paleta. | Mantener `color:#000` al imprimir: texto negro sobre fondo oscuro impreso. | RF-6.3, RF-6.4 |
| **DP-10** | Los diagramas exportados (SVG con colores propios) van sobre una **tarjeta de color claro** (`figure` con fondo y relleno) cuando la variante es oscura, para no depender de que sus trazos se lean sobre un fondo oscuro. Se confirma o corrige en la Fase 0 (V-3). | Recolorear los SVG según el tema: duplica la lógica de la spec 003. | RF-6.3, CL-12 |
| **DP-11** | Todo consumidor que **solo** mira `data-theme` y guarda resultados debe volver a leer al cambiar un tema **de la misma variante** (Océano → Bosque no cambia `data-theme`). El contexto de tema expone `themeKey` (el modo elegido) y el grafo lo usa como dependencia de redibujado. Qué otros lo necesitan se decide en V-2. | Observar `MutationObserver` en cada consumidor: disperso y fácil de olvidar. | RF-3.1, RF-3.2, CL-4 |
| **DP-12** | `theme.toggle` **no cambia de lógica**: `resolved` ya es la variante, así que de cualquier tema claro pasa a `dark` y de cualquiera oscuro a `light` (D-9). Se añade prueba para los 13 valores. | Ciclar o emparejar temas (D-9, D-8). | RF-2.6 |
| **DP-13** | Las pruebas de contraste se **generan del catálogo** (`it.each` sobre los 10 temas): no se escriben a mano por tema, así que un tema nuevo queda cubierto solo. | Pruebas por tema escritas a mano. | RF-5.1 a RF-5.5, RNF-7 |
| **DP-14** | **Páginas largas:** si la página tiene 500 bloques de primer nivel o más (`LONG_PAGE_BLOCKS`; `PageEditor` pone `data-long-page`), los bloques de texto y listas de primer nivel llevan `content-visibility:auto` con `contain-intrinsic-size:auto 1.75rem` (`editor/editor.css`). Con 2 050 bloques el cambio de tema pasa de 400–1 400 ms a ~60–80 ms (Chrome, `tests-e2e/themePerf.e2e.test.ts`); el coste anterior ya existía con Claro↔Oscuro y no lo añaden los temas. Se probó primero sobre todos los bloques y rompía la vista ampliada, el arrastre de matrices y los saltos del índice (la contención crea un bloque contenedor para la posición fija), por eso se limita a páginas largas y a bloques de texto. | Aplicarlo siempre; dejar el coste y relajar RNF-3 a ~500 bloques; o recortar el trabajo con `MutationObserver` (no ataca el recálculo de estilos). | RNF-3 |

---

## 3. Dependencias nuevas
**Ninguna.** Ni paquetes, ni fuentes, ni imágenes (RNF-4). Los valores de color se escriben una vez en `tokens.ts`.

---

## 4. Modelo y contratos

### 4.1 Tipos (en `packages/ui`)
```text
PaletteId  = "oceano" | "bosque" | "atardecer" | "lavanda" | "blanco-y-negro"
           | "medianoche" | "esmeralda" | "rosa-nocturna" | "ambar" | "grafito"
ThemeId    = "light" | "dark" | PaletteId
ThemeMode  = "system" | ThemeId          // valor de la preferencia `theme`
Variant    = "light" | "dark"            // = ResolvedTheme, lo que hay en data-theme

ThemeColors = { canvas, sidebar, card, raised, border, borderControl,
                text, textMuted, textPlaceholder, textDisabled,
                accent, onAccent, success, warning, danger }   // 15 hex

ThemeDef   = { id: PaletteId, variant: Variant, colors: ThemeColors }   // en tokens.ts
THEMES     = lista ordenada: claros primero, luego oscuros (orden del selector)
```
Los valores exactos están en el **Apéndice A**. Los nombres visibles son claves i18n `theme.<id>`.

### 4.2 Atributos y CSS
| Elección | `data-theme` | `data-palette` |
|---|---|---|
| Sistema | `light` o `dark` según el sistema | *(ausente)* |
| Claro / Oscuro | `light` / `dark` | *(ausente)* |
| Tema de color | su variante | su `id` |

Orden en `tokens.css`: bloque claro → bloque oscuro → **un bloque por tema** `:root[data-palette="<id>"]{ --c-…: …; }`. Los selectores `[data-theme="…"]` sueltos (p. ej. la vista `Catalog`) siguen restableciendo los colores base dentro de su caja.

### 4.3 Preferencia
Clave `vnote:theme` (sin cambios). Valores válidos: `system`, `light`, `dark` y los diez `PaletteId`. **Cualquier otro valor → `system`** (CL-1, CL-10). No hay migración ni cambio de formato (RNF-5).

### 4.4 Exportación
```text
ExportPalette = {
  variant: Variant,
  canvas, text, textMuted, border, borderControl, raised, accent, danger,
  chips:  { info|success|warning|error : { fg, bg } },     // llamadas (callouts)
  blocks: { gray|brown|red|orange|yellow|green|blue|purple|pink : { text, bg } }
}
ExportOptions += { palette?: ExportPalette }
buildExportCss(palette?: ExportPalette): string
exportPaletteFor(id: ThemeId, systemDark: boolean): ExportPalette    // en packages/ui
```
Correspondencia entre la hoja actual y la paleta (solo con paleta):

| Regla actual | Con paleta |
|---|---|
| `body` color / *(sin fondo)* | `text` / fondo `canvas` |
| `figcaption`, `.when`, `blockquote` (texto) | `textMuted` |
| `pre` (fondo), `th` (fondo), `.callout-note` | `raised` |
| `blockquote` (borde), `.link-card`, `.toc` | `border` |
| `th, td` (borde) | `borderControl` |
| `.callout`, `.callout-warning/success/error` | `chips.info/warning/success/error` (borde = `fg`, fondo = `bg`) |
| `.mention`, enlaces | `accent` |
| `.missing` | `danger` |
| `.c-<color>` / `.bg-<color>` | `blocks.<color>.text` / `.bg` |
| `:root{color-scheme:light}` | `color-scheme:` de la variante |

---

## 5. Algoritmos (pseudocódigo)

### 5.1 Resolver y aplicar el tema [RF-2.3, RF-3.5, RNF-5]
```text
resolveTheme(mode, systemDark):                  // variante
  si mode ∈ {"light","dark"}: devolver mode
  si mode es un PaletteId:    devolver THEMES[mode].variant
  devolver systemDark ? "dark" : "light"          // "system" o desconocido

resolvePalette(mode):  mode es PaletteId ? mode : null

applyTheme(root, mode, systemDark):
  root.data-theme = resolveTheme(mode, systemDark)
  p = resolvePalette(mode)
  p ? root.data-palette = p : root.quitar data-palette
```

### 5.2 Script de arranque [RF-3.5]
```text
// construido en build desde THEMES: MAP = { "oceano":"light", …, "grafito":"dark" }
t = leer("vnote:theme")                       // dentro de try/catch
v = t ∈ {"light","dark"} ? t : (t en MAP ? MAP[t] : (matchMedia oscuro ? "dark" : "light"))
root.data-theme = v
t en MAP ? root.data-palette = t : root.quitar data-palette
// el resto (densidad, fuente) queda como está
```

### 5.3 Paleta de exportación [RF-6]
```text
exportPaletteFor(id, systemDark):
  variante = resolveTheme(id, systemDark)          // "system" → lo que muestre el sistema ahora (CL-11)
  colores  = id es PaletteId ? THEMES[id].colors : colors[variante]   // Claro/Oscuro: tokens base
  devolver { variante, … colores, chips: chips[*][variante], blocks: blockColors[*][variante] }
```

### 5.4 Selector con teclado [RF-2.4]
Radios nativos con el mismo `name`: Tab entra al grupo, ↑↓←→ cambian la selección y la aplican al instante, y el foco se ve en la tarjeta (`:focus-within`). Cada radio tiene `aria-label` = «nombre, claro|oscuro» (clave i18n con el nombre y la variante).

---

## 6. Interfaz

### 6.1 Selector de tema (`settings/ThemePicker.tsx`) [RF-2]
- Sustituye al `<select>` de «Tema» en `SettingsView`; la etiqueta `settings.theme` pasa a ser la `<legend>`.
- Tres grupos con su subtítulo: **Sistema** (una tarjeta con la miniatura partida claro/oscuro), **Temas claros** (Claro + 5) y **Temas oscuros** (Oscuro + 5). Rejilla `auto-fill` de mínimo 140 px: una o dos columnas en pantalla estrecha (CL-8).
- **Miniatura:** una caja con los colores del tema (`canvas` de fondo, franja `sidebar`, tarjeta `card`, botón `accent` con `onAccent`, líneas `text`), tomados del catálogo; no hay hex escritos en el componente. Objetivo táctil ≥ 44 px (RNF-2).
- Cambiar la selección llama a `setMode`; el efecto es inmediato (RNF-3). Si `preferences.set` devuelve `false` (almacenamiento bloqueado, CL-2), el selector muestra un aviso de que el tema no se conservará; hoy `ThemeProvider` ignora ese resultado, así que `setMode` pasa a devolverlo. La tarjeta elegida muestra un borde `accent` y una marca ✓ (no solo color).

### 6.2 Diálogo de exportación (`page/ExportDialog.tsx`) [RF-6]
- Nuevo grupo «Aspecto» (radios): **Estándar** (predeterminado, texto «el de siempre») y **Tema actual (<nombre>)**. Solo vale para esa exportación y se restablece al reabrir el diálogo (RF-6.5).
- Con «Tema actual» el diálogo calcula `exportPaletteFor(mode, systemDark)` y la pasa en `controller.exportPages(…, { palette })`.

### 6.3 Textos [RNF-6]
Claves nuevas en `es-MX.ts` y `en.ts`:

| Clave | es-MX | en |
|---|---|---|
| `theme.<id>` ×10 | Océano · Bosque · Atardecer · Lavanda · Blanco y negro · Medianoche · Esmeralda · Rosa nocturna · Ámbar · Grafito | Ocean · Forest · Sunset · Lavender · Black & White · Midnight · Emerald · Night rose · Amber · Graphite |
| `theme.groupSystem` / `groupLight` / `groupDark` | Sistema / Temas claros / Temas oscuros | System / Light themes / Dark themes |
| `theme.variantLight` / `variantDark` | claro / oscuro | light / dark |
| `theme.option` | «{{name}}, {{variant}}» | "{{name}}, {{variant}}" |
| `export.look` / `lookStandard` / `lookTheme` | Aspecto / Estándar / Tema actual ({{name}}) | Look / Standard / Current theme ({{name}}) |

---

## 7. Sincronización y ventanas [RF-3.4, CL-3]
`useStorageSync` y `SyncedAppearance` dejan de calcular `data-theme` por su cuenta y llaman a `applyTheme(root, loadTheme(preferences), systemDark)`. El evento `storage` ya existe; no hay mecanismo nuevo.

---

## 8. Riesgos y límites conocidos
| Riesgo | Mitigación |
|---|---|
| Un consumidor guarda colores leídos y no se entera de un cambio de tema de la misma variante. | DP-11 y V-2; prueba de «Océano → Bosque» en el grafo. |
| Los tonos de un tema se leen mal con un color de bloque o de acento. | Comprobado en el diseño con un script y repetido como prueba (RF-5.2, RF-4.1). Excepción conocida: el verde de bloque sobre el **lateral** de los cuatro temas claros de color baja a 4,3–4,4:1; el acento de página no se usa sobre el lateral y la spec 005 solo lo exige sobre lienzo y tarjeta. |
| El documento exportado con tema oscuro se imprime con el fondo en blanco. | DP-9 y V-4. |
| Grafito quedó más cerca del Oscuro actual de lo deseado (sus superficies no pueden ser más claras sin romper los contrastes de los colores de bloque heredados). | Aceptado (D-4); si se quiere un gris más claro, habría que dar al tema sus propios colores de bloque, ampliando DP-2. |
| El título de la ventana de Tauri sigue al sistema, no al tema. | Fuera de alcance; se anota en V-8. |
| Con el modo de contraste forzado del sistema, el navegador sustituye colores y los temas podrían estorbar (RF-14.11 de la spec 002). | V-8 lo comprueba; no se promete soporte más allá de que la interfaz siga utilizable. |

---

## 9. Dónde se toca el código (referencia)
| Área | Archivos |
|---|---|
| Catálogo y CSS | `design/tokens.ts`, `design/themes.ts` (nuevo), `design/build-css.ts`, `design/tokens.css` (generado) |
| Resolución y aplicación | `theme/resolveTheme.ts`, `theme/theme.tsx`, `theme/applyTheme.ts` (nuevo), `design/appearance.ts`, `design/SyncedAppearance.tsx` |
| Arranque | `theme/bootPlugin.ts` |
| Interfaz | `settings/ThemePicker.tsx` (nuevo), `settings/SettingsView.tsx`, `i18n/es-MX.ts`, `i18n/en.ts`, `graph/GraphView.tsx` |
| Exportación | `core/src/export/exportDocument.ts`, `core/src/export/html.ts`, `core/src/index.ts`, `ui/src/design/exportPalette.ts` (nuevo), `ui/src/page/ExportDialog.tsx`, `ui/src/workspace/controller.ts` |
| Documentación | `docs/manual/README.md` (sección de apariencia) |

---

## 10. Fases

Cada fase se cierra con `bun run typecheck` y `bun run test` en verde antes de empezar la siguiente (art. 2).

### Fase 0 — Verificaciones (código desechable en `spikes/temas/`, resultados en `spikes/RESULTS-temas.md`)
Si una verificación falla, se detiene el trabajo y se actualiza este plan.
- **V-1** *(ya comprobada al escribir el plan)* La exportación actual no lee el tema: hoja fija y archivo dorado. «Estándar» = no tocar nada. Se deja como prueba (el dorado sigue igual).
- **V-2** Auditar qué consumidores guardan colores leídos de variables CSS o de `data-theme` y no se actualizan al cambiar un tema de la misma variante (grafo, lienzos, miniaturas). Resultado: lista para DP-11.
- **V-3** Exportar un diagrama (SVG) sobre fondo oscuro: ¿se lee? Confirma o cambia DP-10.
- **V-4** Imprimir/guardar PDF de un documento con fondo oscuro en Chromium y en WebKitGTK (Tauri): ¿sale el fondo con `print-color-adjust:exact`? Confirma DP-9.
- **V-5** Cambiar de tema con el editor abierto y texto seleccionado: no se pierde el cursor ni la selección (CL-4); BlockNote y sus menús siguen las variables.
- **V-6** Medir el cambio de tema en una página larga (RNF-3, objetivo < 100 ms).
- **V-7** Comprobar con el selector real que un lector de pantalla anuncia nombre, variante y estado de los radios (RF-2.4).
- **V-8** Ver si hay `theme-color` (PWA) o tema de ventana en Tauri que deban seguir al tema, y comprobar que los temas no impiden el modo de contraste forzado; solo se anota, no se implementa.

**Resultados (2026-11-17, `spikes/RESULTS-temas.md`):** DP-10 confirmada (tarjeta clara). DP-9 confirmada en Chromium; en WebKitGTK la impresión a archivo no se pudo comprobar en este equipo (sin impresora), se mantiene la hoja con `print-color-adjust:exact` y queda como riesgo anotado. DP-11: solo `GraphView` necesita `themeKey`; `MindMapEditor`/`StylePanels` dependen de la variante y no cambian. `theme-color` de la PWA y la ventana de Tauri quedan fuera de alcance; el contraste forzado no se ve afectado. Sin decisiones abiertas.

### Fase 1 — Catálogo y CSS
`themes.ts` y los valores del Apéndice A en `tokens.ts`; `build-css.ts` genera los bloques `data-palette`; `cssTokens.test.ts` ampliado; **pruebas de contraste por tema** (DP-13): RF-5.1, RF-5.2, RF-5.3, RF-4.1 y el texto sobre las llamadas de la exportación.

### Fase 2 — Resolución, aplicación y arranque
`resolveTheme`/`resolvePalette`/`applyTheme`; `ThemeProvider` con `palette` y `themeKey`; sincronización entre ventanas; script de arranque construido desde el catálogo y su prueba de paridad; `theme.toggle` probado con los 13 valores; grafo con `themeKey`. Aquí ya se puede elegir un tema cambiando la preferencia a mano.

### Fase 3 — Selector y textos
`ThemePicker` y su integración en Ajustes, con el aviso de CL-2 (`setMode` devuelve si se pudo guardar); claves es/en; pruebas de teclado, nombres accesibles y estrecho.

### Fase 4 — Exportación
`ExportPalette`, `buildExportCss` y `exportHtml(opts.palette)` en el núcleo con pruebas (sin paleta = archivo dorado idéntico; con paleta, contrastes y sin recursos externos); `exportPaletteFor`; grupo «Aspecto» en el diálogo; HTML y PDF.

### Fase 5 — Cierre
Prueba e2e de elegir tema, reiniciar y comprobar que persiste y que no hay destello; verificación de privacidad (sin red); recorrido de CL-1 a CL-12 con su prueba; manual de usuario (`docs/manual/`); demostrar los criterios de finalización 1 a 8; marcar spec y plan como implementados.

---

## 11. Pruebas

| Qué | Dónde | Cubre |
|---|---|---|
| Cada tema: contrastes de RF-5.1 y RF-5.2, 21:1 de Blanco y negro, acento de página, texto sobre llamadas | `design/themes.test.ts` (`it.each` sobre el catálogo) | RF-4.1, RF-5.1 a RF-5.5 |
| `tokens.css` coincide con `tokens.ts` incluidos los bloques de temas | `design/cssTokens.test.ts` | RF-1.3, RNF-7 |
| Los 13 valores + `system` + inválidos → atributos correctos | `theme/resolveTheme.test.ts`, `theme/applyTheme.test.ts` | RF-2.3, RNF-5, CL-1, CL-5 |
| El script de arranque deja los mismos atributos que `applyTheme` | `theme/boot.test.ts` | RF-3.5, CL-2 |
| Cambiar el tema repinta sin perder el texto ni el cursor | `theme/theme.test.tsx` | RNF-3, CL-4 |
| Sincronización entre ventanas | `design/appearance.test.tsx` | RF-3.4, CL-3 |
| `theme.toggle` desde cualquiera de los 13 valores | `app/App.test.tsx` | RF-2.6 |
| Selector: grupos, nombres accesibles, teclado, miniaturas con los colores del catálogo, ancho estrecho | `settings/ThemePicker.test.tsx` | RF-2.1, RF-2.2, RF-2.4, CL-8 |
| El grafo se redibuja al pasar de un tema a otro de la misma variante | `graph/GraphView.test.tsx` (archivo nuevo) | DP-11 |
| Sin paleta, el HTML es idéntico al dorado; con paleta, colores, `color-scheme`, enlaces y sin recursos externos | `core/src/export/*.test.ts`, `tests/golden/` | RF-6.2 a RF-6.4, CL-11, CL-12 |
| Diálogo: «Estándar» por defecto, «Tema actual» pasa la paleta, no se conserva | `page/ExportDialog.test.tsx` | RF-6.1, RF-6.5 |
| Elegir tema → reiniciar → persiste; sin peticiones de red | `tests-e2e/` | RF-2.3, RNF-1, CL-9 |
| El respaldo no incluye el tema | `backup/serialize.test.ts` | RF-2.5, CL-9 |

---

## 12. Matriz de cobertura

| Requisito | Dónde se cubre |
|---|---|
| RF-1.1, RF-1.2, RF-1.3 | DP-2, DP-3, 4.1, Apéndice A; Fase 1 |
| RF-1.4, RF-1.5 | DP-1, DP-2; Fase 1 y prueba de que Claro/Oscuro no cambian |
| RF-2.1, RF-2.2, RF-2.4 | DP-7, 6.1, 5.4; Fase 3 |
| RF-2.3, RF-2.5 | DP-4, DP-5, 4.3; Fase 2 |
| RF-2.6 | DP-12; Fase 2 |
| RF-3.1, RF-3.2, RF-3.3 | DP-1, DP-3, DP-11; Fases 1 y 2 (`color-scheme` ya sale de la variante) |
| RF-3.4 | DP-5, sección 7; Fase 2 |
| RF-3.5 | DP-6, 5.2; Fase 2 |
| RF-4.1, RF-4.2, RF-4.3 | DP-2 (los bloques y portadas no cambian), 11; Fase 1 |
| RF-5.1 a RF-5.5 | DP-13, 11; Fase 1 |
| RF-6.1 a RF-6.5 | DP-8, DP-9, DP-10, 4.4, 6.2; Fase 4 |
| RNF-1 | 3 y prueba e2e; Fase 5 |
| RNF-2 | 6.1, DP-7; Fases 1 y 3 |
| RNF-3 | V-5, V-6, 11; Fases 0 y 2 |
| RNF-4 | 3 |
| RNF-5 | DP-4, 4.3; Fase 2 |
| RNF-6 | 6.3; Fase 3 |
| RNF-7 | DP-2, DP-6, DP-13; Fases 1 y 2 |
| CL-1, CL-10 | DP-4, 4.3 |
| CL-2 | DP-6 (el script no falla si el almacenamiento está bloqueado) y el aviso del selector (6.1) |
| CL-3 | Sección 7 |
| CL-4 | V-5, DP-11 |
| CL-5 | DP-1: el tema fijo no depende del sistema; `matchMedia` solo se escucha con `system` |
| CL-6, CL-7 | DP-2; pruebas de contraste de la Fase 1 |
| CL-8 | 6.1 |
| CL-9 | 4.3 y prueba del respaldo |
| CL-11 | 5.3 |
| CL-12 | DP-10, V-3 |

---

## Apéndice A — Valores de los temas

Los 10 temas, con los 15 colores que sobrescriben (todos verificados con los mínimos de RF-5 y con los acentos de página de la spec 005). Los colores de bloque, chips, portadas, `scrim` y elevaciones son los de la variante.

| Token | `oceano` | `bosque` | `atardecer` | `lavanda` | `medianoche` | `esmeralda` | `rosa-nocturna` | `ambar` | `blanco-y-negro` | `grafito` |
|---|---|---|---|---|---|---|---|---|---|---|
| *variante* | claro | claro | claro | claro | oscuro | oscuro | oscuro | oscuro | claro | oscuro |
| `canvas` | #F3F8FB | #F5F8F1 | #FFF8F2 | #F9F7FD | #0E1320 | #0C1512 | #19111A | #17120C | #FFFFFF | #232323 |
| `sidebar` | #EAF2F7 | #ECF2E6 | #FBEEE3 | #F0ECF9 | #141B2C | #121E1A | #211722 | #1F1911 | #F5F5F5 | #1C1C1C |
| `card` | #FFFFFF | #FFFFFF | #FFFFFF | #FFFFFF | #1A2336 | #182822 | #2A1D2C | #292117 | #FFFFFF | #2B2B2B |
| `raised` | #E1ECF3 | #E3ECDA | #F6E4D4 | #E7E1F5 | #222D45 | #20352D | #352538 | #33291C | #EBEBEB | #353535 |
| `border` | #D5E3EC | #D8E3CD | #EFD9C7 | #DDD5EF | #26314A | #243A31 | #3A2A3D | #3A2F20 | #C4C4C4 | #3E3E3E |
| `borderControl` | #6F8797 | #7A8A6E | #8E7766 | #80779A | #7482A3 | #6E9183 | #9A7A9E | #917E62 | #000000 | #9A9A9A |
| `text` | #16303F | #22301F | #3A2518 | #2A2140 | #E4E9F5 | #E1EEE8 | #F1E4F0 | #F0E6D6 | #000000 | #EDEDED |
| `textMuted` | #486373 | #52604B | #6A5242 | #5A5075 | #A2AEC8 | #9DB8AC | #BBA2BC | #BCAE96 | #333333 | #BDBDBD |
| `textPlaceholder` | #52697A | #5B6955 | #74594A | #645A80 | #8B97B2 | #86A295 | #A28BA4 | #A29478 | #4D4D4D | #ABABAB |
| `textDisabled` | #9DB0BC | #A4B09B | #B9A595 | #B1A9C6 | #56627E | #4F6B5F | #6A546C | #665843 | #8C8C8C | #707070 |
| `accent` | #0A6E8C | #2D7A3E | #BE3F0C | #6B3FC2 | #8CA8FF | #4FD1A1 | #F28BC4 | #EBAA3A | #000000 | #D6D6D6 |
| `onAccent` | #FFFFFF | #FFFFFF | #FFFFFF | #FFFFFF | #0B1130 | #06231A | #2B0A1E | #241600 | #FFFFFF | #1F1F1F |
| `success` | #17745A | #17745A | #17745A | #17745A | #4DAB9A | #4DAB9A | #4DAB9A | #4DAB9A | #17745A | #4DAB9A |
| `warning` | #9A4F08 | #9A4F08 | #9A4F08 | #9A4F08 | #E08A3C | #E08A3C | #E08A3C | #E08A3C | #9A4F08 | #E08A3C |
| `danger` | #C0312F | #C0312F | #C0312F | #C0312F | #EC6A67 | #EC6A67 | #EC6A67 | #EC6A67 | #C0312F | #EC6A67 |

*Diseño visual de referencia:* lienzo «Temas de v-note» (16 de noviembre de 2026).

## Anexo — Bloque de código: resaltado, autocompletado y temas (pedido por la persona usuaria, 2026-11-23)

Dependencias nuevas de `@vnote/ui`, justificadas por la constitución (stack mínimo):

| Dependencia | Para qué | Alternativa descartada |
|---|---|---|
| `@lezer/highlight`, `@lezer/common` | Convertir el árbol sintáctico en clases `tok-*` | Tokenizador propio por lenguaje: más código y peor precisión |
| `@lezer/javascript`, `python`, `css`, `html`, `json`, `markdown`, `rust`, `cpp`, `java`, `go`, `php`, `yaml`, `xml` | Gramáticas del ecosistema CodeMirror, cargadas a demanda con `import()` | Incrustar CodeMirror 6 completo: cambiaría cómo se guarda el texto del bloque (Yjs, exportación, búsqueda) |
| `prosemirror-state`, `prosemirror-view`, `prosemirror-model` | Ya llegaban con BlockNote; ahora son directas para escribir el plugin de decoraciones | — |

Decisión: el contenido del bloque sigue siendo texto plano del documento; el color se añade con decoraciones de ProseMirror (no altera el documento ni el respaldo) y el autocompletado es una lista flotante propia (palabras del lenguaje + nombres del bloque). Bash y SQL usan reglas regulares (no existe gramática `@lezer` oficial). El tema de color del código es una preferencia local (`vnote:codeTheme`), no una propiedad del bloque, para no cambiar el formato de respaldo.
