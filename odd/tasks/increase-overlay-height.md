---
feature: increase-overlay-height
status: superseded
updated: 2026-11-24
---
## Specs
- S1: "(petición literal no recuperada: no consta en Engram ni en la ficha)"

# Incrementar altura del sombreado de la portada

## Requisitos
- Aumentar la altura del sombreado oscuro sobre la portada en la vista de galería sin cambiar la altura de la portada en sí.
- Mantener los valores originales de `CARD_COVER_H` y las variables `--cover-height-*`.

## Criterios de aceptación
- El sombreado (overlay) se muestra más alto en la UI.
- La compilación y los tests siguen pasando.

## Tareas
1. Revertir los cambios de `CARD_COVER_H` a sus valores originales (`h-24`, `h-36`, `h-52`).
2. Revertir los valores de `--cover-height-low`, `--cover-height-medium` y `--cover-height-high` a `160px`, `240px` y `340px`.
3. Ejecutar `bun run typecheck` y `bun run test` para validar.

## Evidencia
- [x] Compilación exitosa. (reemplazada: ver release-readiness T-10; 2026-11-27 typecheck ok y 3610 pruebas pasan)
- [x] Tests pasan. (reemplazada: ver release-readiness T-10; 2026-11-27 typecheck ok y 3610 pruebas pasan)

## Siguiente paso
- Ajustar la altura del overlay usando CSS (p.ej., aumentando `height` del elemento con `bg-[var(--c-scrim)]`).

## Log
- L1: "(petición literal no recuperada: no consta en Engram ni en la ficha)"
- L2: 2026-11-24, formato de la ficha completado con autorización del usuario; el contenido previo no se ha reverificado.
- L3: 2026-11-27 cerrada como reemplazada: alturas vigentes 180/260/340 px (release-readiness T-10), `bun run typecheck` y `bun run test` pasan (3610).
