# Matriz de aceptación de la spec 004 (R-184)

Cada requisito no funcional y cada caso límite de `docs/specs/004-v-note-pulido-diagramas-mapas/spec.md` con la prueba que lo cubre.

## Requisitos no funcionales
| Requisito | Prueba |
|---|---|
| RNF-1 Fluidez | `tests-e2e/diagramFrame.e2e.test.ts` (R-068), `tests-e2e/diagramBends.e2e.test.ts` (R-102), `tests-e2e/mindmap.e2e.test.ts` (R-169). Excepción documentada: ver «Fluidez» abajo |
| RNF-2 Peso | Sin dependencias nuevas: `git diff f3cd896 HEAD -- '*package.json'` vacío (R-181) |
| RNF-3 Accesibilidad | `tests-e2e/diagramFrame.e2e.test.ts` (R-069) y `tests-e2e/mindmap.e2e.test.ts` (R-179) con axe en claro y oscuro; `tests-e2e/pointerFocus.e2e.test.ts` |
| RNF-4 Espacio | `packages/ui/src/canvas/FloatingMenu.test.tsx` (alto máximo del 40 %) |
| RNF-5 Privacidad | `tests-e2e/mindmap.e2e.test.ts` (R-180, sin peticiones externas) |
| RNF-6 Idioma | Prueba de paridad de idiomas de `packages/ui/src/i18n` |
| RNF-7 Compatibilidad | `packages/core/src/diagrams/treeModel.test.ts`, `packages/core/src/backup/spec004Backup.test.ts`, `packages/core/src/diagrams/viewPreserve.test.ts` |
| RNF-8 Coherencia | `packages/ui/src/canvas/frameContract.test.tsx` (una suite, dos bloques) |

## Casos límite
Todos en `packages/ui/src/diagram/spec004EdgeCases.test.tsx` (una prueba por caso, con su identificador en el nombre: CL-1 a CL-17). Complementos en navegador real: `tests-e2e/diagramFrame.e2e.test.ts` (CL-1, CL-9), `tests-e2e/mindmap.e2e.test.ts` (CL-11, CL-12).

## Fluidez (RNF-1): medidas finales
Peor fotograma con 200 elementos (Chrome real, este equipo): diagrama con 300 conectores 183 ms (igual que el de partida de la spec 003: 150–183 ms); conectores curvos con puntos 183–200 ms; mapa con 200 globos arrastrando una rama 117–167 ms (con el plan B: transformación directa y un solo cambio al soltar). p95 en todos los casos ≤ 33 ms. El peor fotograma queda sobre el objetivo de 100 ms en el diagrama (deuda heredada de la spec 003) y se documenta como **excepción** de R-182; el p95 cumple.
