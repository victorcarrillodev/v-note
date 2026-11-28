---
feature: quality-b12-b15
status: done
created: 2026-11-27
updated: 2026-11-27
authorized-by: usuario / 2026-11-27 / puntos de calidad del backlog
delivery: ask-on-risk
test-runner: bun run typecheck && bun run test
---
## Specs
- S1: "primero haz el commit y depues haz los puntos de calidad"

## Tareas
- [x] T-1 (S1) route=inline commit=- B-15: falso verde, cancelar OAuth, retorno con `state` ajeno y mensajes del núcleo en inglés. Risk: ítem 1 (cambia qué acepta el puerto local de OAuth; comando nuevo `oauth_cancel`)
- [x] T-2 (S1) route=inline commit=- B-12: marcar zonas con teclado y auditoría axe de pantallas nuevas. Risk: none
- [x] T-3 (S1) route=inline commit=- B-13: medir un espacio de 5 000 páginas. Risk: none
- [x] T-4 (S1) route=inline commit=- B-14: pruebas de escritorio en WebKitGTK con el binario de producción. Risk: none
<!-- route=inline|delegated(<motivo: exploración | escritores paralelos | respaldo de contexto | verificador independiente>); cada tarea de código cierra con "Risk: ítem N (motivo)" o "Risk: none" -->

## Evidencia
| Tarea | Comando / comprobación | Resultado observado | Fecha |
|---|---|---|---|
| T-1 | `bun run test`; `cargo test --offline --workspace` | La prueba corregida detectaba que no esperaba al segundo respaldo; ahora usa la hora del último respaldo. 235 mensajes traducidos, con prueba que falla si falta uno | 2026-11-27 |
| T-2 | `PageAttachments.test.tsx`, `a11yQuality.test.tsx`; e2e `a11y` (Chrome) | Sin infracciones graves; zona creada, movida y redimensionada con teclado | 2026-11-27 |
| T-3 | `workspaceScale.test.ts`; e2e `themePerf`, `diagramScale` | 5 000 páginas: buscar 4 ms, etiqueta 91 ms, limpieza 523 ms, respaldo 532 ms (SQLite de Node en memoria, sin interfaz) | 2026-11-27 |
| T-4 | `dbus-run-session -- bunx vitest run -c vitest.e2e.config.ts` sobre las 20 pruebas de escritorio | 19 archivos pasaron; `blocks` falló por datos compartidos con el árbol virtualizado (prueba corregida, 9/9) | 2026-11-27 |

## Log
- L1: "primero haz el commit y depues haz los puntos de calidad"
- L2: límites: la lectura con lector de pantalla no se probó a mano; la cancelación de OAuth no se probó contra Google/Dropbox; los mensajes de Rust y los que arma la interfaz con excepciones del sistema no se traducen; de las pruebas de navegador solo se ejecutaron las relacionadas.
