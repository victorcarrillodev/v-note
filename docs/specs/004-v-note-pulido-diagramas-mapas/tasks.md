# Tareas 004 — Pulido de diagramas de flujo y mapas mentales

> Deriva de `spec.md` y `plan.md` de esta carpeta. Cada tarea es pequeña (**máx. 20–30 min**), está en **orden de dependencia** y cubre uno o más RF/RNF/CL.
> **Regla de ejecución (TDD):** en cada tarea se escribe **primero la prueba** (debe fallar), luego la implementación, y se marca el checkbox solo cuando se cumple **«Hecho cuando»** y `bun run typecheck` y `bun run test` pasan (constitución, art. 4).
> Las verificaciones previas del Hito 0 viven en `spikes/`, son desechables y sus resultados se anotan en `spikes/RESULTS-pulido.md`. Si una verificación falla, **se detiene el trabajo y se actualiza el plan** antes de seguir (AGENTS).
> **Hitos cerrados en orden** (art. 2): no se empieza un hito hasta cerrar el anterior. Dentro de un grupo, el orden de las tareas es el de ejecución; **Requiere** indica de qué grupo depende.
> **Tareas manuales:** las marcadas «(tarea manual)» o «(lista firmada)» necesitan a la persona responsable; no se pueden cerrar solo con pruebas.
> **Alcance:** diagrama de flujo y mapa mental. El organigrama, la línea de tiempo y la matriz no se tocan (salvo puntero y foco, que son globales).
> **Total:** 191 tareas · Hito 0: 11 · Hito 1: 60 · Hito 2: 32 · Hito 3: 67 · Hito 4: 21
> **Estado:** pendiente de empezar.

---

## HITO 0 — Verificaciones

### Verificaciones previas (código desechable en `spikes/`)

*Requiere: nada. Resultados en `spikes/RESULTS-pulido.md`.*

- [ ] **R-001** Probar la vista ampliada dejando el lienzo montado y en posición fija sobre la ventana, dentro del editor de bloques: ¿algún ancestro con `transform` u `overflow` lo rompe? ¿el lienzo se reencuadra al cambiar de tamaño? — *Cubre:* RF-3, CL-9 (DP-2). **Hecho cuando:** Spike indica funciona o falla; si falla, alternativa «portal con estado elevado» probada y decisión escrita.
- [ ] **R-002** Medir el color de contorno calculado al hacer clic en un diagrama, un mapa y bloques atómicos, y listar todas las reglas que producen el azul — *Cubre:* RF-5. **Hecho cuando:** Lista completa de fuentes del azul anotada en `RESULTS-pulido.md`.
- [ ] **R-003** Medir el arrastre de una rama completa en un mapa de 200 globos sobre `@xyflow/react` — *Cubre:* RNF-1, RF-11 (DP-4). **Hecho cuando:** Peor fotograma medido; si pasa de 100 ms, plan B anotado (mover la rama fuera del estado hasta soltar).
- [ ] **R-004** Probar un menú emergente anclado a un punto virtual que sigue el desplazamiento y el zoom del lienzo — *Cubre:* RF-1 (DP-3). **Hecho cuando:** Spike sin parpadeo ni desfase en 3 niveles de zoom.
- [ ] **R-005** Probar clic frente a arrastre sobre un nodo con campo de texto (umbral de 5 px) — *Cubre:* RF-14. **Hecho cuando:** Spike distingue clic de arrastre con ratón y con puntero táctil simulado.
- [ ] **R-006** Medir el punto de partida de fluidez del diagrama con 200 formas y 300 conectores — *Cubre:* RNF-1. **Hecho cuando:** Peor fotograma de referencia anotado.
- [ ] **R-007** Confirmar que `parseTree` y `serializeTree` hoy conservan o pierden campos desconocidos del árbol y de los globos — *Cubre:* RF-16, RNF-7. **Hecho cuando:** Comportamiento actual anotado con un caso de prueba.
- [ ] **R-008** Confirmar el paso de la cuadrícula que dibuja hoy el diagrama y que coincide con la constante del plan (20 px) — *Cubre:* RF-18. **Hecho cuando:** Medición anotada (o plan corregido).
- [ ] **R-009** Confirmar con una prueba de lectura que el lector actual del árbol acepta campos adicionales en los globos — *Cubre:* RNF-7. **Hecho cuando:** Test de spike pasa o se anota qué cambia.
- [ ] **R-010** Documentar en `docs/backup-format.md` los campos aditivos (`off`, `style`, `view`) sin cambiar `formatVersion` — *Cubre:* RF-16. **Hecho cuando:** Documento revisado; coincide con la sección 11 del plan.
- [ ] **R-011** Cerrar el Hito 0: actualizar el plan con los resultados (DP-2, DP-3, DP-4, valores de la sección 16) — *Cubre:* RNF-8. **Hecho cuando:** Plan actualizado y sin decisiones abiertas.

---

## HITO 1 — Base común (puntero, foco, cuadrícula, menú, marco) y diagrama

### Núcleo: cuadrícula, vista e historial

*Requiere: Verificaciones previas.*

- [ ] **R-012** `grid.ts`: constante de cuadrícula y `snap` de un valor al múltiplo más cercano — *Cubre:* RF-18. **Hecho cuando:** Test con negativos, medias y múltiplos exactos.
- [ ] **R-013** `grid.ts`: `snapPoint` — *Cubre:* RF-18. **Hecho cuando:** Test: ambos ejes se acomodan.
- [ ] **R-014** `grid.ts`: `snapBox` acomoda esquina y bordes y respeta el tamaño mínimo — *Cubre:* RF-18, CL-16. **Hecho cuando:** Test: mínimo no múltiplo sube al siguiente múltiplo.
- [ ] **R-015** `grid.ts`: `snapOffset` calcula el desplazamiento que deja un elemento en un punto de la cuadrícula — *Cubre:* RF-18, CL-17. **Hecho cuando:** Test: posición efectiva resultante es múltiplo exacto.
- [ ] **R-016** `view.ts`: alto por defecto, mínimo y máximo, y `clampHeight` — *Cubre:* RF-12. **Hecho cuando:** Test de límites y de valores no numéricos.
- [ ] **R-017** `view.ts`: lectura y escritura tolerantes del `view` del diagrama; sin cambio de bytes si no hay `view` — *Cubre:* RF-12, RF-16. **Hecho cuando:** Test: un diagrama sin editar se serializa idéntico a la golden anterior.
- [ ] **R-018** `history.ts`: utilidad genérica de instantáneas con límite 100 — *Cubre:* RF-15. **Hecho cuando:** Test de deshacer, rehacer, límite y descarte del futuro al editar.
- [ ] **R-019** `DiagramHistory` se apoya en la utilidad genérica sin cambiar su interfaz — *Cubre:* RF-15. **Hecho cuando:** La suite existente de historial pasa sin cambios.
- [ ] **R-020** Exportar las funciones nuevas del núcleo desde el índice del paquete — *Cubre:* RF-18. **Hecho cuando:** Test de importación público pasa.

