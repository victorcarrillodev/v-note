# Resultados de las verificaciones previas — spec 003 (diagramas)

Fecha: 2026-11-07 · Hito 0. Código desechable en `spikes/diagramas/`.

## G-001 — Capa SVG/HTML propia dentro del lienzo de `@xyflow/react` 12.12 → FUNCIONA
`ViewportPortal` está exportado en 12.12.0. Probado en Chrome real (`spikes/diagramas/viewportPortal.e2e.spike.ts`, copia del e2e temporal que se retiró de `tests-e2e/`):
- **Zoom:** un elemento de 50 px en el lienzo pasó a 60 y 72 px al acercar dos veces (sigue la transformación de la vista).
- **Desplazamiento:** al arrastrar el fondo, la capa se movió con el lienzo.
- **Puntero:** `pointerdown` sobre la capa llegó a su manejador (con `pointerEvents: all` y `stopPropagation`) sin romper la selección de formas.
Decisión: **se mantiene DP-3** (conectores en capa propia). No hace falta la alternativa de capa hermana.

## G-002 — Cómo se dibuja hoy un conector → HALLAZGO que corrige la regla de migración
- **En pantalla** (`DiagramEditor.tsx`): todos los conectores usan `sourceHandle: "right"` y `targetHandle: "left"` con el trazo por defecto de la librería (curva Bézier). Es decir, **salen del lado este de la forma de origen y llegan al lado oeste de la de destino**, sin importar dónde estén las formas. Esta es justamente la causa de «se conectan donde ellos quieren».
- **En la exportación SVG** (`export/svg.ts`): línea recta **centro a centro** recortada al borde. Pantalla y exportación ya eran distintas.
Decisión: la migración une los conectores v1 a los anclajes **este → oeste con trazado redondeado** (lo que la persona ve en pantalla) y no «al anclaje más cercano al trazo» como suponía el plan. La exportación conserva su dibujo anterior durante el Hito 0 (sin cambiar el archivo dorado de exportación) y pasa a usar los anclajes en el Hito 1 (G-063 y siguientes). Plan 4.4 actualizado.

## G-003 — Tokens de color de bloque → COMPLETO
Los nueve colores de bloque (`gray, brown, red, orange, yellow, green, blue, purple, pink`) tienen `--block-<id>-bg` y `--block-<id>-text` en ambos temas (`tokens.css`). Basta para relleno (`-bg`) y contorno/texto (`-text`). Para la tinta se usa `--c-text` y para el blanco `--c-card`. No falta ningún token.

## G-004 — Rendimiento del enrutador de 90° → DENTRO DEL PRESUPUESTO
A* con coste de giro 20 sobre rejilla comprimida (`spikes/diagramas/route-bench.ts`, 200 formas, 300 conectores, solo dos obstáculos por ruta):
- 300 conectores completos: **≈ 18 ms**.
- Mover una forma con 10 conectores: **≈ 0,35 ms** de media.
Muy por debajo de 100 ms (RNF-1). Sin plan B necesario.

## G-005 — Contenido del respaldo de un diagrama
`data/<id>.json` guarda la página con `blocks[*].props.data` = el texto JSON del diagrama (cadena). El Markdown legible (`pages/*.md`) se genera con `blocksToMarkdown`: `> Diagrama`, una línea por forma `> - texto [forma]` y una por conector `> - A → B (etiqueta)`. Consecuencias:
- La v2 viaja dentro de `data/<id>.json` sin cambiar el formato del respaldo; el archivo dorado `backup-v1-diagrams.json` cambia **solo** en esa línea (se actualizó a propósito) y el Markdown queda idéntico.
- Se conservó la salida anterior en `packages/core/tests/golden/backup-pre003-diagrams.json` y una prueba restaura ese respaldo anterior y abre su diagrama (G-040).

## G-006 — Cada espacio tiene su propia base y su `meta`
`WorkspaceManager` abre un `SqlStore` por espacio y todas las bases se migran con `meta(key, value)`. Prueba durable: `packages/core/src/db/metaPerWorkspace.test.ts` (dos bases con valores distintos para la misma clave, sin verse entre sí).

## Otros hallazgos
- Pre-existente: `tests-e2e/diagram.e2e.test.ts` comprobaba `rgb(220, 252, 231)` tras elegir el color verde, pero desde la spec 002 el relleno se dibuja con el token `--block-green-bg` (`rgb(221, 241, 229)`); el e2e estaba desactualizado. Se corrigió la expectativa y el valor del selector (`palette:green`).

## Hito 3 — mediciones finales
### G-169 — Fluidez con 200 formas y 300 conectores de 90° (Chrome real, `tests-e2e/diagramScale.e2e.test.ts`)
- Peor fotograma al desplazar, ampliar y mover una forma con conectores: **150–170 ms** (presupuesto de la prueba: 250 ms; el 95.º percentil de los fotogramas, < 100 ms). El cálculo de las rutas de una forma movida con 10 conectores tarda unos milisegundos (`path.perf.test.ts`).
- Antes de optimizar medía ~400 ms: el perfil del navegador mostró que la búsqueda A* de las 300 rutas se repetía en cada movimiento del puntero. Se añadió una **memoria acotada de rutas** (2000 entradas, por geometría) y la capa de conectores se **memoriza** (solo se redibuja si cambia algo que usa).
- El presupuesto RNF-1 (< 100 ms por interacción) se cumple en el cálculo; el peor fotograma medido de un arrastre con el panel de estilo apareciendo sigue por encima de 100 ms en este equipo con diagramas de ese tamaño.

### G-170 — Peso
- **Cero dependencias nuevas.** El código nuevo suma ≈ 130 KB de fuente (núcleo ≈ 75 KB, interfaz ≈ 55 KB), unos **50–60 KB** minificados, ≈ 2 % del JS principal actual (3,0 MB). No hay un tope de JS en la spec 002 (solo el de 200 KB de tipografías, que no cambia).
