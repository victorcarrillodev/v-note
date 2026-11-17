# Resultados de las verificaciones previas — spec 006 (temas de color)

Fecha: 2026-11-17 · Fase 0. Código desechable en `spikes/temas/` (`print.html`, `print_webkit.py`).

## T-001 — La exportación no lee el tema → CONFIRMADO
`exportDocument.ts` lleva una hoja fija. `packages/core/src/export` (7 archivos, 94 pruebas, incluido `golden.test.ts` contra `tests/golden/export-v1.html`) pasa sin tocar nada. «Estándar» = no modificar la hoja.

## T-002 — Consumidores que guardan colores → LISTA PARA DP-11
Con `graphify affected "readTokens"` y búsqueda de `data-theme` / `getComputedStyle` / `useTheme`:
- `graph/GraphView.tsx` lee `readTokens` en cada dibujo: **no se repinta** al pasar de Océano a Bosque (misma variante, `data-theme` no cambia) → arreglo en T-041 con `themeKey`.
- `diagram/MindMapEditor.tsx` (`theme()`) y `diagram/StylePanels.tsx` (`currentTheme()`) leen la **variante** de `data-theme`: la paleta de formas depende solo de la variante, así que no necesitan cambio; sus fondos salen de variables CSS y se repintan solos.
- `editor/PageEditor.tsx` usa `resolved` (variante): correcto (T-045).
- `catalog/Catalog.tsx` fija `data-theme` en su caja: no se toca.
- `design/appearance.ts` y `design/SyncedAppearance.tsx` calculan `data-theme` por su cuenta → T-037.
Consumidores a arreglar en T-042: ninguno más que el grafo (los lienzos de diagramas no guardan colores leídos).

## T-003 — Diagrama exportado sobre fondo oscuro → DP-10 CONFIRMADA
Los SVG llevan colores propios (relleno claro, trazo oscuro) pensados para fondo claro; sobre un fondo oscuro pierden el contorno. Se mantiene la **tarjeta clara** para variante oscura (se comprueba en `print.html`, figura `.light`).

## T-004 — Impresión con fondo oscuro en Chromium → FUNCIONA
Chrome 157 sin interfaz (`--print-to-pdf`) con `print-color-adjust: exact`: el PDF conserva el fondo `#0E1320` (píxel central RGB 14,19,32). DP-9 confirmada en Chromium.

## T-005 — Impresión en WebKitGTK → NO VERIFICABLE EN ESTE EQUIPO
`WebKit2.PrintOperation` a archivo falla sin impresora predeterminada (`lpr: No default destination`, también con «Print to File»), por lo que no se pudo generar el PDF. WebKitGTK soporta `-webkit-print-color-adjust: exact` (la hoja ya incluirá ambas propiedades), pero **queda sin comprobar el resultado real**. Alternativa para DP-9 si falla en la práctica: pintar el fondo con un `div` envolvente de `box-shadow: inset` o una imagen de fondo; no se implementa hasta que haya evidencia.

## T-006 — Cambio de tema con texto seleccionado → SE CUBRE CON PRUEBA (T-036)
Cambiar el tema solo modifica atributos de `<html>`; no desmonta el editor. No se hizo medición manual; la prueba de T-036 comprueba que un campo con foco y contenido sobrevive a tres cambios. BlockNote toma todo de variables CSS (`editor.css`) y de `theme={resolved}`.

## T-007 — Medición en página larga → APLAZADA A T-086
Se medirá en la prueba de rendimiento con Chrome (objetivo < 100 ms).

## T-008 — Radios nativos y accesibilidad → SE CUBRE CON PRUEBA (T-053, T-060)
Un grupo de `<input type="radio">` con el mismo `name` dentro de `fieldset`/`legend` expone nombre, grupo y estado en el árbol de accesibilidad estándar; se comprobará con `getByRole("radio", { name })` y axe. DP-7 se mantiene.

## T-009 — `theme-color` y ventana de Tauri → SOLO ANOTADO
- PWA: `theme_color` del manifiesto es fijo (`colors.accent.light`), no cambia con el tema. Fuera de alcance.
- Tauri: la ventana (`tauri.conf.json`) no define tema; el título sigue al sistema. Fuera de alcance.
- Contraste forzado (RF-14.11 de la spec 002): hay un bloque `@media (forced-colors: active)` en `tokens.css` que no depende de los bloques de tema; los temas solo definen variables `--c-*` y el modo forzado las sustituye. Sin corrección necesaria.