### Puntero y foco globales

*Requiere: Núcleo: cuadrícula, vista e historial.*

- [ ] **R-021** Regla global de puntero por rol y estado en tokens (botón, enlace, pestaña, opción, ítem de menú, casilla, interruptor, control deslizante) — *Cubre:* RF-4. **Hecho cuando:** Test sobre el CSS: cada selector de la lista resuelve a `pointer`.
- [ ] **R-022** Regla de «no permitido» para `:disabled` y `[aria-disabled="true"]` — *Cubre:* RF-4. **Hecho cuando:** Test: deshabilitado resuelve a `not-allowed` y no responde al clic.
- [ ] **R-023** Clase de utilidad de elementos clicables no nativos y cursores de mover y de redimensionar — *Cubre:* RF-4. **Hecho cuando:** Test: la clase da `pointer`, `grab`/`grabbing` y los cursores de redimensión.
- [ ] **R-024** Retirar los cursores fijados en línea que contradicen la regla (p. ej. el del globo del mapa) — *Cubre:* RF-4. **Hecho cuando:** Búsqueda sin coincidencias fuera de la clase de utilidad.
- [ ] **R-025** Detector de modalidad de entrada que fija `data-input` en `pointer` o `keyboard` — *Cubre:* RF-5. **Hecho cuando:** Test: `pointerdown` pone `pointer`; Tab, flechas, Enter o Esc ponen `keyboard`.
- [ ] **R-026** Regla de foco: anillo doble solo con `data-input="keyboard"`; con `pointer` no hay anillo azul — *Cubre:* RF-5, RNF-3. **Hecho cuando:** Test de ambos estados en claro y oscuro.
- [ ] **R-027** Borde de control reforzado neutro para campos de texto con foco de ratón — *Cubre:* RF-5. **Hecho cuando:** Test: sin azul de acento y con contraste ≥ 3:1 contra el fondo.
- [ ] **R-028** Neutralizar las fuentes del azul listadas en R-002 (contorno de selección de bloque y otras) — *Cubre:* RF-5. **Hecho cuando:** Test e2e: tras un clic, ningún contorno calculado usa el color de acento.
- [ ] **R-029** Halo neutro de selección y borde más grueso, con contraste ≥ 3:1 en ambos temas — *Cubre:* RF-5, RNF-3. **Hecho cuando:** Test de contraste en claro y oscuro.
- [ ] **R-030** Mantener el anillo del sistema en contraste forzado — *Cubre:* RF-5. **Hecho cuando:** Test de la regla para `forced-colors`.
- [ ] **R-031** Prueba de contrato de puntero en navegador real sobre botones de la app — *Cubre:* RF-4. **Hecho cuando:** e2e: todo `button` y `role=button` visible resuelve a `pointer` o a `not-allowed` si está deshabilitado.

### Menú emergente

*Requiere: Puntero y foco globales.*

- [ ] **R-032** `FloatingMenu` anclado a un elemento DOM, con colisión y reubicación — *Cubre:* RF-1, CL-1. **Hecho cuando:** Test: cerca de cada borde el menú queda completo y visible.
- [ ] **R-033** `FloatingMenu` anclado a un punto virtual que sigue desplazamiento y zoom — *Cubre:* RF-1. **Hecho cuando:** Test: el menú se reposiciona al cambiar la ventana de vista.
- [ ] **R-034** El menú no tapa el elemento y no pasa del 40 % del alto visible, con desplazamiento interno — *Cubre:* RNF-4. **Hecho cuando:** Test de alto máximo y de no solapamiento.
- [ ] **R-035** Cierre con Esc, clic en vacío y cambio de selección (el menú pasa al nuevo elemento) — *Cubre:* RF-1, CL-2. **Hecho cuando:** Test de los tres cierres y del cambio de elemento.
- [ ] **R-036** Menú no modal que no roba el foco al abrirse — *Cubre:* RF-1, RF-14. **Hecho cuando:** Test: el foco permanece en el campo de texto al abrir el menú.
- [ ] **R-037** Grupos con etiqueta e ícono (Apariencia, Estructura, Acciones) en orden estable por tipo de elemento — *Cubre:* RF-2. **Hecho cuando:** Test: mismo orden en dos renders del mismo tipo.
- [ ] **R-038** Menú operable con teclado y anunciado con rol, nombre y estado — *Cubre:* RF-2, RNF-3. **Hecho cuando:** Test: flechas, Enter y Esc; la auditoría de accesibilidad no reporta errores.
- [ ] **R-039** Textos del menú en español de México y en inglés — *Cubre:* RNF-6. **Hecho cuando:** La prueba de paridad de idiomas pasa.

### Marco del lienzo

*Requiere: Menú emergente.*

