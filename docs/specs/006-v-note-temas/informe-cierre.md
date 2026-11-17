# Informe de cierre — Spec 006 (temas de color)

> **Estado:** implementada. 91 de 91 tareas hechas (Fases 0 a 5). `bun run typecheck` sin errores y `bun run test` con **312 archivos y 3 461 pruebas en verde**. Pruebas de extremo a extremo en Chrome (`tests-e2e/`): `themes`, `themePerf` y `privacy` en verde, y `organizers`, `diagramFrame` y `pageOptions` en verde tras el cambio de `editor.css` (DP-14); ver abajo las que ya fallaban antes.

## 1. Casos límite (T-087)

| Caso | Prueba que lo cubre |
|---|---|
| **CL-1** tema guardado desconocido o dañado | `ui/src/theme/resolveTheme.test.ts` (`parseThemeMode`: «arcoiris», vacío, `null`), `theme/theme.test.tsx` («un valor guardado que ya no existe vuelve a sistema») y `theme/boot.test.ts` (paridad para valores inválidos y `__proto__`) |
| **CL-2** almacenamiento bloqueado | `theme/theme.test.tsx` (`setMode` devuelve `false` y el tema se aplica), `settings/ThemePicker.test.tsx` («aviso de que no se conservará») y `theme/boot.test.ts` (`localStorage` que lanza error) |
| **CL-3** cambio en otra ventana | `design/appearance.test.tsx` («un evento storage con un tema de color actualiza data-theme y data-palette») |
| **CL-4** cambio con diálogo, menú o editor abiertos | `theme/theme.test.tsx` (un campo con texto y foco sobrevive a tres cambios), `graph/GraphView.test.tsx` y `editor/PageEditorTheme.test.tsx` |
| **CL-5** el sistema cambia con un tema fijo | `theme/theme.test.tsx` («con un tema fijo, un cambio del sistema no altera los atributos»; sin oyente) |
| **CL-6** portada con color propio | `design/themes.test.ts` (cada bloque de tema declara solo los 15 colores; portadas, chips y bloques salen de la variante) |
| **CL-7** acento de página sobre otro tono | `design/themes.test.ts` + `design/themeContrast.ts` (los nueve acentos ≥ 4,5:1 sobre lienzo y tarjeta, y `onAccent` sobre ellos, en los diez temas) |
| **CL-8** pantalla estrecha | `settings/ThemePicker.test.tsx` («rejilla auto-fill de 140 px y tarjetas de al menos 44 px») |
| **CL-9** respaldo restaurado en otro dispositivo | `ui/src/backup/themeNotInBackup.test.ts` |
| **CL-10** versión anterior con tema nuevo guardado | `theme/resolveTheme.test.ts` y `boot.test.ts`: un id que no está en el catálogo se trata como «sistema» (es lo que hace la versión anterior); `AppTheme.test.tsx` (la preferencia guardada se aplica al abrir) |
| **CL-11** exportar con «Sistema» | `design/exportPalette.test.ts` («sistema usa la variante que muestre el sistema ahora») y `page/ExportDialogLook.test.tsx` |
| **CL-12** diagrama exportado con tema oscuro | `core/src/export/exportCss.test.ts` («diagramas sobre tarjeta clara solo con variante oscura») |

## 2. Criterios de finalización (T-090)

| Criterio de la spec (sección 8) | Prueba |
|---|---|
| **1** Catálogo: diez temas con nombre es/en y variante; Claro, Oscuro y Sistema como antes | `design/themes.test.ts` (diez ids en orden, 15 colores `#RRGGBB`, bloques Claro y Oscuro sin cambios), `i18n/themeKeys.test.ts`, `app/AppTheme.test.tsx` y el `git diff` de `tokens.css`, que solo añade los diez bloques |
| **2** Selector con vista previa, ratón, teclado y lector de pantalla | `settings/ThemePicker.test.tsx` (grupos, nombres «Océano, claro», marca ✓, flechas, axe) |
| **3** Aplicación completa, al instante y sin destello | `theme/applyTheme.test.ts`, `theme/boot.test.ts` (paridad con `applyTheme`), `tests-e2e/themes.e2e.test.ts` (atributos puestos antes de que exista la raíz), `GraphView.test.tsx`, `PageEditorTheme.test.tsx` y `tests-e2e/themePerf.e2e.test.ts` (< 100 ms con 2 050 bloques) |
| **4** Acentos, portadas y estilos de página en cualquier tema | `design/themes.test.ts` (acentos de página en los diez temas) y `design/accentContrast.test.ts` |
| **5** Una prueba de contraste por tema | `design/themes.test.ts` (`it.each` sobre el catálogo con `checkTheme`; Blanco y negro a 21:1) y `design/exportPalette.test.ts` (documento exportado) |
| **6** Tema desconocido = Sistema, respaldo sin cambios, sin migración | `theme/resolveTheme.test.ts`, `backup/themeNotInBackup.test.ts`; no hay migración nueva |
| **7** Exportación estándar idéntica o con tema actual | `core/src/export/exportCss.test.ts` (sin paleta = hoja anterior byte por byte, `golden.test.ts` sin cambios), `page/ExportDialogLook.test.tsx` y `tests-e2e/privacy.e2e.test.ts` (sin red) |
| **8** `typecheck` y `test` en verde, con pruebas de catálogo, resolución, arranque y contraste | Este informe |

## 3. Hallazgos y decisiones

- **Rendimiento (T-086, DP-14).** Con 2 050 bloques el cambio de tema tardaba 400–1 400 ms, igual que el Claro↔Oscuro que ya existía: el coste era del recálculo de estilos de toda la página, no de los temas. Se aplicó `content-visibility:auto` a los bloques de texto de primer nivel, **solo en páginas de 500 bloques o más**, y baja a ~60–80 ms (peor de seis cambios, Chrome sin interfaz). Aplicarlo a todos los bloques rompía la vista ampliada, el arrastre en matrices y los saltos del índice, así que se acotó. La persona responsable del producto aprobó cambiar el editor para cumplir RNF-3.
- **Pruebas e2e que ya fallaban antes de esta spec** (se comprobó con `editor.css` sin cambios): `blocks.e2e` (menú «/», atajos de Markdown, deshacer y rehacer, bloques propios), `a11y.e2e` (tres pruebas) y `pageStyle.e2e` (portada de ida y vuelta). No dependen de los temas y no se tocaron.
- **Impresión en WebKitGTK (T-005).** No se pudo comprobar en este equipo (sin impresora para `PrintOperation`); queda como riesgo anotado en el plan (DP-9). En Chromium el fondo oscuro sí sale en el PDF.
- **Fuera de alcance, como estaba previsto:** `theme-color` de la PWA y tema de la ventana de Tauri.
