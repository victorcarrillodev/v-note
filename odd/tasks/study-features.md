---
feature: study-features
status: active
created: 2026-11-25
updated: 2026-11-25
test-runner: bun run typecheck && bun run test
---
## Specs
- S1: "depues quiero que anotes esos cuatro puntos en un odd y hagas uno por uno"
- Puntos aceptados: (1) ecuaciones KaTeX, (2) diagramas por texto Mermaid, (3) plantillas (apuntes de clase, algoritmo, comparativa de estructuras), (4) flashcards con repetición espaciada.
- La spec 001 los dejaba fuera del MVP; S1 los incorpora.

## Dependencias nuevas (constitución, art. 1)
- `katex`: componer ecuaciones sin servidor; sus fuentes se empaquetan con la app (sin red).
- `mermaid`: dibujar diagramas desde texto; se carga solo cuando hay un bloque, con `securityLevel: "strict"`.

## Tareas
- [x] T-1 (S1) Bloque de ecuación (KaTeX), con exportación y búsqueda
- [x] T-2 (S1) Bloque de diagrama por texto (Mermaid)
- [x] T-3 (S1) Plantillas insertables desde «/»
- [x] T-4 (S1) Flashcards con repetición espaciada

## Evidencia
| Tarea | Comando / comprobación | Resultado observado | Fecha |
|---|---|---|---|
| T-1, T-2, T-3, T-4 | `bun run typecheck && bun run test`; `bun run test:e2e studyWeb coverHeader pageZoomWeb`; `tauri build --no-bundle` | Pasan en Chrome; falta verificar a mano en el escritorio (WebKitGTK) | 2026-11-25 |
| Pulido | Plantillas con guías y tablas, cabecera común en los bloques, atajos y avance en Repaso; capturas en Chrome | Pasan `typecheck`, pruebas y `studyWeb` | 2026-11-25 |
| T-2 | `bun run typecheck && bun run test` | typecheck ok; 3610 pruebas pasan (2026-11-27) | 2026-11-27 |
| T-3 | `bun run typecheck && bun run test` | idem | 2026-11-27 |
| T-4 | `bun run typecheck && bun run test` | idem | 2026-11-27 |

## Límites conocidos
- Solo ecuaciones en bloque (no en línea).
- La exportación a HTML conserva Mermaid como código, no como dibujo.
- Importar Markdown no convierte `$$` ni ```` ```mermaid ```` en estos bloques.

## Log
- L1: "depues quiero que anotes esos cuatro puntos en un odd y hagas uno por uno"