- [ ] **R-040** `CanvasFrame`: ancho de la columna y alto desde los datos del bloque — *Cubre:* RF-12. **Hecho cuando:** Test: ocupa el ancho del contenedor y el alto guardado o el de por defecto.
- [ ] **R-041** Asa de alto ajustable con ratón, dedo y teclado (flechas) — *Cubre:* RF-12, RF-17. **Hecho cuando:** Test: arrastrar y flechas cambian el alto dentro de mínimo y máximo.
- [ ] **R-042** El gesto de cambiar el alto genera un solo paso de historial al soltar — *Cubre:* RF-12, RF-15. **Hecho cuando:** Test: un arrastre largo = un paso; deshacer devuelve el alto anterior.
- [ ] **R-043** Barra de zoom con acercar, alejar, restablecer al 100 %, ajustar a la vista y porcentaje — *Cubre:* RF-13. **Hecho cuando:** Test de cada botón y del porcentaje mostrado.
- [ ] **R-044** Interruptores de mostrar cuadrícula y acomodar a cuadrícula — *Cubre:* RF-18. **Hecho cuando:** Test: cada interruptor cambia su estado y lo anuncia.
- [ ] **R-045** Preferencias de cuadrícula en el dispositivo con lectura tolerante a fallo — *Cubre:* RF-18. **Hecho cuando:** Test: valores iniciales «sí/sí»; sin almacenamiento sigue funcionando.
- [ ] **R-046** Vista ampliada: el lienzo cubre la ventana, con `role="dialog"`, `aria-modal` y fondo opaco — *Cubre:* RF-3. **Hecho cuando:** Test: ocupa toda la ventana y el resto de la interfaz queda inerte.
- [ ] **R-047** Vista ampliada: foco atrapado y devuelto al botón de origen — *Cubre:* RF-3, RNF-3. **Hecho cuando:** Test: Tab no sale del lienzo; al salir el foco vuelve al botón.
- [ ] **R-048** Vista ampliada: barra con Salir, deshacer, rehacer y controles de zoom y encuadre — *Cubre:* RF-3. **Hecho cuando:** Test de presencia y función de cada control.
- [ ] **R-049** Vista ampliada: Esc actúa en capas (primero menús o cuadros, luego la vista) — *Cubre:* RF-3. **Hecho cuando:** Test con un menú abierto: el primer Esc lo cierra y el segundo sale.
- [ ] **R-050** Vista ampliada conserva selección, zoom, posición y texto a medio escribir al entrar y salir — *Cubre:* RF-3, CL-9. **Hecho cuando:** Test: ida y vuelta sin perder nada.
- [ ] **R-051** Vista ampliada bloquea el desplazamiento de la página y la devuelve al mismo punto al salir — *Cubre:* RF-3. **Hecho cuando:** Test: el desplazamiento de la página no cambia tras salir.
- [ ] **R-052** El marco se adapta al cambio de ancho de la ventana o de la barra lateral sin desorientar la vista — *Cubre:* CL-11. **Hecho cuando:** Test: ancho nuevo sin perder la posición si la persona ya movió la vista.

### El diagrama usa el marco, los menús y el acomodo

*Requiere: Marco del lienzo.*

- [ ] **R-053** `DiagramEditor` se monta dentro de `CanvasFrame` — *Cubre:* RF-12, RNF-8. **Hecho cuando:** Test: mismo ancho que otros bloques y alto ajustable guardado.
- [ ] **R-054** El alto del diagrama se guarda en `view` y los diagramas existentes conservan 420 px — *Cubre:* RF-12, RF-16. **Hecho cuando:** Test: diagrama antiguo se abre con 420 px sin reescribirse.
- [ ] **R-055** Eliminar la franja inferior de formas y conectores — *Cubre:* RF-1. **Hecho cuando:** Test: no existe la región inferior de paneles.
- [ ] **R-056** Menú emergente de forma con apariencia (relleno, contorno, texto, forma) y acciones — *Cubre:* RF-1, RF-2. **Hecho cuando:** Test: seleccionar una forma muestra su menú junto a ella.
- [ ] **R-057** Menú emergente de conector con trazado, extremos, puntas, estilo y etiqueta — *Cubre:* RF-1, RF-2. **Hecho cuando:** Test: seleccionar un conector muestra su menú.
- [ ] **R-058** Controles generales compactos sobre el lienzo (insertar forma, zoom, ampliar, deshacer, rehacer) cuando no hay selección — *Cubre:* RF-1. **Hecho cuando:** Test: barra delgada arriba y nada debajo del lienzo.
- [ ] **R-059** El menú sigue al elemento al arrastrar, hacer zoom o desplazar sin tapar lo que se manipula — *Cubre:* RF-1, RNF-4. **Hecho cuando:** Test de seguimiento en los tres gestos.
- [ ] **R-060** Acomodo a cuadrícula al mover formas, con vista previa durante el arrastre — *Cubre:* RF-18. **Hecho cuando:** Test: las posiciones resultantes son múltiplos de la cuadrícula.
- [ ] **R-061** Acomodo a cuadrícula al redimensionar formas, también durante el gesto — *Cubre:* RF-18, CL-16. **Hecho cuando:** Test: bordes acomodados y tamaño mínimo respetado.
- [ ] **R-062** Formas nuevas (insertadas y pegadas) se colocan en un punto de la cuadrícula — *Cubre:* RF-18. **Hecho cuando:** Test de inserción y de pegado.
- [ ] **R-063** Alt suspende el acomodo mientras se arrastra; el interruptor lo apaga del todo — *Cubre:* RF-18. **Hecho cuando:** Test: con Alt o con el interruptor apagado el movimiento es libre.
- [ ] **R-064** Los diagramas existentes no se mueven al abrirlos — *Cubre:* RF-18, CL-15. **Hecho cuando:** Test: diagrama con posiciones fuera de cuadrícula se abre sin cambios y sin reescribirse.
- [ ] **R-065** El diagrama de flujo usa las preferencias de cuadrícula compartidas — *Cubre:* RF-18. **Hecho cuando:** Test: cambiar el interruptor lo recuerda al reabrir.

### Cierre del Hito 1

*Requiere: El diagrama usa el marco, los menús y el acomodo.*

