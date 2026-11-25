---
feature: subrayado-con-estilo
status: done
created: 2026-11-23
updated: 2026-11-23
authorized-by: usuario / 2026-11-23 / agregar subrayado con estilo al editor (sin commit ni push)
delivery: ask-on-risk
test-runner: bun run typecheck && bun run test (e2e: bunx vitest run -c vitest.e2e.config.ts <archivo>)
---
## Specs
- S1: "quiero que agregues la opcion de poder subrayyar los textos, quiero que te enfoques en esa tarea bien, ya que quiero que tenga la opcion de poder hacer un subrrayado lizo como de maquina, uno mas o menos difuminado y uno que parezca que fue hecho por un marcatextos rapido y que funcione integrandose bien en la app, si necesitas mas contexto puedes hacerme preguntas y recuerda que deben haber diferentes colores del subrrayado"

## Supuestos
- A1: el subrayado simple (Ctrl+U, `underline: true`) no cambia; el nuevo es un estilo en línea `underlineStyle` con valor «tipo:color».
- A2: tipos `line` (liso), `soft` (difuminado), `marker` (marcatextos). Colores: los 9 de bloque.
- A3: se elige desde la barra de formato al seleccionar texto (botón con ventana: 3 tipos × colores + Quitar).
- A4: colores propios en tokens (claro/oscuro) para que el marcatextos sea vivo; el documento exportado trae los mismos estilos.
- A6: el botón nuevo reemplaza al de subrayado simple en la barra (Ctrl+U sigue); atajo propio Ctrl+Alt+U (aplica el último o quita).
- A5: el Markdown exportado no puede representar el subrayado: queda el texto plano (igual que el subrayado simple de hoy).

## Tareas
- [x] T-1 (S1) route=inline commit=- Núcleo: gramática `underlineStyle` (`blocks/underline.ts`) + pruebas. Risk: none
- [x] T-2 (S1) route=inline commit=- Tokens de color del subrayado (claro/oscuro) + `tokens.css` + guía de estilo + pruebas de contraste/paridad. Risk: none
- [x] T-3 (S1) route=inline commit=- Estilo del editor (`createReactStyleSpec`) y CSS de los tres tipos. Risk: none
- [x] T-4 (S1) route=inline commit=- Botón y ventana en la barra de formato (teclado, etiquetas es/en, quitar). Risk: none
- [x] T-5 (S1) route=inline commit=- Exportación HTML/PDF: `<span class="ul" data-ul-*>` + CSS + paleta; Markdown en texto plano. Risk: none
- [x] T-6 (S1) route=inline commit=- Pegado/sanidad, deshacer/rehacer y respaldo (viaje de ida y vuelta Yjs). Risk: none
- [x] T-7 (S1) route=inline commit=- e2e en Chrome con captura visual de los tres tipos y varios colores en claro y oscuro. Risk: none

## Evidencia
| Tarea | Comando / comprobación | Resultado observado | Fecha |
|---|---|---|---|
| T-1 | `bunx vitest run packages/core/src/blocks/underline.test.ts` | 2 pruebas en verde | 2026-11-23 |
| T-2 | `bunx vitest run packages/ui/src/design` (tokens, cssTokens, underlineTokens) | 267+2 en verde; tokens.css con 18 variables `--underline-*` | 2026-11-23 |
| T-3 | `bunx vitest run packages/ui/src/editor/underlineStyle.test.tsx` + capturas de Chrome | 5 en verde; CSS idéntico al del núcleo, sin colores sueltos | 2026-11-23 |
| T-4 | e2e `underline.e2e.test.ts` (clics reales, panel en portal, atajo) | 4 en verde | 2026-11-23 |
| T-5 | `bunx vitest run packages/core/src/export packages/ui/src/design/exportPalette.test.ts` | 133 en verde; hoja sin subrayados byte a byte igual | 2026-11-23 |
| T-6 | `sanitize.test.ts` + e2e copiar/pegar + ida y vuelta Yjs | en verde | 2026-11-23 |
| T-7 | `E2E_SHOTS=… bunx vitest run -c vitest.e2e.config.ts tests-e2e/underline.e2e.test.ts` | 4 en verde; capturas revisadas (claro y oscuro) | 2026-11-23 |
| todo | `bun run typecheck`; `bun run test` | sin errores; 329 archivos, 3 561 pruebas | 2026-11-23 |
| web e2e | `underline` + `pageOptions` + `a11y` + `privacy` | en verde. `editor`/`blocks` (escritorio) se cuelgan con `tauri dev` del usuario abierto: no verificado | 2026-11-23 |

## Log
- L1: "ahora tambien quiero que agregues la opcion de poder subrayyar los textos, quiero que te enfoques en esa tarea bien, ya que quiero que tenga la opcion de poder hacer un subrrayado lizo como de maquina, uno mas o menos difuminado y uno que parezca que fue hecho por un marcatextos rapido y que funcione integrandose bien en la app, si necesitas mas contexto puedes hacerme preguntas y recuerda que deben haber diferentes colores del subrrayado"
- L2: node_modules está vetado por permisos: la API de BlockNote 0.57 se valida con `tsc` y no leyendo el paquete.
