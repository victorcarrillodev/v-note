---
feature: captura-markdown
status: done
created: 2026-11-23
updated: 2026-11-23
authorized-by: usuario / 2026-11-23 / feature a mi criterio para benchmark de V-IA, mejorando la captura rápida (sin commit ni push)
delivery: ask-on-risk
test-runner: bun run typecheck && bun run test
---
## Specs
- S1: "un widget que me apareciera un textinput para escribir aun así no esté en la app" → ya existe (RF-13, captura rápida). Elegido: «Mejorar la captura». Mejora acordada: la nota capturada conserva Markdown ligero en vez de volverse solo párrafos.

## Supuestos
- A1: solo núcleo (`packages/core/src/capture/quickCapture.ts`); la ventana y Tauri no cambian.
- A2: por línea: `# `/`## `/`### ` → heading 1-3; `- `/`* ` → bulletListItem; `1. ` → numberedListItem; `- [ ] `/`- [x] ` → checkListItem. Lo demás, párrafo.
- A3: el título de la página sigue siendo la primera línea, pero sin el marcador (`# Hola` → «Hola»).
- A4: sin dependencias nuevas.

## Tareas
- [x] T-1 (S1) route=inline commit=- Prueba que falla y análisis de líneas a bloques en `quickCapture.ts`. Risk: none
- [x] T-2 (S1) route=inline commit=- Título sin marcador y `typecheck` + `test` completos. Risk: none

## Evidencia
| Tarea | Comando / comprobación | Resultado observado | Fecha |
|---|---|---|---|
| T-1 | `bunx vitest run packages/core/src/capture/quickCapture.test.ts` (antes de implementar) | 1 fallo (`title` esperado «Plan»), 14 en verde | 2026-11-23 |
| T-1 | misma prueba tras implementar `parseLine` | 15 en verde | 2026-11-23 |
| T-2 | `bun run typecheck`; `bun run test` | sin errores; 329 archivos, 3 566 pruebas en verde | 2026-11-23 |

## Log
- L1: petición original: "porque no pruebas v-ia haciendo una feature que tu creas que le vendra bien a mi proyecto y me haces un benchmark de ahorro de tokens ... un widget que me apareciera un textinput para escribir aun asi no este en la app"
- L2: ese widget ya existe (captura rápida); el usuario eligió mejorar la captura.