- [ ] **R-066** e2e del diagrama: seleccionar → menú junto al elemento; ampliar y salir; acomodo al mover y al redimensionar — *Cubre:* RF-1, RF-3, RF-12, RF-18. **Hecho cuando:** e2e pasa en navegador real.
- [ ] **R-067** e2e de puntero y de foco: sin anillo azul con clic y anillo con Tab — *Cubre:* RF-4, RF-5. **Hecho cuando:** e2e pasa.
- [ ] **R-068** Medir fluidez del diagrama con 200 formas y 300 conectores en el marco nuevo — *Cubre:* RNF-1. **Hecho cuando:** Peor fotograma no peor que el de R-006 o ≤ 100 ms.
- [ ] **R-069** Auditoría de accesibilidad del diagrama, menús y vista ampliada en claro y oscuro — *Cubre:* RNF-3. **Hecho cuando:** Sin errores.
- [ ] **R-070** Actualizar las pruebas e2e y de interfaz que dependían de la franja inferior — *Cubre:* RF-1. **Hecho cuando:** Toda la suite pasa con los selectores nuevos.
- [ ] **R-071** Cerrar el Hito 1: `bun run typecheck` y `bun run test` pasan — *Cubre:* RNF-8. **Hecho cuando:** Ambos comandos pasan y el estado se anota arriba.

---

## HITO 2 — Conectores

### Puntos de quiebre en el núcleo

*Requiere: Todos los grupos del Hito 1.*

- [ ] **R-072** `nearestOnPath` en trazado recto: proyección del clic y segmento más cercano — *Cubre:* RF-7. **Hecho cuando:** Test con 5 casos conocidos.
- [ ] **R-073** `nearestOnPath` en trazado de 90° y libre — *Cubre:* RF-7. **Hecho cuando:** Test con tramos horizontales, verticales y quiebres.
- [ ] **R-074** `nearestOnPath` en trazado curvo — *Cubre:* RF-7, RF-8. **Hecho cuando:** Test: error de proyección < 1 unidad sobre la curva.
- [ ] **R-075** `addBendAt`: inserta el punto en la posición correcta de la lista en 90° (`waypoints`) — *Cubre:* RF-7. **Hecho cuando:** Test: el orden de los puntos sigue el recorrido del conector.
- [ ] **R-076** `addBendAt`: inserta en curvo y libre (`points`) — *Cubre:* RF-7. **Hecho cuando:** Test de orden y de que el conector conserva su trazado.
- [ ] **R-077** `addBendAt` no coloca el punto encima de los extremos (distancia mínima) y acomoda a cuadrícula si está activa — *Cubre:* RF-7, CL-4, RF-18. **Hecho cuando:** Test: doble clic muy cerca de un anclaje separa el punto del extremo.
- [ ] **R-078** `removeBend`: quita el punto indicado y rehace el trazado — *Cubre:* RF-6. **Hecho cuando:** Test en los tres trazados.
- [ ] **R-079** `removeBend` del único punto devuelve el trazado directo de su tipo — *Cubre:* RF-6, CL-3. **Hecho cuando:** Test: sin puntos intermedios el conector queda directo.
- [ ] **R-080** Las operaciones devuelven error claro con conector o índice inexistente — *Cubre:* RF-6, RF-7. **Hecho cuando:** Test de errores sin lanzar excepciones.

### Curva continua

*Requiere: Puntos de quiebre en el núcleo.*

- [ ] **R-081** Curva sin puntos intermedios: Bézier que sale de cada anclaje en su dirección, sin tramos rectos — *Cubre:* RF-8. **Hecho cuando:** Test: ningún tramo es recto y las tangentes coinciden con los anclajes.
- [ ] **R-082** Curva con puntos intermedios: Catmull-Rom centrípeta convertida a Béziers cúbicos — *Cubre:* RF-8. **Hecho cuando:** Test: la curva pasa por cada punto.
- [ ] **R-083** Continuidad sin esquinas en cada punto (tangente entrante = saliente) — *Cubre:* RF-8. **Hecho cuando:** Test de continuidad en 5 configuraciones.
- [ ] **R-084** Extremos con la tangente del anclaje — *Cubre:* RF-8. **Hecho cuando:** Test: la curva sale perpendicular al lado del anclaje.
- [ ] **R-085** Regularización de puntos casi alineados o muy cercanos, sin picos ni bucles — *Cubre:* RF-8, CL-5. **Hecho cuando:** Test con casos patológicos: sin autointersección ni curvatura excesiva.
- [ ] **R-086** Las puntas se orientan según la tangente final de la curva — *Cubre:* RF-8. **Hecho cuando:** Test: ángulo de la punta = ángulo de la tangente.
- [ ] **R-087** Los conectores curvos anteriores (con `curvature`) no cambian de aspecto — *Cubre:* RF-8, RF-16. **Hecho cuando:** Test de regresión con el fixture de la spec 003.
- [ ] **R-088** El trazado libre con segmentos rectos se conserva como trazado aparte — *Cubre:* RF-8. **Hecho cuando:** Test: `smooth` apagado sigue dando polilínea.
- [ ] **R-089** `pathToSvg` emite la misma curva que el lienzo — *Cubre:* RF-8. **Hecho cuando:** Test: la exportación SVG de un conector curvo coincide con la del lienzo.

### Interfaz de conectores

*Requiere: Curva continua.*

- [ ] **R-090** Doble clic sobre un punto de quiebre lo elimina — *Cubre:* RF-6. **Hecho cuando:** Test de interfaz en los tres trazados.
- [ ] **R-091** Doble clic sobre un tramo agrega un punto en ese lugar — *Cubre:* RF-7. **Hecho cuando:** Test de interfaz; el punto queda sobre el tramo.
- [ ] **R-092** El doble clic sobre un punto gana al doble clic del lienzo — *Cubre:* RF-6. **Hecho cuando:** Test: no se abre ni se hace zoom al hacer doble clic en un punto.
- [ ] **R-093** Menú emergente del punto seleccionado con «Eliminar punto» — *Cubre:* RF-6, RF-2. **Hecho cuando:** Test: seleccionar un punto muestra el menú y la acción lo elimina.
- [ ] **R-094** Arrastrar un punto con vista previa y un solo paso de historial al soltar — *Cubre:* RF-7, RF-15. **Hecho cuando:** Test: un arrastre = un paso; deshacer lo revierte.
- [ ] **R-095** Los puntos se acomodan a la cuadrícula al arrastrarlos y al crearlos — *Cubre:* RF-18. **Hecho cuando:** Test con acomodo activo e inactivo y con Alt.
- [ ] **R-096** Área sensible de puntos de 32 px (44 px con puntero grueso) — *Cubre:* RF-17. **Hecho cuando:** Test de tamaños en ambos modos.
- [ ] **R-097** Sin límite de puntos más que el de rendimiento — *Cubre:* RF-7, RNF-1. **Hecho cuando:** Test: 50 puntos en un conector siguen fluidos.
- [ ] **R-098** En el trazado de 90° los quiebres automáticos no son eliminables; se explica y se ofrece «Restablecer ruta» — *Cubre:* RF-6. **Hecho cuando:** Test: el menú ofrece la acción correcta según el tipo de punto.
- [ ] **R-099** Textos nuevos de conectores en español de México y en inglés — *Cubre:* RNF-6. **Hecho cuando:** La prueba de paridad de idiomas pasa.

