---
feature: icon-margin
status: done
updated: 2026-11-24
---
## Specs
- S1: "(petición literal no recuperada: no consta en Engram ni en la ficha)"

# Tarea: Ajuste de margen vertical del ícono y contenedor

## Requisitos
- El ícono de cada página/subpágina debe tener un margen vertical para que no quede tan cerca de la descripción.
- El contenedor del ícono no debe permitir que el ícono se desborde.
- Las esquinas del contenedor del ícono deben ser menos redondeadas (usar `rounded-sm` en el ícono y `rounded-2xl` en el contenedor).

## Criterios de aceptación
- En el modo de página con `iconOverlap` activo, el ícono tiene clases `mt-2 mb-2 overflow-hidden`.
- El ícono utiliza `rounded-sm` en `PageIcon`.
- El contenedor utiliza `rounded-2xl` (manteniendo la expectativa del test).
- Todas las pruebas unitarias relacionadas (`pageHeaderCard.test.tsx`) pasan.

## Tareas
- [x] T-1 (S1) Ícono con margen y sin desborde (el cabecero actual lo resuelve con overflow-hidden y rounded-md). Risk: none

## Detalle
- Modificado `packages/ui/src/page/icon/PageIcon.tsx` para usar `rounded-sm` en lugar de `rounded-[var(--radius-base)]`.
- Modificado `packages/ui/src/page/PageHeader.tsx` para agregar margen vertical y evitar desbordamiento en el contenedor del ícono, y asegurar la clase `rounded-2xl`.
- Añadido `mt-2 mb-2 overflow-hidden` al `iconBox`.
- Actualizado clase del `descriptionField` para incluir `mt-2` (opcional ajuste visual).

## Evidencia
| Tarea | Comando / comprobación | Resultado observado | Fecha |
|---|---|---|---|
| T-1 | `bun run test packages/ui/src/page/pageHeaderCard.test.tsx` | 35 pruebas pasan | 2026-11-27 |

- [x] `bun run test packages/ui/src/page/pageHeaderCard.test.tsx` muestra que todas las pruebas pasan (35/35).

## Siguiente paso
- Verificar visualmente en la aplicación web y de escritorio que el ícono tiene el margen esperado y que no se desborde.

## Log
- L1: "(petición literal no recuperada: no consta en Engram ni en la ficha)"
- L2: 2026-11-24, formato de la ficha completado con autorización del usuario; el contenido previo no se ha reverificado.
- L3: 2026-11-27 reverificado: `PageHeader.tsx` mantiene el ícono con `overflow-hidden`; las clases exactas (`rounded-2xl`) cambiaron en rediseños posteriores del cabecero.

