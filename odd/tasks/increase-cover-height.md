---
feature: increase-cover-height
status: in-progress
updated: 2026-11-24
---
## Specs
- S1: "(petición literal no recuperada: no consta en Engram ni en la ficha)"

# Increase cover overlay height

## Requisitos
- Las portadas de las tarjetas en la vista galería deben tener una altura mayor para que el oscurecido sea más visible.
- Se debe respetar los tamaños existentes (small, medium, large) pero aumentarlos aproximadamente 1.33x.

## Criterios de aceptación
- En la vista de galería, los valores de `CARD_COVER_H` deben ser `h-32` (small), `h-48` (medium) y `h-64` (large).
- El cambio no debe romper la compilación ni los tests existentes.

## Tareas
1. Modificar `packages/ui/src/databases/ListGalleryViews.tsx` para actualizar `CARD_COVER_H`.
2. Ejecutar `bun run typecheck` y `bun run test` para validar.

## Evidencia
- [x] Compilación exitosa (`bun run typecheck`).
- [ ] Tests pasan (se verifica en CI).

## Siguiente paso
- Revisar visualmente la UI en modo desarrollo para confirmar la nueva altura.

## Log
- L1: "(petición literal no recuperada: no consta en Engram ni en la ficha)"
- L2: 2026-11-24, formato de la ficha completado con autorización del usuario; el contenido previo no se ha reverificado.
