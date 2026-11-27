---
feature: increase-cover-height-further
status: superseded
updated: 2026-11-24
---
## Specs
- S1: "(petición literal no recuperada: no consta en Engram ni en la ficha)"

# Incrementar la altura del sombreado de la portada

## Requisitos
- Elevar la altura de la zona sombreada de la portada en la UI del proyecto.
- Modificar las variables CSS `--cover-height-low`, `--cover-height-medium` y `--cover-height-high` para que sean mayores que los valores actuales (220 px, 320 px, 440 px).
- Mantener la coherencia visual con los tamaños de tarjetas existentes.

## Criterios de aceptación
- La altura de la portada pasa a `--cover-height-low: 280px`, `--cover-height-medium: 380px` y `--cover-height-high: 480px` (o valores equivalentes mayores).
- La aplicación compila sin errores (`bun run typecheck`).
- Todas las pruebas siguen pasando (`bun run test`).

## Tareas
1. Editar `packages/ui/src/design/tokens.css` para actualizar los valores de las variables de altura.
2. Ejecutar `bun run typecheck` y `bun run test` para validar.

## Evidencia
- [x] Compilación exitosa. (reemplazada: ver release-readiness T-10; 2026-11-27 typecheck ok y 3610 pruebas pasan)
- [x] Tests exitosos. (reemplazada: ver release-readiness T-10; 2026-11-27 typecheck ok y 3610 pruebas pasan)

## Siguiente paso
- Verificar visualmente en modo desarrollo que la portada tiene la nueva altura más alta.

## Log
- L1: "(petición literal no recuperada: no consta en Engram ni en la ficha)"
- L2: 2026-11-24, formato de la ficha completado con autorización del usuario; el contenido previo no se ha reverificado.
- L3: 2026-11-27 cerrada como reemplazada: alturas vigentes 180/260/340 px (release-readiness T-10), `bun run typecheck` y `bun run test` pasan (3610).
