---
feature: increase-cover-height-further
status: in-progress
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
- [ ] Compilación exitosa.
- [ ] Tests exitosos.

## Siguiente paso
- Verificar visualmente en modo desarrollo que la portada tiene la nueva altura más alta.

## Log
- L1: "(petición literal no recuperada: no consta en Engram ni en la ficha)"
- L2: 2026-11-24, formato de la ficha completado con autorización del usuario; el contenido previo no se ha reverificado.
