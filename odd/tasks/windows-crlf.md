---
feature: windows-crlf
status: done
created: 2026-11-25
updated: 2026-11-25
authorized-by: usuario / 2026-11-25 / CRLF en Windows
delivery: ask-on-risk
test-runner: bun run test
---
## Specs
- S1: haz los tests necesarios

## Tareas
- [x] T-1 (S1) route=inline commit=- .gitattributes eol=lf + tests/line-endings.test.ts. Risk: none
<!-- route=inline|delegated(<motivo: exploración | escritores paralelos | respaldo de contexto | verificador independiente>); cada tarea de código cierra con "Risk: ítem N (motivo)" o "Risk: none" -->

## Evidencia
| Tarea | Comando / comprobación | Resultado observado | Fecha |
|---|---|---|---|
| T-1 | RED: vitest tests/line-endings.test.ts | 2 failed (sin .gitattributes) | 2026-11-25 |
| T-1 | GREEN: bun run typecheck && bun run test | typecheck ok; 336 files, 3589 tests passed | 2026-11-25 |

## Log
- L1: haz los tests necesarios
