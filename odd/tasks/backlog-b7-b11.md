---
feature: backlog-b7-b11
status: draft
created: 2026-11-27
updated: 2026-11-27
authorized-by: usuario / 2026-11-27 / B-7 a B-11 del backlog
delivery: ask-on-risk
test-runner: bun run typecheck && bun run test
---
## Specs
- S1: empieza por b7 a b11

## Tareas
- [x] T-1 (S1) route=inline commit=- B-7: racha diaria del repaso (historial por día). Risk: ítem 3 (el estado de la tarjeta gana `days`; las tarjetas viejas lo leen como vacío, con prueba)
- [ ] T-2 (S1) route=inline commit=- B-9: filtros por etiqueta y fecha en la búsqueda
- [ ] T-3 (S1) route=inline commit=- B-9: retroenlaces visibles en cada página (incluye formas del lienzo enlazadas)
- [ ] T-4 (S1) route=inline commit=- B-9: búsqueda dentro de adjuntos PDF
- [ ] T-5 (S1) route=inline commit=- B-10: recortador web hacia la captura rápida
- [ ] T-6 (S1) route=inline commit=- B-11: previsualizar PDF e imágenes con anotaciones
<!-- route=inline|delegated(<motivo: exploración | escritores paralelos | respaldo de contexto | verificador independiente>); cada tarea de código cierra con "Risk: ítem N (motivo)" o "Risk: none" -->

## Evidencia
| Tarea | Comando / comprobación | Resultado observado | Fecha |
|---|---|---|---|
| T-1 | `bun run test packages/core/src/flashcards packages/ui/src/study packages/ui/src/i18n` | RED: módulo `streak` ausente y 2 pruebas de la vista; GREEN 71 pruebas (días por tarjeta sin duplicar y con tope de 60, racha entre tarjetas, ayer cuenta, cambio de mes/año, vista «Racha» y «Mejor racha» que crece al repasar). Dos fallos fueron de mis pruebas (ayer sí cuenta; «good» repetido desborda la fecha) y se corrigieron. `bun run typecheck` limpio | 2026-11-27 |

## Log
- L1: empieza por b7 a b11
- L2: 2026-11-27 B-8 ya estaba hecho (study-features-2); el alcance real es B-7, B-9, B-10 y B-11. Prueba inestable bajo carga: PageEditorCards (aviso tarda 1,8 s en la suite completa; pasa sola).
