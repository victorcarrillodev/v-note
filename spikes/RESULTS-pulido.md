# Resultados de las verificaciones previas — spec 004 (pulido de diagramas y mapas)

Fecha: 2026-11-09 · Hito 0. Código desechable en `spikes/pulido/` (los `.e2e.spike.ts` se ejecutaban copiándolos a `tests-e2e/`; `main.tsx` + `index.html` se servían desde una carpeta temporal dentro de `packages/ui` para resolver sus dependencias).

## R-001 — Vista ampliada con posición fija → FUNCIONA
Medido en Chrome real con el diagrama dentro del editor de bloques:
- **Ningún ancestro** tiene `transform`, `filter`, `perspective`, `contain`, `will-change` ni `backdrop-filter`: `position: fixed` con `inset: 0` cubre toda la ventana (1280×813) y `elementFromPoint` en cuatro esquinas y el centro devuelve siempre el lienzo.
- El lienzo se **reencuadra solo** (de 568×418 a 1278×777) y al salir vuelve exactamente a su tamaño anterior.
- Observación: el zoom de la librería no se pudo probar por su selector antiguo (el control propio sustituyó al de la librería en la spec 003); se cubrirá en R-046 a R-050.
Decisión: **se mantiene DP-2** (sin portal).

## R-002 — Fuentes del azul al hacer clic → LISTA CERRADA
Elementos con contorno, borde o sombra del color de acento tras un clic de ratón:
1. **El propio editor (`.bn-editor`, `contenteditable`)** con `outline` por la regla global `:focus-visible`: los campos editables siempre cumplen `:focus-visible`, incluso con ratón. **Es el «resaltado azul del espacio al que le di clic»** en diagrama, mapa y cualquier bloque.
2. **Campos de texto** (`input` del panel del mapa y del diagrama): `outline` por la misma regla.
3. **Globo seleccionado del mapa**: borde de 2 px con el acento (`aria-pressed`).
4. **Elemento de la barra lateral** (`treeitem`, página abierta): borde de acento; es estado de selección de la barra, fuera del alcance de esta spec (se deja).
No aparece ningún contorno de «bloque atómico seleccionado»: la tercera fuente supuesta en el plan (§6.2) **no existe**. El anillo se quita con el detector de modalidad (DP-13), incluida la regla para el editor (sin borde de sustitución en el editor; el borde neutro reforzado solo para campos de texto).

## R-003 — Arrastrar una rama de 200 elementos sobre `@xyflow/react` → NO CUMPLE: PLAN B OBLIGATORIO
Selección de 200 nodos y arrastre de 30 pasos (equivale a mover una rama completa), con el estado de React como fuente:
- Con 199 conectores: peor fotograma **1050 ms**, p95 **333 ms**.
- Sin conectores: peor fotograma **1017 ms**, p95 **450 ms**.
El coste es de los **nodos**, no de las líneas. Aunque el globo del mapa será mucho más ligero que `ShapeNode`, no se puede confiar en pasar 200 actualizaciones por movimiento de puntero por el estado de React.
Decisión: **plan B como diseño base** (plan §9.2): durante el arrastre de una rama se mueve el conjunto con una única transformación de CSS sobre un contenedor de la rama (y se redibujan solo las líneas afectadas) y se **confirma el estado una vez al soltar**. R-169 y R-182 miden el resultado.

## R-004 — Menú anclado a un punto virtual → FUNCIONA, CON UNA REGLA
`Popover.Anchor` con `virtualRef` (rectángulo calculado con `flowToScreenPosition`, recalculado en cada cambio de la vista):
- Con el ancla visible, el menú queda **centrado en ella** (desfase horizontal 0) y a 8 px encima, en tres niveles de zoom y tras desplazar.
- Si arriba no cabe, **pasa debajo** por colisión.
- Con el ancla **fuera de la ventana**, el menú se queda pegado al borde (desfase de 65 px): hay que **ocultarlo** cuando el ancla sale del área visible del lienzo (se añade a la sección 5.3 del plan).

## R-005 — Clic frente a arrastre → FUNCIONA
Umbral de 5 px en `pointerdown`/`pointermove`/`pointerup` sobre el nodo:
- Clic sin movimiento: selecciona y el campo de texto recibe el foco.
- Arrastre de ~60 px: se registra como arrastre y **no** abre el campo.
- Temblor de 3 px: sigue contando como clic.
El campo lleva la clase `nodrag` de la librería para que escribir y seleccionar texto no mueva el nodo.

## R-006 — Punto de partida de fluidez del diagrama → 150–183 ms
Dos ejecuciones de `G-118` (200 formas, 300 conectores de 90°; desplazar, ampliar y mover una forma): peor fotograma **183 ms** y **150 ms**. Es el valor de referencia de R-068 y R-102; el objetivo sigue siendo ≤ 100 ms (RNF-1) sin empeorar este.

## R-007 y R-009 — Lector del árbol ante campos desconocidos → SIN ERROR; SE PIERDE `view`
`treeExtras.spike.ts` (se ejecutó como prueba de `packages/core`):
- Los campos adicionales de cada globo (`off`, `style`) **se conservan** al leer y al escribir: `parseTree` devuelve los mismos objetos y `serializeTree` los emite.
- El `view` de nivel superior **se pierde**, porque `parseTree` solo devuelve `{ root }`. Hay que conservarlo (R-105) y, en un lector anterior, el efecto es solo volver al alto por defecto.
- Un árbol sin campos nuevos se serializa con las mismas claves de siempre.

## R-008 — Cuadrícula actual → 20 px
El diagrama dibuja `<Background />` sin parámetros y la librería usa `gap = 20` por defecto (puntos). Coincide con la constante del plan (DP-8, D-16).

## Cambios al plan derivados de estos resultados
- §5.3: ocultar el menú cuando su ancla sale del área visible; pasar debajo si arriba no cabe.
- §6.2: las fuentes del azul son el propio editor y los campos de texto (regla `:focus-visible`) y el borde de selección del globo; se elimina la «tercera fuente» supuesta.
- §9.2 y §17: el arrastre de una rama usa transformación directa durante el gesto (plan B) y confirma una sola vez al soltar.
- §13.1: resultados anotados.