### Cierre del Hito 2

*Requiere: Interfaz de conectores.*

- [ ] **R-100** e2e: agregar y quitar puntos con doble clic y curva continua en el diagrama — *Cubre:* RF-6, RF-7, RF-8. **Hecho cuando:** e2e pasa en navegador real.
- [ ] **R-101** La exportación SVG de conectores con puntos y curva es idéntica a la del lienzo — *Cubre:* RF-8. **Hecho cuando:** Test de golden pasa.
- [ ] **R-102** Medir fluidez con 300 conectores con puntos — *Cubre:* RNF-1. **Hecho cuando:** Peor fotograma ≤ 100 ms o igual al de R-068.
- [ ] **R-103** Cerrar el Hito 2: `bun run typecheck` y `bun run test` pasan — *Cubre:* RNF-8. **Hecho cuando:** Ambos comandos pasan y el estado se anota arriba.

---

## HITO 3 — Mapa mental

### Modelo del árbol

*Requiere: Todos los grupos del Hito 2.*

- [ ] **R-104** Tipos del árbol: `off` y `style` por globo y `view` del árbol — *Cubre:* RF-9, RF-11, RF-12. **Hecho cuando:** Test de tipos: los campos nuevos son opcionales.
- [ ] **R-105** `parseTree` conserva `view`, `off` y `style` válidos — *Cubre:* RF-16. **Hecho cuando:** Test de ida y vuelta.
- [ ] **R-106** `parseTree` descarta `off` no numérico y colores inválidos sin lanzar — *Cubre:* RF-16, RNF-7. **Hecho cuando:** Test: el globo se lee con valores por defecto.
- [ ] **R-107** `parseTree` acota `view.height` al rango permitido — *Cubre:* RF-12, RF-16. **Hecho cuando:** Test de valores fuera de rango.
- [ ] **R-108** `serializeTree` no emite campos vacíos — *Cubre:* RF-16, RNF-7. **Hecho cuando:** Test: un árbol sin editar produce exactamente los mismos bytes que la golden anterior.
- [ ] **R-109** Un lector anterior lee un árbol nuevo sin error — *Cubre:* RNF-7. **Hecho cuando:** Test con el lector anterior fijado en un fixture.
- [ ] **R-110** Fixtures de mapas anteriores y nuevos — *Cubre:* RF-16, CL-12. **Hecho cuando:** Existen un mapa sin campos nuevos y uno con todos, usados en las pruebas.

### Núcleo del mapa

*Requiere: Modelo del árbol.*

- [ ] **R-111** `resolveTreeLayout`: posición efectiva = automática + `off` del globo y de sus ancestros — *Cubre:* RF-11. **Hecho cuando:** Test con 3 niveles y desplazamientos mezclados.
- [ ] **R-112** `resolveTreeLayout` sin ningún `off` da la distribución automática de siempre — *Cubre:* RF-16, CL-12. **Hecho cuando:** Test: idéntica a `layoutTree`.
- [ ] **R-113** Mover la raíz desplaza todo el mapa sin cambiar los demás `off` — *Cubre:* RF-11, CL-7. **Hecho cuando:** Test de posiciones relativas intactas.
- [ ] **R-114** Colapsar y expandir un globo movido conserva la posición de sus hijos — *Cubre:* RF-11, CL-8. **Hecho cuando:** Test: los hijos reaparecen en su lugar.
- [ ] **R-115** `moveBranch`: mover un globo cambia solo su `off` y calcula el acomodo a cuadrícula — *Cubre:* RF-11, RF-18. **Hecho cuando:** Test: la posición efectiva del globo es múltiplo de la cuadrícula.
- [ ] **R-116** Al acomodar un globo, sus descendientes conservan su distancia relativa — *Cubre:* RF-18, CL-17. **Hecho cuando:** Test: distancias relativas iguales antes y después.
- [ ] **R-117** `reflowAuto` borra todos los `off` del árbol — *Cubre:* RF-11. **Hecho cuando:** Test: el resultado equivale a la distribución automática.
- [ ] **R-118** `placeNewNode` evita colisión con otros globos visibles — *Cubre:* RF-11. **Hecho cuando:** Test: el globo nuevo no se superpone.
- [ ] **R-119** `placeNewNode` deja el globo en un punto de la cuadrícula si hizo falta moverlo — *Cubre:* RF-18. **Hecho cuando:** Test: posición efectiva múltiplo de la cuadrícula.
- [ ] **R-120** `setNodeStyle` cambia relleno, borde, texto o línea de un globo — *Cubre:* RF-9. **Hecho cuando:** Test de cada campo y de colores inválidos rechazados.
- [ ] **R-121** `applyStyleToBranch` copia el estilo a todos los descendientes actuales — *Cubre:* RF-10. **Hecho cuando:** Test: descendientes cambian; ancestros y hermanos no.
- [ ] **R-122** Un hijo creado después de aplicar a la rama nace sin estilo propio — *Cubre:* RF-10. **Hecho cuando:** Test: apariencia por defecto.
- [ ] **R-123** Reglas de borrar un globo con hijos: conteo de globos eliminados — *Cubre:* RF-14. **Hecho cuando:** Test: el conteo incluye todos los descendientes.
- [ ] **R-124** Texto vacío al salir del globo: el globo se conserva — *Cubre:* RF-14. **Hecho cuando:** Test: el modelo no elimina globos de texto vacío.
- [ ] **R-125** Exportar el núcleo del mapa desde el índice del paquete — *Cubre:* RF-11. **Hecho cuando:** Test de importación público pasa.

### Lienzo del mapa

*Requiere: Núcleo del mapa.*

