# Checklist de aceptación del Hito 3 (T-356)

Criterio 4 de la sección 9 de la spec: «se crea un diagrama de flujo con arrastrar y soltar y los cuatro organizadores gráficos dentro de una nota (RF-9, RF-10)». «Demostrado» = hay una prueba automatizada que lo ejercita en un navegador real (Chrome por CDP, con ratón y teclado reales).

Referencia: `bun run typecheck`, `bun run test` y `bun run test:e2e`.

| Elemento | Estado | Evidencia |
|---|---|---|
| Diagrama de flujo: insertar con `/`, paleta de cinco formas, arrastrar de la paleta al lienzo, mover y **redimensionar**, editar texto y color, conectar con flecha, conector que sigue a la forma, eliminar con aviso de conectores, zoom y desplazamiento, ajustar a pantalla, centrar en un extremo, deshacer/rehacer, persistir al recargar | **Demostrado** | `tests-e2e/diagram.e2e.test.ts` (T-324…T-336); modelo en `packages/core/src/diagrams/diagram.test.ts` |
| Rendimiento con 500 elementos (300 formas + 200 conectores) | **Demostrado** (con matiz) | `tests-e2e/diagramScale.e2e.test.ts` (T-337): desplazar y ampliar; percentil 95 de fotograma < 100 ms y peor fotograma < 250 ms (medido: 200 ms, un solo fotograma). Se activó `onlyRenderVisibleElements`. |
| Accesibilidad del lienzo (axe sin infracciones graves/críticas, etiquetas y foco con teclado) | **Demostrado** | `tests-e2e/diagramScale.e2e.test.ts` (T-338) |
| Mapa mental: rama e hijo, colapsar y recordar, reubicar arrastrando | **Demostrado** | `tests-e2e/organizers.e2e.test.ts` (T-341…T-343) |
| Organigrama: niveles padre-hijo, colapsar y reubicar | **Demostrado** | `tests-e2e/organizers.e2e.test.ts` (T-344, T-345) |
| Línea de tiempo: orden cronológico, empates sin solaparse, arrastrar cambia la fecha | **Demostrado** | `tests-e2e/organizers.e2e.test.ts` (T-346, T-349); modelo en `timelineMatrix.test.ts` |
| Matriz: plantilla 2×2, editar celdas, arrastrar elementos entre celdas | **Demostrado** | `tests-e2e/organizers.e2e.test.ts` (T-350, T-351) |
| Búsqueda por el texto de formas y etiquetas; respaldo y restauración sin pérdida; archivos dorados | **Demostrado** (pruebas de núcleo) | `blockText` (T-352), `backup/diagramsBackup.test.ts` (T-353), `golden/backup-v1-diagrams.json` (T-354) |

## Fuera de lo demostrado
- **Selección de un conector con el ratón.** El `click` simulado por CDP sobre el trazo SVG del conector no se genera (llegan `mousedown`/`mouseup` pero no `click`), por lo que la prueba lo selecciona con teclado (Enter, soportado por React Flow). Con ratón físico no se ha verificado.
- El estado de cada diagrama/organizador se guarda como texto JSON en una propiedad del bloque, no como estructuras Yjs anidadas (decisión D-8 del plan). Cada cambio reescribe el bloque completo. No se ha modificado el plan (`specs/` no se toca sin petición); si se quiere cumplir D-8 al pie de la letra, o actualizar el plan para reflejar este diseño, hay que pedirlo.
- Los organizadores se ejercitan en Chrome (web); no hay e2e propio en la aplicación de escritorio (Tauri).
- Al renombrar un nodo en el panel y pulsar otro enseguida, la prueba necesita una espera breve para que el bloque asiente su actualización; no se investigó si un usuario muy rápido puede perder ese clic.

Firma de aceptación: ______________________  Fecha: ______________

## Revisión visual del PDF de exportación (T-408)

`docs/export-sample.pdf` se generó con Chrome headless (`--print-to-pdf`) a partir de `packages/core/tests/golden/export-v1.html`, usando los estilos `@media print` del documento exportado. Revisado: 4 páginas; texto, listas, tabla, aviso, bloque de código y vectores legibles; la página hija empieza en página nueva; sin sombras ni recortes. Pendiente de otra persona: repetirlo en el diálogo de impresión de escritorio (T-409).
