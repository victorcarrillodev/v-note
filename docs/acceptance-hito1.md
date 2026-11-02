# Checklist de aceptación del Hito 1 (T-225)

Criterios 1, 2 (sin enlaces ni grafo), 7, 8, 9, 10 y 11 de la sección 9 de la spec. **Estado honesto**: «Demostrado» solo si hay una prueba automatizada que lo ejercita en la aplicación real (escritorio o Chrome); «Parcial» indica lo que falta.

Verificación de referencia: `bun run typecheck`, `bun run test` (unitarias, jsdom/Node) y `bun run test:e2e` (escritorio con tauri-driver y Chrome por CDP).

| # | Criterio | Estado | Evidencia | Falta |
|---|---|---|---|---|
| 1 | Páginas anidadas, todos los bloques de RF-3, mover, papelera y restaurar | **Demostrado** | `tests-e2e/blocks.e2e.test.ts` (menú `/`, atajos Markdown, bloques estándar y propios, color, deshacer/rehacer); `tests-e2e/pwa.e2e.test.ts` T-113 (arrastrar con hijas, anidar); `tests-e2e/app.e2e.test.ts`; `packages/ui/src/trash/TrashView.test.tsx` y `packages/core/src/pages/trash.test.ts` (papelera, restaurar, 30 días) | La papelera se prueba en jsdom y núcleo, no en un e2e de la app real |
| 2 | La paleta encuentra por título y contenido (sin enlaces ni grafo) | **Demostrado** | `tests-e2e/palette.e2e.test.ts` (recientes, búsqueda en vivo, filtros, acciones); `tests-e2e/pwa.e2e.test.ts` T-148 (búsqueda por contenido sin red) | Retroenlaces y grafo son del Hito 4 |
| 7 | Respaldo por espacio, programado y manual, reintentos con aviso, sin commits vacíos | **Parcial** | `packages/core/src/backup/*.test.ts` (servidor GitHub falso: determinismo, sin commit si no hay cambios, reintentos 1/5/15/60 min, clasificación de errores, token redactado); `packages/ui/src/app/AppBackup.test.tsx` (tic, panel, avisos); `tests-e2e/privacy.e2e.test.ts` (solo `api.github.com`) | **No se ha probado contra GitHub real.** El tic nativo está probado (`tests-e2e/tick.e2e.test.ts`) pero el ciclo completo de escritorio contra un servidor falso por HTTP no |
| 8 | Restaurar como espacio nuevo sin diferencias | **Demostrado** (con servidor falso) | `packages/core/src/backup/restore*.test.ts` (identidad serializar→restaurar→serializar, byte a byte); `AppBackup.test.tsx` T-221 (recorrido por la interfaz) | Contra GitHub real |
| 9 | Sin conexión e instalación en Linux y Windows; corre en navegador | **Parcial** | `tests-e2e/pwa.e2e.test.ts` T-146…T-148 (instalable, arranca con el servidor apagado, crea/edita/busca/reordena sin red); `tests-e2e/app.e2e.test.ts` (escritorio Linux, persistencia); `tests-e2e/tray.e2e.test.ts`, `instance.e2e.test.ts` | **Instaladores** (AppImage, .deb, .msi) sin generar y **Windows/macOS sin probar**: `.github/workflows/ci.yml` y `spike-build.yml` no se han ejecutado (T-024, T-025, T-032, T-033, T-224) |
| 10 | Tema claro/oscuro y español/inglés | **Demostrado** | `tests-e2e/palette.e2e.test.ts` T-144 (cambia y recuerda tras reiniciar); `packages/ui/src/i18n/i18n.test.tsx` (paridad de claves); `tests-e2e/a11y.e2e.test.ts` | Auditoría de contraste solo en tema claro |
| 11 | Varios espacios, cada uno con contenido, respaldo y ubicación independientes | **Parcial** | `packages/core/src/workspaces/workspaces.test.ts` y `moveWorkspace.test.ts` (aislamiento, mover con verificación, carpeta ausente); `tests-e2e/datadir.e2e.test.ts` (ruta visible) | Elegir carpeta al crear (T-157, diálogo nativo) y la pantalla de mover un espacio no están construidas |

## Cierre del Hito 1

- Presupuestos medidos: escala 5 000 páginas (`packages/core/src/pages/scale.test.ts`), teclado con 2 000 bloques (mediana 15,8 ms, p95 18,4 ms en Chrome sin pantalla), privacidad (`privacy.e2e.test.ts`), accesibilidad axe sin infracciones graves (`a11y.e2e.test.ts`).
- Verificaciones **manuales pendientes** de la persona usuaria: T-017, T-019, T-020 (ver `spikes/RESULTS.md`), ejecutar los workflows de CI (T-025, T-032, T-033, T-224), probar en Windows y macOS (T-155), y respaldar contra un repositorio privado real.
- Decisiones pendientes que bloquean tareas: T-157 (plugin de diálogo), T-165 y T-166 (alojamiento de versiones y aviso de actualización).

Firma de aceptación: ______________________  Fecha: ______________