- [ ] **R-126** `MindMapEditor` dentro de `CanvasFrame` con globos como nodos — *Cubre:* RF-12, RF-13, RNF-8. **Hecho cuando:** Test: un mapa se muestra con el ancho de la columna y el alto guardado.
- [ ] **R-127** Líneas al padre en una capa SVG propia, con el color `line` del hijo — *Cubre:* RF-9. **Hecho cuando:** Test: la línea toma el color y sigue al globo.
- [ ] **R-128** Globos colapsados ocultan sus descendientes y muestran el indicador — *Cubre:* RF-14. **Hecho cuando:** Test de colapsar y expandir.
- [ ] **R-129** Texto largo: el globo crece hasta un ancho máximo y luego se ajusta en líneas — *Cubre:* CL-13. **Hecho cuando:** Test: no se superponen globos con texto largo.
- [ ] **R-130** Historial del mapa con la utilidad genérica y deshacer/rehacer en barra y atajos — *Cubre:* RF-15. **Hecho cuando:** Test: cada acción nueva se deshace y se rehace.
- [ ] **R-131** `onlyRenderVisibleElements` y medición de globos visibles — *Cubre:* RNF-1. **Hecho cuando:** Test: solo se montan los globos visibles.
- [ ] **R-132** El bloque `mindmap` usa `MindMapEditor` y `orgchart` sigue con `TreeEditor` — *Cubre:* RF-16. **Hecho cuando:** Test: un organigrama se ve y se comporta igual que antes.
- [ ] **R-133** El alto del mapa por defecto muestra el mapa inicial completo y se guarda en `view` — *Cubre:* RF-12. **Hecho cuando:** Test: mapa nuevo con alto entre 320 y 560 px.

### Clic único, menú y color

*Requiere: Lienzo del mapa.*

- [ ] **R-134** Un clic sin movimiento selecciona, abre el menú y pone el texto en edición — *Cubre:* RF-14. **Hecho cuando:** Test: un solo clic produce los tres efectos.
- [ ] **R-135** Un arrastre de más de 5 px mueve el globo y no abre el campo de texto — *Cubre:* RF-14, RF-11. **Hecho cuando:** Test de ratón y de puntero táctil.
- [ ] **R-136** El texto se confirma al salir del campo (desenfoque, Enter o clic fuera) como un paso de historial — *Cubre:* RF-14, RF-15. **Hecho cuando:** Test: una edición = un paso.
- [ ] **R-137** Esc cierra el menú sin perder el texto escrito — *Cubre:* RF-14. **Hecho cuando:** Test de Esc con texto a medias.
- [ ] **R-138** Menú del globo: agregar hijo, agregar hermano (no en la raíz), colapsar o expandir (solo con hijos), eliminar (no en la raíz) — *Cubre:* RF-14, RF-2. **Hecho cuando:** Test de cada acción y de las acciones ocultas o deshabilitadas.
- [ ] **R-139** Eliminar con hijos avisa cuántos globos se eliminan, con «Deshacer» — *Cubre:* RF-14. **Hecho cuando:** Test: aviso con el conteo y deshacer restituye la rama.
- [ ] **R-140** Texto de relleno atenuado cuando el globo queda vacío — *Cubre:* RF-14. **Hecho cuando:** Test: el globo vacío muestra el texto de relleno y no se elimina.
- [ ] **R-141** Retirar el campo «Texto hijo» y la franja inferior del mapa — *Cubre:* RF-14, RF-1. **Hecho cuando:** Test: no existen en el mapa.
- [ ] **R-142** Menú de color con relleno, borde, texto y línea reutilizando el selector de color, la paleta y los recientes — *Cubre:* RF-9. **Hecho cuando:** Test: cada color se aplica al elemento correcto.
- [ ] **R-143** Aviso de contraste entre relleno y texto sin impedir la elección — *Cubre:* RF-9, RNF-3. **Hecho cuando:** Test: aviso visible con contraste insuficiente y el color se aplica.
- [ ] **R-144** «Aplicar a la rama» en el menú con un solo paso de historial — *Cubre:* RF-10, RF-15. **Hecho cuando:** Test: aplicar y deshacer en un paso.
- [ ] **R-145** Un globo nuevo se crea sin estilo y colocado sin superposición — *Cubre:* RF-10, RF-11. **Hecho cuando:** Test de interfaz con hijo y hermano nuevos.

### Mover, vista y cuadrícula del mapa

*Requiere: Clic único, menú y color.*

- [ ] **R-146** Arrastrar un globo mueve su rama con las líneas ajustadas en tiempo real — *Cubre:* RF-11. **Hecho cuando:** Test: durante el gesto, el globo y sus descendientes se mueven el mismo delta.
- [ ] **R-147** Al soltar se guarda el `off` y se registra un solo paso de historial — *Cubre:* RF-11, RF-15. **Hecho cuando:** Test: un arrastre largo = un paso.
- [ ] **R-148** Las posiciones persisten al cerrar y reabrir la página — *Cubre:* RF-11. **Hecho cuando:** e2e: mover, recargar y ver el globo en su lugar.
- [ ] **R-149** «Reordenar automáticamente» en un paso de historial — *Cubre:* RF-11, RF-15. **Hecho cuando:** Test: reordena y se deshace de una vez.
- [ ] **R-150** Superponer globos está permitido y «Reordenar» los separa — *Cubre:* CL-6. **Hecho cuando:** Test: dos globos superpuestos se separan al reordenar.
- [ ] **R-151** Cuadrícula visible en el mapa, con el mismo paso que el diagrama — *Cubre:* RF-18. **Hecho cuando:** Test: el paso es el de la constante del núcleo.
- [ ] **R-152** Acomodo a cuadrícula del globo arrastrado con Alt para movimiento libre y el interruptor compartido — *Cubre:* RF-18. **Hecho cuando:** Test: con acomodo la posición es múltiplo; con Alt o interruptor apagado, libre.
- [ ] **R-153** Arrastrar el fondo desplaza la vista — *Cubre:* RF-13. **Hecho cuando:** Test de desplazamiento con ratón y con un dedo.
- [ ] **R-154** Ctrl + rueda y pellizco hacen zoom centrado en el puntero — *Cubre:* RF-13. **Hecho cuando:** Test: el punto bajo el puntero no se mueve al hacer zoom.
- [ ] **R-155** Botones de acercar, alejar, restablecer al 100 % y ajustar a la vista — *Cubre:* RF-13. **Hecho cuando:** Test de cada botón y del porcentaje.
- [ ] **R-156** Zoom y posición se recuerdan solo con la página abierta; al reabrirla se encuadra el mapa completo — *Cubre:* RF-13. **Hecho cuando:** Test: reabrir encuadra todo.
- [ ] **R-157** Si el mapa no cabe ni al zoom mínimo, «Ajustar a la vista» avisa — *Cubre:* CL-10. **Hecho cuando:** Test con un mapa enorme.
- [ ] **R-158** Alto ajustable del mapa con asa, teclado y un paso de historial — *Cubre:* RF-12, RF-15. **Hecho cuando:** Test igual que el del diagrama (R-041, R-042).
- [ ] **R-159** Vista ampliada del mapa con los mismos controles y Esc por capas — *Cubre:* RF-3, RNF-8. **Hecho cuando:** Test: ampliar y salir conserva selección y texto.

### Teclado, táctil y textos del mapa

*Requiere: Mover, vista y cuadrícula del mapa.*

- [ ] **R-160** Tab recorre los globos y Enter abre menú y edición — *Cubre:* RF-17. **Hecho cuando:** Test de recorrido solo con teclado.
- [ ] **R-161** Flechas mueven el globo seleccionado una celda (Mayús = 5) y 1 px / 10 px con acomodo apagado — *Cubre:* RF-17, RF-18. **Hecho cuando:** Test de los cuatro casos.
- [ ] **R-162** Supr/Retroceso eliminan, Ctrl+C/V usan el portapapeles interno, +/−/0 hacen zoom, F ajusta y Ctrl+Mayús+F amplía — *Cubre:* RF-17. **Hecho cuando:** Test de cada atajo con foco dentro del lienzo y sin choque con los del editor.
- [ ] **R-163** Cambios de selección y avisos en una región de estado — *Cubre:* RF-17, RNF-3. **Hecho cuando:** Test: el lector recibe el aviso de eliminación y de selección.
- [ ] **R-164** Objetivos táctiles de 44 px y menú que no queda bajo el dedo — *Cubre:* RF-17. **Hecho cuando:** Test con puntero grueso simulado.
- [ ] **R-165** El foco sale del bloque con Tab sin quedar atrapado (fuera de la vista ampliada) — *Cubre:* CL-14. **Hecho cuando:** Test: Tab desde el último elemento sale del bloque.
- [ ] **R-166** Textos del mapa en español de México y en inglés — *Cubre:* RNF-6. **Hecho cuando:** La prueba de paridad de idiomas pasa.

### Cierre del Hito 3

*Requiere: Teclado, táctil y textos del mapa.*

- [ ] **R-167** e2e del mapa: clic escribe y abre menú, mover con rama y reabrir, color de rama, zoom/100 %/ajustar, alto persistido — *Cubre:* RF-9, RF-10, RF-11, RF-12, RF-13, RF-14. **Hecho cuando:** e2e pasa en navegador real.
- [ ] **R-168** e2e: mapa y diagrama con el mismo ancho que otros bloques en tres anchos de ventana — *Cubre:* RF-12, CL-11. **Hecho cuando:** e2e pasa.
- [ ] **R-169** Medir fluidez con 200 globos al arrastrar una rama — *Cubre:* RNF-1. **Hecho cuando:** Peor fotograma ≤ 100 ms o plan B de R-003 aplicado.
- [ ] **R-170** Cerrar el Hito 3: `bun run typecheck` y `bun run test` pasan — *Cubre:* RNF-8. **Hecho cuando:** Ambos comandos pasan y el estado se anota arriba.

---

## HITO 4 — Cierre

### Respaldo, exportación y búsqueda

*Requiere: Todos los grupos del Hito 3.*

- [ ] **R-171** El respaldo conserva `off`, `style` y `view` del mapa y `view` del diagrama — *Cubre:* RF-16. **Hecho cuando:** Test: respaldar y restaurar devuelve los mismos datos.
- [ ] **R-172** Un respaldo anterior sin campos nuevos se restaura sin cambios — *Cubre:* RF-16, RNF-7. **Hecho cuando:** Test con la golden anterior.
- [ ] **R-173** Un respaldo nuevo es determinista y sin commit si no hubo cambios — *Cubre:* RF-16. **Hecho cuando:** Test: dos respaldos seguidos son idénticos.
- [ ] **R-174** La exportación a SVG del mapa aplica `off` y colores con `resolveTreeLayout` y la paleta compartida — *Cubre:* RF-16, RF-9. **Hecho cuando:** Test de golden: el SVG coincide con lo que se ve.
- [ ] **R-175** Las exportaciones a HTML y PDF usan la misma función — *Cubre:* RF-16. **Hecho cuando:** Test: mismo resultado que el SVG.
- [ ] **R-176** El texto del mapa para búsqueda y Markdown no cambia — *Cubre:* RF-16. **Hecho cuando:** Test: `treeText` igual con y sin campos nuevos.
- [ ] **R-177** El organigrama se exporta y respalda como antes — *Cubre:* RF-16. **Hecho cuando:** Test de regresión con la golden del organigrama.

### Calidad y casos límite

*Requiere: Respaldo, exportación y búsqueda.*

- [ ] **R-178** Prueba dedicada a cada caso límite CL-1 a CL-17 (una por caso, con su identificador en el nombre) — *Cubre:* CL-1, CL-2, CL-3, CL-4, CL-5, CL-6, CL-7, CL-8, CL-9, CL-10, CL-11, CL-12, CL-13, CL-14, CL-15, CL-16, CL-17. **Hecho cuando:** Existe y pasa una prueba por cada caso.
- [ ] **R-179** Auditoría de accesibilidad de diagrama, mapa, menús y vista ampliada en claro y oscuro — *Cubre:* RNF-3. **Hecho cuando:** Sin errores.
- [ ] **R-180** Comprobar la ausencia de peticiones de red a destinos externos en todo el flujo — *Cubre:* RNF-5. **Hecho cuando:** e2e: cero peticiones externas.
- [ ] **R-181** Comprobar que no se añadieron dependencias — *Cubre:* RNF-2. **Hecho cuando:** El diff de `package.json` no muestra dependencias nuevas.
- [ ] **R-182** Presupuesto de fluidez final con 200 elementos en diagrama y en mapa — *Cubre:* RNF-1. **Hecho cuando:** Peor fotograma ≤ 100 ms en ambos, o excepción documentada.
- [ ] **R-183** Pruebas compartidas del marco (diagrama y mapa) para la coherencia — *Cubre:* RNF-8. **Hecho cuando:** Una sola suite de pruebas del marco se ejecuta con los dos bloques.
- [ ] **R-184** Matrices de aceptación de CL y RNF de esta spec — *Cubre:* RNF-7, RNF-8. **Hecho cuando:** `docs/acceptance-pulido.md` enlaza cada requisito con su prueba.

### Documentación

*Requiere: Calidad y casos límite.*

- [ ] **R-185** Actualizar el manual (`docs/manual`) con menús, ampliar, cuadrícula, puntos de quiebre, curva y mapa mental nuevo — *Cubre:* RF-1, RF-3, RF-6, RF-9, RF-11, RF-18. **Hecho cuando:** Secciones nuevas con capturas actualizadas.
- [ ] **R-186** Actualizar `docs/backup-format.md` con la versión final de los campos — *Cubre:* RF-16. **Hecho cuando:** Documento coherente con el código.
- [ ] **R-187** Anotar en la spec y el plan los valores finales (alto, cuadrícula, distancias) — *Cubre:* RNF-8. **Hecho cuando:** Spec y plan sin diferencias con el código.

### Verificación final

*Requiere: Documentación.*

- [ ] **R-188** Verificación manual: táctil en dispositivo real (menú que no queda bajo el dedo, objetivos de 44 px, pellizco, arrastre del fondo) (lista firmada) — *Cubre:* RF-17, RF-13. **Hecho cuando:** Checklist con evidencia.
- [ ] **R-189** Verificación manual: recorrido completo por teclado y con lector de pantalla de menús, vista ampliada y mapa (lista firmada) — *Cubre:* RF-2, RF-17, RNF-3. **Hecho cuando:** Checklist con evidencia.
- [ ] **R-190** Demostrar los criterios de finalización 1 a 13 de la spec con evidencia (tarea manual) — *Cubre:* RF-1, RF-2, RF-3, RF-4, RF-5, RF-6, RF-7, RF-8, RF-9, RF-10, RF-11, RF-12, RF-13, RF-14, RF-15, RF-16, RF-17, RF-18. **Hecho cuando:** Checklist completo firmado.
- [ ] **R-191** Cerrar la spec: `bun run typecheck` y `bun run test` pasan y el estado de esta lista y de la spec se actualiza — *Cubre:* RNF-8. **Hecho cuando:** Ambos comandos pasan y los encabezados reflejan el cierre.

---

## Matriz de cobertura (generada de las etiquetas de cada tarea)

| Requisito | Tareas | Total |
|---|---|---|
| **RF-1** | R-004, R-032, R-033, R-035 … R-190 | 15 |
| **RF-2** | R-037, R-038, R-056, R-057 … R-190 | 8 |
| **RF-3** | R-001, R-046, R-047, R-048 … R-190 | 11 |
| **RF-4** | R-021, R-022, R-023, R-024 … R-190 | 7 |
| **RF-5** | R-002, R-025, R-026, R-027 … R-190 | 9 |
| **RF-6** | R-078, R-079, R-080, R-090 … R-190 | 10 |
| **RF-7** | R-072, R-073, R-074, R-075 … R-190 | 12 |
| **RF-8** | R-074, R-081, R-082, R-083 … R-190 | 13 |
| **RF-9** | R-104, R-120, R-127, R-142 … R-190 | 9 |
| **RF-10** | R-121, R-122, R-144, R-145 … R-190 | 6 |
| **RF-11** | R-003, R-104, R-111, R-113 … R-190 | 18 |
| **RF-12** | R-016, R-017, R-040, R-041 … R-190 | 16 |
| **RF-13** | R-043, R-126, R-153, R-154 … R-190 | 9 |
| **RF-14** | R-005, R-036, R-123, R-124 … R-190 | 15 |
| **RF-15** | R-018, R-019, R-042, R-094 … R-190 | 11 |
| **RF-16** | R-007, R-010, R-017, R-054 … R-190 | 21 |
| **RF-17** | R-041, R-096, R-160, R-161 … R-190 | 10 |
| **RF-18** | R-008, R-012, R-013, R-014 … R-190 | 25 |
| **RNF-1** | R-003, R-006, R-068, R-097 … R-182 | 8 |
| **RNF-2** | R-181 | 1 |
| **RNF-3** | R-026, R-029, R-038, R-047 … R-189 | 9 |
| **RNF-4** | R-034, R-059 | 2 |
| **RNF-5** | R-180 | 1 |
| **RNF-6** | R-039, R-099, R-166 | 3 |
| **RNF-7** | R-007, R-009, R-106, R-108 … R-184 | 7 |
| **RNF-8** | R-011, R-053, R-071, R-103 … R-191 | 11 |
| **CL-1** | R-032, R-178 | 2 |
| **CL-2** | R-035, R-178 | 2 |
| **CL-3** | R-079, R-178 | 2 |
| **CL-4** | R-077, R-178 | 2 |
| **CL-5** | R-085, R-178 | 2 |
| **CL-6** | R-150, R-178 | 2 |
| **CL-7** | R-113, R-178 | 2 |
| **CL-8** | R-114, R-178 | 2 |
| **CL-9** | R-001, R-050, R-178 | 3 |
| **CL-10** | R-157, R-178 | 2 |
| **CL-11** | R-052, R-168, R-178 | 3 |
| **CL-12** | R-110, R-112, R-178 | 3 |
| **CL-13** | R-129, R-178 | 2 |
| **CL-14** | R-165, R-178 | 2 |
| **CL-15** | R-064, R-178 | 2 |
| **CL-16** | R-014, R-061, R-178 | 3 |
| **CL-17** | R-015, R-116, R-178 | 3 |
