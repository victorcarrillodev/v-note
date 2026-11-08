# Tareas 003 — Diagramas de flujo: conexión precisa, trazados y color

> Deriva de `spec.md` y `plan.md` de esta carpeta. Cada tarea es pequeña (**máx. 20–30 min**), está en **orden de dependencia** y cubre uno o más RF/RNF/CL.
> **Regla de ejecución (TDD):** en cada tarea se escribe **primero la prueba** (debe fallar), luego la implementación, y se marca el checkbox solo cuando se cumple **«Hecho cuando»** y `bun run typecheck` y `bun run test` pasan (constitución, art. 4).
> Las verificaciones previas del Hito 0 viven en `spikes/`, son desechables y sus resultados se anotan en `spikes/RESULTS-diagramas.md`. Si una verificación falla, **se detiene el trabajo y se actualiza el plan** antes de seguir (AGENTS).
> **Hitos cerrados en orden** (art. 2): no se empieza un hito hasta cerrar el anterior. Dentro de un grupo, el orden de las tareas es el de ejecución; **Requiere** indica de qué grupo depende.
> **Tareas manuales:** las marcadas «(tarea manual)» o «(lista firmada)» necesitan a la persona responsable; no se pueden cerrar solo con pruebas.
> **Supuesto por confirmar:** el trazado predeterminado de un conector nuevo es el de 90° (plan, sección 16); si en la revisión se prefiere otro, se cambia solo la tarea correspondiente del Hito 2.
> **Total:** 179 tareas · Hito 0: 41 · Hito 1: 43 · Hito 2: 39 · Hito 3: 56
> **Estado:** Hitos 0 a 3 implementados (8 de noviembre de 2026) · 3 tareas pendientes de 179: las tres verificaciones manuales firmadas (G-172, G-173, G-178), que necesitan a la persona responsable (`docs/acceptance-diagramas.md`).

---

## HITO 0 — Verificaciones y modelo

### Verificaciones previas (código desechable en `spikes/`)

*Requiere: nada. Resultados en `spikes/RESULTS-diagramas.md`.*

- [x] **G-001** Probar una capa SVG propia dentro del lienzo de `@xyflow/react` 12.12: sigue desplazamiento y zoom y sus eventos de puntero no chocan con la selección de formas — *Cubre:* RF-2, RF-4 (DP-3). **Hecho cuando:** Spike muestra funciona o falla; si falla, alternativa «capa hermana» probada y decisión escrita.
- [x] **G-002** Medir cómo se dibuja hoy un conector en pantalla (con `Handle` de lado) y en la exportación SVG (centro a centro recortada) — *Cubre:* RF-19, CL-11. **Hecho cuando:** Capturas y regla de migración elegida anotadas en `RESULTS-diagramas.md`.
- [x] **G-003** Listar los tokens de color de bloque existentes y comprobar que hay variante de contorno/texto para los nueve — *Cubre:* RF-13. **Hecho cuando:** Lista anotada con los tokens que faltan, si los hay.
- [x] **G-004** Medir el rendimiento de un enrutador A* sobre rejilla comprimida: 300 conectores, mover una forma con 10 conectores — *Cubre:* RNF-1. **Hecho cuando:** Tiempo medido < 100 ms o plan B anotado.
- [x] **G-005** Ver el contenido exacto del respaldo `data/<id>.json` y del Markdown de un diagrama — *Cubre:* RF-19, RNF-2. **Hecho cuando:** Formato actual anotado sin sorpresas para la restauración.
- [x] **G-006** Confirmar que cada espacio de trabajo tiene su propia base y su tabla `meta` — *Cubre:* RF-14. **Hecho cuando:** Test de spike: dos espacios guardan valores distintos en `meta`.
- [x] **G-007** Actualizar `docs/backup-format.md` con el archivo opcional `diagram-defaults.json` y la versión 2 del diagrama (sin cambiar `formatVersion`) — *Cubre:* RF-14, RF-19. **Hecho cuando:** Documento revisado; coincide con la sección 11 del plan.

### Geometría y anclajes (base de la migración)

*Requiere: Verificaciones previas.*

- [x] **G-008** Tipos base: punto, caja, anclaje (`n, ne, e, se, s, sw, w, nw`), extremo (unido o libre) — *Cubre:* RF-1, RF-4. **Hecho cuando:** Test de tipos: las constantes de anclaje son exactamente las ocho.
- [x] **G-009** `geometry.ts`: distancia, longitud de arco y punto/tangente sobre un segmento — *Cubre:* RF-6. **Hecho cuando:** Test con 6 casos conocidos pasa.
- [x] **G-010** `geometry.ts`: intersección de un segmento con una caja y con un contorno poligonal — *Cubre:* RF-19. **Hecho cuando:** Test: el punto de salida coincide con el esperado en 5 casos.
- [x] **G-011** `anchors.ts`: posición de los ocho anclajes en proceso y nota (centros de lado y esquinas) — *Cubre:* RF-1. **Hecho cuando:** Test de valores exactos para dos tamaños.
- [x] **G-012** `anchors.ts`: inicio/fin (esquinas proyectadas al arco de radio `h/2`) — *Cubre:* RF-1. **Hecho cuando:** Test de valores exactos; las cuatro esquinas están sobre el contorno.
- [x] **G-013** `anchors.ts`: decisión (vértices y puntos medios de los lados diagonales) — *Cubre:* RF-1. **Hecho cuando:** Test: `ne = (cx + w/4, cy − h/4)` y simétricos.
- [x] **G-014** `anchors.ts`: entrada/salida (paralelogramo de 15°) — *Cubre:* RF-1. **Hecho cuando:** Test de valores exactos de los ocho puntos.
- [x] **G-015** `anchors.ts`: dirección de salida de cada anclaje y regla del eje dominante en esquinas — *Cubre:* RF-1, RF-7. **Hecho cuando:** Test: cuatro lados fijos y esquinas según posición del otro extremo.
- [x] **G-016** `anchors.ts`: anclajes con la forma al tamaño mínimo y con proporciones extremas — *Cubre:* CL-3. **Hecho cuando:** Test: los ocho puntos siguen distintos y sobre el contorno.
- [x] **G-017** `nearestAnchor` con radio, desempate por orden de dibujo y fuera de radio — *Cubre:* RF-2, RF-4. **Hecho cuando:** Test: gana el más cercano; fuera de radio devuelve nada.

### Modelo v2 y validación

*Requiere: Geometría y anclajes.*

- [x] **G-018** `style.ts`: validar colores (`palette:<id>`, hex de 3/4/6/8 dígitos y `none`) — *Cubre:* RF-13. **Hecho cuando:** Test: acepta válidos y rechaza 8 inválidos.
- [x] **G-019** `style.ts`: conjuntos permitidos de grosor, línea, puntas y trazado; estilos del sistema por defecto — *Cubre:* RF-11, RF-12. **Hecho cuando:** Test: valores fuera del conjunto se rechazan; defaults completos.
- [x] **G-020** `diagram.ts`: tipos v2 (formas con `style`, conectores con extremos, trazado y estilo) y `emptyDiagram` con `version: 2` — *Cubre:* RF-19. **Hecho cuando:** Test de forma del diagrama vacío.
- [x] **G-021** `parseDiagram`: lee v2 válido (ejemplo del plan 4.2) — *Cubre:* RF-19. **Hecho cuando:** Test: el ejemplo se lee sin cambios.
- [x] **G-022** `parseDiagram`: errores legibles (ids repetidos, extremo a forma inexistente, números no finitos, valor desconocido) — *Cubre:* RF-19, RNF-7. **Hecho cuando:** Test de 6 casos devuelve error sin lanzar.
- [x] **G-023** `parseDiagram`: versión mayor devuelve `UNSUPPORTED_VERSION` — *Cubre:* RNF-7. **Hecho cuando:** Test pasa con `version: 3`.
- [x] **G-024** Operaciones existentes adaptadas a v2: `addNode` con `style`, `setNodeColor` pasa a fijar el relleno — *Cubre:* RF-11, RF-19. **Hecho cuando:** Tests existentes de `diagram.test.ts` adaptados pasan.
- [x] **G-025** Regla `SAME_ANCHOR`: mismo anclaje de la misma forma en ambos extremos se rechaza; con un extremo libre se permite — *Cubre:* RF-5. **Hecho cuando:** Test de los 3 casos.
- [x] **G-026** Serialización estable de v2 y round-trip leer→escribir→leer — *Cubre:* RNF-2. **Hecho cuando:** Test: bytes idénticos en dos serializaciones.

### Migración v1 → v2

*Requiere: Modelo v2 y validación.*

- [x] **G-027** Archivos de referencia: al menos 5 diagramas v1 reales (vacío, simple, con decisión, con conectores cruzados, con color no estándar) — *Cubre:* RF-19, CL-11. **Hecho cuando:** Archivos en el repositorio con su v2 esperada.
- [x] **G-028** `migrate.ts`: color de forma pasa a `style.fill` y el contorno/texto toman los valores que ya se dibujaban — *Cubre:* RF-19. **Hecho cuando:** Test con las 5 referencias: estilos esperados.
- [x] **G-029** `migrate.ts`: un hex v1 que coincide con la paleta pasa a `palette:<id>` — *Cubre:* RF-19, RF-13. **Hecho cuando:** Test: los 8 tonos de la paleta se convierten; uno ajeno queda en hex.
- [x] **G-030** `migrate.ts`: cada conector queda unido a los anclajes este → oeste con trazado redondeado, que es como se dibujaba (hallazgo de G-002) — *Cubre:* RF-19, CL-11. **Hecho cuando:** Test: anclajes y trazado esperados en las 5 referencias.
- [x] **G-031** `migrate.ts`: pureza e idempotencia (migrar dos veces = una) — *Cubre:* RNF-7. **Hecho cuando:** Test pasa; la entrada no se muta.
- [x] **G-032** `parseDiagram` acepta v1 y devuelve v2 migrado sin tocar el texto guardado — *Cubre:* RF-19, RNF-7. **Hecho cuando:** Test: leer v1 no cambia el archivo; guardar escribe v2.
- [x] **G-033** Sin pérdida: texto, posiciones, tamaños, ids y conexiones se conservan en las referencias — *Cubre:* RNF-7. **Hecho cuando:** Test compara contra las referencias.

### Paleta, lectura en interfaz, exportación y respaldo (sin cambio visual)

*Requiere: Migración v1 → v2.*

- [x] **G-034** Ampliar `diagramPalette` con ids por uso (relleno, contorno/línea/texto) y valor claro/oscuro; resolver `palette:<id>` al tema — *Cubre:* RF-13. **Hecho cuando:** Test: cada id tiene ambos valores; v1 se dibuja igual que antes.
- [x] **G-035** Añadir al catálogo de tokens los colores de contorno/texto que falten (con par oscuro) — *Cubre:* RF-13, RNF-5. **Hecho cuando:** Test de paridad de tokens y contraste ≥ 4,5:1 pasan.
- [x] **G-036** Los conectores usan posiciones de anclaje del núcleo (`edgeEndpoints`) en vez de centros — *Cubre:* RF-3. **Hecho cuando:** Test: extremos = posición del anclaje; sigue funcionando `centerOnEdgeEnd`.
- [x] **G-037** `DiagramEditor` lee y guarda v2 manteniendo su aspecto actual — *Cubre:* RF-19. **Hecho cuando:** e2e existente `diagram.e2e` sigue en verde sin cambios de captura.
- [x] **G-038** `diagramToSvg` lee v2 y dibuja el conector recto entre anclajes con el mismo aspecto — *Cubre:* RF-19. **Hecho cuando:** Test: SVG de las 5 referencias equivale al anterior.
- [x] **G-039** `backup/markdown.ts` y `diagramText` leen v2 — *Cubre:* RF-19. **Hecho cuando:** Test: el Markdown y la búsqueda de las referencias no cambian de contenido.
- [x] **G-040** Restaurar un respaldo anterior a la spec (archivo de referencia) y abrir su diagrama — *Cubre:* RF-19, CL-13. **Hecho cuando:** e2e: restaura y el diagrama se ve igual.
- [x] **G-041** Cierre del Hito 0: `bun run typecheck`, `bun run test`, privacidad y peso — *Cubre:* RNF-4, RNF-7, RNF-8. **Hecho cuando:** Todo en verde; `spikes/RESULTS-diagramas.md` completo.

## HITO 1 — Conexión y controles

### Núcleo de conexión

*Requiere: Todos los grupos del Hito 0.*

- [x] **G-042** `addEdge` con extremos (forma + anclaje) y validación `SAME_ANCHOR` — *Cubre:* RF-2, RF-5. **Hecho cuando:** Test: crea con anclajes elegidos; rechaza coincidencia.
- [x] **G-043** `reconnectEnd`: mover un extremo a otro anclaje de la misma o de otra forma — *Cubre:* RF-2. **Hecho cuando:** Test: el otro extremo no cambia.
- [x] **G-044** `detachEnd` y `moveFreeEnd`: dejar un extremo libre en un punto y moverlo — *Cubre:* RF-4. **Hecho cuando:** Test: extremo libre en la posición dada.
- [x] **G-045** Conectores con ambos extremos libres (crear, mover entero, borrar) — *Cubre:* RF-4, CL-5. **Hecho cuando:** Test de los 3 casos.
- [x] **G-046** Seguimiento: al mover y redimensionar una forma, el conector conserva su anclaje — *Cubre:* RF-3, CL-3. **Hecho cuando:** Test en las 5 formas: el anclaje no cambia de nombre.
- [x] **G-047** `deleteNode` libera los conectores en la última posición del anclaje y devuelve cuáles — *Cubre:* RF-4, CL-6. **Hecho cuando:** Test: ningún conector se pierde; extremos libres en la posición correcta.
- [x] **G-048** Varios conectores en el mismo anclaje permitidos — *Cubre:* RF-2, CL-2. **Hecho cuando:** Test: tres conectores en un anclaje.
- [x] **G-049** Conversión del radio del imán de píxeles a unidades del lienzo según zoom y tipo de puntero — *Cubre:* RF-2, CL-12. **Hecho cuando:** Test: 16 px a zoom 0,5 = 32 unidades; 24 px con puntero grueso.
- [x] **G-050** Historial: conectar, reubicar, liberar y borrar con liberación son un paso cada uno — *Cubre:* RF-17. **Hecho cuando:** Test de pasos y de deshacer/rehacer exactos.

### Capa de formas y anclajes

*Requiere: Núcleo de conexión.*

- [x] **G-051** Extraer `ShapeNode.tsx` y retirar los `Handle` de la librería — *Cubre:* RF-1. **Hecho cuando:** Test: la forma se dibuja igual; ya no hay `Handle`.
- [x] **G-052** `AnchorOverlay`: dibujar los ocho anclajes de la forma seleccionada — *Cubre:* RF-1. **Hecho cuando:** Test: 8 anclajes en las posiciones del núcleo.
- [x] **G-053** Mostrar anclajes también bajo el puntero y mientras se arrastra un extremo, y resaltar el más cercano — *Cubre:* RF-1. **Hecho cuando:** Test de interacción: aparecen y se resalta el más cercano.
- [x] **G-054** Símbolo de anclaje con anillo doble (tarjeta + acento) con tokens — *Cubre:* RF-15. **Hecho cuando:** Test de contraste ≥ 3:1 contra lienzo y contra 8 rellenos en ambos temas.
- [x] **G-055** Área activa de 32 px (44 px con puntero grueso) en anclajes y asas — *Cubre:* RF-15. **Hecho cuando:** Test de tamaño en ambos modos.
- [x] **G-056** Anclajes y asas de lo seleccionado mantienen su tamaño en pantalla con tope al hacer zoom — *Cubre:* RF-15, CL-10. **Hecho cuando:** Test a zoom 0,1 y 4.
- [x] **G-057** Selección visible con contorno doble sobre cualquier relleno — *Cubre:* RF-16. **Hecho cuando:** Test de contraste ≥ 3:1 contra los 8 rellenos y sin relleno.

### Capa de conectores y gestos

*Requiere: Capa de formas y anclajes.*

- [x] **G-058** `ConnectorLayer`: dibujar el camino del núcleo (recto y, adelantado del Hito 2, redondeado, para que los diagramas antiguos conserven su aspecto) y la punta de flecha actual — *Cubre:* RF-2. **Hecho cuando:** Test: mismo aspecto que antes en las referencias.
- [x] **G-059** Selección de conector (clic) y asas visibles de sus dos extremos — *Cubre:* RF-16. **Hecho cuando:** Test: asas con anillo doble y área ≥ 32 px.
- [x] **G-060** `useConnectorDrag`: crear un conector arrastrando desde un anclaje — *Cubre:* RF-2. **Hecho cuando:** e2e: queda unido exactamente a ese anclaje.
- [x] **G-061** Imán: soltar a distancia del radio une al anclaje resaltado — *Cubre:* RF-2. **Hecho cuando:** Test de interacción con soltar a 10 px y a 30 px.
- [x] **G-062** Soltar en vacío deja el extremo libre en esa posición — *Cubre:* RF-4. **Hecho cuando:** Test de interacción.
- [x] **G-063** Arrastrar un extremo ya unido hacia otro anclaje o al vacío — *Cubre:* RF-2, RF-4. **Hecho cuando:** Test de interacción: reubica y despega.
- [x] **G-064** Confirmar un solo paso de historial al soltar el gesto (vista previa durante el arrastre) — *Cubre:* RF-17. **Hecho cuando:** Test: arrastrar con 20 movimientos = 1 paso.
- [x] **G-065** Aviso «N conectores quedaron con extremo libre» con Deshacer al borrar una forma — *Cubre:* RF-4, CL-14. **Hecho cuando:** Test: aviso con el número; Deshacer restituye forma y uniones.

### Controles del lienzo

*Requiere: Capa de conectores y gestos.*

- [x] **G-066** `CanvasControls`: acercar, alejar, ajustar a la vista y nivel de zoom, con nombre accesible — *Cubre:* RF-15, RF-16. **Hecho cuando:** Test: 3 botones con nombre y el nivel en %.
- [x] **G-067** Sustituir los controles de la librería por los propios — *Cubre:* RF-15. **Hecho cuando:** Test: ya no se monta el control de la librería.
- [x] **G-068** Contraste de íconos ≥ 3:1 y de texto ≥ 4,5:1 sobre el lienzo en ambos temas — *Cubre:* RF-15. **Hecho cuando:** Test de contraste pasa en claro y oscuro.
- [x] **G-069** Estados normal, hover, foco (anillo doble), activo y deshabilitado — *Cubre:* RF-15. **Hecho cuando:** Test de estilos de los 5 estados.
- [x] **G-070** Objetivos de 32 px / 44 px en puntero grueso — *Cubre:* RF-15. **Hecho cuando:** Test de tamaño en ambos modos.
- [x] **G-071** Los controles quedan por encima de formas y conectores y nunca tapados — *Cubre:* RF-15. **Hecho cuando:** Test de orden de capas con un diagrama lleno.

### Teclado, accesibilidad y textos

*Requiere: Controles del lienzo.*

- [x] **G-072** `PropertiesPanel` de extremos: forma y anclaje de Origen y Destino, o «Libre» con X/Y — *Cubre:* RF-18, DP-10. **Hecho cuando:** Test: cambiar el anclaje desde el panel reubica el extremo.
- [x] **G-073** Recorrer formas y conectores con Tab/flechas y seleccionar con teclado — *Cubre:* RF-18. **Hecho cuando:** Test de interacción solo con teclado.
- [x] **G-074** Nombre accesible del conector con forma y anclaje de cada extremo y «extremo libre» — *Cubre:* RF-18. **Hecho cuando:** Test de nombres accesibles.
- [x] **G-075** Reducción de movimiento: sin animación de imán ni de cambios — *Cubre:* RF-18. **Hecho cuando:** Test con la preferencia activa.
- [x] **G-076** Texto táctil: imán al soltar el dedo y objetivos de 44 px — *Cubre:* RF-2, CL-12. **Hecho cuando:** Test con puntero grueso emulado.
- [x] **G-077** Textos nuevos en español de México e inglés — *Cubre:* RNF-6. **Hecho cuando:** Test de paridad de claves pasa.

### Exportación, pruebas y cierre del Hito 1

*Requiere: Teclado, accesibilidad y textos.*

- [x] **G-078** `diagramToSvg` dibuja los conectores en los anclajes elegidos y con extremos libres — *Cubre:* RF-19. **Hecho cuando:** Test: SVG con los puntos esperados.
- [x] **G-079** Markdown legible con «A (anclaje) → B (anclaje)» y «(extremo libre)» — *Cubre:* RF-19. **Hecho cuando:** Test del texto exacto.
- [x] **G-080** e2e: conectar a un anclaje concreto, recargar y comprobar que sigue ahí — *Cubre:* RF-2. **Hecho cuando:** e2e pasa en navegador real.
- [x] **G-081** e2e: mover y redimensionar formas y comprobar que los conectores siguen al mismo anclaje — *Cubre:* RF-3. **Hecho cuando:** e2e pasa.
- [x] **G-082** e2e: extremo libre, reunirlo y borrar una forma con conectores y deshacer — *Cubre:* RF-4, CL-14. **Hecho cuando:** e2e pasa.
- [x] **G-083** Auditoría axe del editor en claro y oscuro y prueba «sin valores sueltos» sin nuevas excepciones — *Cubre:* RF-15, RNF-3, RNF-5. **Hecho cuando:** Cero infracciones graves; línea base sin cambios.
- [x] **G-084** Cierre del Hito 1: `typecheck`, `test`, privacidad y peso — *Cubre:* RNF-4, RNF-8. **Hecho cuando:** Todo en verde.

## HITO 2 — Trazados

### Contrato de caminos y trazado recto

*Requiere: Todos los grupos del Hito 1.*

- [x] **G-085** Contrato `connectorPath`: lista de órdenes `M/L/C`, punto y tangente en una posición, longitud — *Cubre:* RF-6. **Hecho cuando:** Test del contrato con un camino de cada tipo.
- [x] **G-086** `routing/straight.ts` — *Cubre:* RF-6. **Hecho cuando:** Test: línea entre los dos extremos.
- [x] **G-087** `routing/index.ts`: despacha por `route` y respeta extremos libres con dirección hacia el otro extremo — *Cubre:* RF-4, RF-6. **Hecho cuando:** Test con extremo libre.
- [x] **G-088** Posición de la etiqueta por longitud de arco (punto medio) — *Cubre:* RF-10. **Hecho cuando:** Test: etiqueta en el punto medio de un camino de cada tipo.

### Ángulos de 90°

*Requiere: Contrato de caminos y trazado recto.*

- [x] **G-089** `routing/orthogonal.ts`: rejilla comprimida con cruces de coordenadas y obstáculos ampliados — *Cubre:* RF-7. **Hecho cuando:** Test: ningún nodo de la rejilla dentro de un obstáculo.
- [x] **G-090** A* con coste = longitud + 20 por giro y desempates fijos — *Cubre:* RF-7, RNF-1. **Hecho cuando:** Test: ruta mínima en 5 diseños; resultado determinista.
- [x] **G-091** Tramo corto obligatorio de 16 al salir y llegar a un anclaje — *Cubre:* RF-7. **Hecho cuando:** Test: primer y último tramo con la dirección del anclaje.
- [x] **G-092** Simplificar tramos colineales — *Cubre:* RF-7. **Hecho cuando:** Test: sin puntos colineales consecutivos.
- [x] **G-093** Pruebas de propiedades con diseños aleatorios de semilla fija: solo tramos H/V y sin cruzar las dos formas — *Cubre:* RF-7. **Hecho cuando:** 200 diseños aleatorios cumplen ambas propiedades.
- [x] **G-094** Anclajes enfrentados y formas pegadas o encimadas — *Cubre:* CL-1, CL-4. **Hecho cuando:** Test: rodeo razonable que no atraviesa el texto.
- [x] **G-095** Sin camino posible: ruta en «U» alrededor de ambas cajas — *Cubre:* CL-4. **Hecho cuando:** Test: caso sin solución devuelve la «U».
- [x] **G-096** Puntos de paso (`waypoints`): la ruta pasa por ellos — *Cubre:* RF-7. **Hecho cuando:** Test: ruta con 1 y 2 puntos de paso.
- [x] **G-097** Descartar los puntos de paso que queden dentro de un obstáculo al mover formas y conservar el resto — *Cubre:* RF-7, CL-9. **Hecho cuando:** Test de ambos casos.
- [x] **G-098** Operación «restablecer ruta» (vaciar puntos de paso) — *Cubre:* RF-7. **Hecho cuando:** Test: vuelve al cálculo automático.

### Redondeado y libre

*Requiere: Ángulos de 90°.* *(Nota: el camino redondeado base —puntos de control hacia afuera, `k` entre 24 y 160, curvatura por defecto— ya se implementó y probó en el Hito 1 con G-058; aquí quedan la curvatura ajustable, el libre y el resto.)*

- [x] **G-099** `routing/curved.ts`: Bézier con control hacia afuera, `k` entre 24 y 160 — *Cubre:* RF-8. **Hecho cuando:** Test: la tangente en cada extremo coincide con la dirección del anclaje.
- [x] **G-100** Curvatura ajustable (0,2–1) conservada al mover formas — *Cubre:* RF-8. **Hecho cuando:** Test: valor conservado tras mover.
- [x] **G-101** `routing/free.ts`: poligonal por los puntos de control — *Cubre:* RF-9. **Hecho cuando:** Test: pasa por todos los puntos.
- [x] **G-102** `routing/free.ts`: suavizado Catmull-Rom que pasa por todos los puntos — *Cubre:* RF-9. **Hecho cuando:** Test: pasa por los puntos; cambiar `smooth` conserva los puntos.
- [x] **G-103** Operaciones añadir, mover y eliminar punto de control — *Cubre:* RF-9. **Hecho cuando:** Test de las 3 operaciones.
- [x] **G-104** `setRoute`: cambiar de trazado conserva anclajes, texto y estilo y descarta ajustes propios con aviso — *Cubre:* RF-6, CL-9. **Hecho cuando:** Test: se conservan 3 campos; se descartan `waypoints`/`curvature`/`points`.
- [x] **G-105** Trazado predeterminado de un conector nuevo (supuesto: 90°; confirmar en la revisión) — *Cubre:* RF-6. **Hecho cuando:** Test: un conector nuevo nace con el trazado predeterminado vigente.
- [x] **G-106** Historial: ajustar tramo, mover punto de control, cambiar trazado y curvatura = un paso cada uno — *Cubre:* RF-17. **Hecho cuando:** Test de pasos y de deshacer/rehacer.

### Interfaz de trazados

*Requiere: Redondeado y libre.*

- [x] **G-107** `ConnectorLayer` dibuja con `connectorPath` los cuatro trazados — *Cubre:* RF-6. **Hecho cuando:** Test de render de los 4 trazados.
- [x] **G-108** Selector de trazado en el panel de propiedades — *Cubre:* RF-6, RF-18. **Hecho cuando:** Test: cambiar trazado actualiza el camino y conserva uniones.
- [x] **G-109** Arrastrar un tramo de la ruta de 90° para moverlo — *Cubre:* RF-7. **Hecho cuando:** e2e: el tramo se mueve y los ángulos siguen siendo rectos.
- [x] **G-110** Botón «Restablecer ruta» — *Cubre:* RF-7. **Hecho cuando:** Test de interacción.
- [x] **G-111** Asa de curvatura (en el primer punto de control: el punto medio de la curva no depende de la curvatura en configuraciones simétricas) más un control deslizante accesible — *Cubre:* RF-8. **Hecho cuando:** Test: arrastrar cambia la curvatura.
- [x] **G-112** Puntos de control del trazado libre: arrastrar, añadir con doble clic y eliminar con Supr — *Cubre:* RF-9. **Hecho cuando:** Test de interacción de las 3 acciones.
- [x] **G-113** Interruptor «Suavizado» del trazado libre — *Cubre:* RF-9. **Hecho cuando:** Test: alterna y conserva los puntos.
- [x] **G-114** Lista de puntos de control en el panel (alternativa de teclado) — *Cubre:* RF-9, RF-18. **Hecho cuando:** Test solo con teclado: añadir, mover y eliminar un punto.
- [x] **G-115** Etiqueta del conector con fondo del color del lienzo, legible en los cuatro trazados — *Cubre:* RF-10. **Hecho cuando:** Test: la etiqueta no queda tapada por la línea.
- [x] **G-116** Aviso «Se descartaron los ajustes del trazado anterior» con Deshacer — *Cubre:* CL-9. **Hecho cuando:** Test del aviso.

### Exportación, pruebas y cierre del Hito 2

*Requiere: Interfaz de trazados.*

- [x] **G-117** `diagramToSvg` usa `connectorPath` para los cuatro trazados — *Cubre:* RF-19. **Hecho cuando:** Test: el SVG tiene el mismo camino que la interfaz.
- [x] **G-118** Rendimiento: 200 formas y 300 conectores, mover una forma < 100 ms — *Cubre:* RNF-1. **Hecho cuando:** Prueba de escala pasa (ampliar e2e de escala).
- [x] **G-119** e2e: crear y ajustar cada uno de los cuatro trazados — *Cubre:* RF-6 a RF-9. **Hecho cuando:** e2e pasa.
- [x] **G-120** e2e: deshacer y rehacer cada acción de trazado — *Cubre:* RF-17. **Hecho cuando:** e2e pasa.
- [x] **G-121** e2e: lo exportado coincide con lo visible en los cuatro trazados — *Cubre:* RF-19. **Hecho cuando:** Comparación de exportación contra camino del núcleo.
- [x] **G-122** Casos CL-1, CL-4 y CL-9 con prueba — *Cubre:* CL-1, CL-4, CL-9. **Hecho cuando:** Cada uno con su prueba que pasa.
- [x] **G-123** Cierre del Hito 2: `typecheck`, `test`, axe, privacidad y peso — *Cubre:* RNF-3, RNF-4, RNF-8. **Hecho cuando:** Todo en verde.

## HITO 3 — Estilo, portapapeles y cierre

### Estilo de formas

*Requiere: Todos los grupos del Hito 2.*

- [x] **G-124** Operaciones de estilo de forma: relleno, contorno, grosor, línea, texto y opacidad — *Cubre:* RF-11. **Hecho cuando:** Test de las 6 operaciones con valores válidos e inválidos.
- [x] **G-125** Un cambio sobre una selección múltiple es un solo paso de historial — *Cubre:* RF-11, RF-17. **Hecho cuando:** Test: 3 formas = 1 paso.
- [x] **G-126** `ShapeNode` dibuja el estilo (colores resueltos al tema) — *Cubre:* RF-11, RF-13. **Hecho cuando:** Test de render en ambos temas.
- [x] **G-127** Opacidad solo en el relleno; «sin relleno» y 0 % siguen siendo seleccionables por el interior — *Cubre:* RF-11, CL-8. **Hecho cuando:** Test: clic en el interior selecciona la forma.
- [x] **G-128** Sección de estilo de forma en el panel de propiedades — *Cubre:* RF-11. **Hecho cuando:** Test: cada control cambia su propiedad.

### Selector de color

*Requiere: Estilo de formas.*

- [x] **G-129** `ColorPicker`: cuadrícula de la paleta del sistema con nombre accesible — *Cubre:* RF-13. **Hecho cuando:** Test: cada color con nombre y selección con teclado.
- [x] **G-130** Campo hexadecimal con validación y entrada de color nativa — *Cubre:* RF-13. **Hecho cuando:** Test: acepta y rechaza valores; aplica de inmediato.
- [x] **G-131** Últimos 8 colores personalizados como preferencia del dispositivo — *Cubre:* RF-13. **Hecho cuando:** Test: se guardan, se limitan a 8 y no entran al respaldo.
- [x] **G-132** Los colores personalizados se ven igual en ambos temas y los de paleta se adaptan — *Cubre:* RF-13. **Hecho cuando:** Test de render en claro y oscuro.
- [x] **G-133** Aviso no bloqueante si el texto tiene < 4,5:1 con el relleno visible (mezclado con opacidad) — *Cubre:* RF-13, CL-7. **Hecho cuando:** Test: aviso con un caso bajo; se permite aplicar.
- [x] **G-134** Aplicar un color lo muestra de inmediato y es un paso de deshacer — *Cubre:* RF-13, RF-17. **Hecho cuando:** Test de interacción.

### Estilo de conectores y puntas

*Requiere: Selector de color.*

- [x] **G-135** Operaciones de estilo de conector: color, grosor, línea y texto de etiqueta — *Cubre:* RF-12. **Hecho cuando:** Test de las 4 operaciones.
- [x] **G-136** `caps.ts`: geometría de flecha, círculo, rombo y ninguna, orientada por la tangente — *Cubre:* RF-12. **Hecho cuando:** Test de geometría y orientación en 4 tangentes.
- [x] **G-137** La línea se acorta bajo la punta y la punta hereda el color — *Cubre:* RF-12. **Hecho cuando:** Test: la línea no asoma bajo la punta.
- [x] **G-138** Punta distinta en cada extremo — *Cubre:* RF-12. **Hecho cuando:** Test: origen y destino independientes.
- [x] **G-139** `ConnectorLayer` dibuja estilo y puntas — *Cubre:* RF-12. **Hecho cuando:** Test de render.
- [x] **G-140** Sección de estilo de conector en el panel de propiedades — *Cubre:* RF-12. **Hecho cuando:** Test: cada control cambia su propiedad.
- [x] **G-141** `diagramToSvg` dibuja estilos, línea y puntas (colores resueltos al tema claro) — *Cubre:* RF-19. **Hecho cuando:** Test: SVG con colores y puntas esperados.

### Estilos predeterminados

*Requiere: Estilo de conectores y puntas.*

- [x] **G-142** `defaults.ts`: leer, escribir y restablecer `diagram.default.shape` y `diagram.default.edge` en `meta` — *Cubre:* RF-14. **Hecho cuando:** Test con dos espacios: valores independientes.
- [x] **G-143** Elementos nuevos nacen con el predeterminado de su tipo (o el del sistema) — *Cubre:* RF-14. **Hecho cuando:** Test: forma y conector nuevos.
- [x] **G-144** «Usar como predeterminado» guarda el estilo (y el trazado en conectores) sin cambiar los existentes — *Cubre:* RF-14. **Hecho cuando:** Test: los existentes no cambian.
- [x] **G-145** «Restablecer» predeterminados — *Cubre:* RF-14. **Hecho cuando:** Test: vuelven a los del sistema.
- [x] **G-146** Respaldo: escribir `diagram-defaults.json` solo si existe, con salida determinista — *Cubre:* RF-14, RNF-2. **Hecho cuando:** Test: ausente si no hay; bytes iguales en dos respaldos.
- [x] **G-147** Restauración: leer `diagram-defaults.json` y tolerar su ausencia — *Cubre:* RF-14, CL-13. **Hecho cuando:** Test con respaldo con archivo y con respaldo anterior.

### Copiar y pegar

*Requiere: Estilos predeterminados.*

- [x] **G-148** `clipboard.ts`: copiar formas con sus conectores internos — *Cubre:* RF-14b. **Hecho cuando:** Test: copia formas y conectores internos.
- [x] **G-149** Conectores con un solo extremo en la selección se copian con el otro extremo libre — *Cubre:* RF-14b. **Hecho cuando:** Test del caso.
- [x] **G-150** Pegar: ids nuevos, extremos remapeados y desplazamiento de 24 acumulable — *Cubre:* RF-14b. **Hecho cuando:** Test: ids únicos; 2.º pegado a 48.
- [x] **G-151** Desplazar también puntos libres, puntos de paso y puntos de control al pegar — *Cubre:* RF-14b. **Hecho cuando:** Test del desplazamiento de los 3 tipos.
- [x] **G-152** Copiar y pegar estilo solo entre elementos del mismo tipo, sin tocar texto, tamaño, posición ni uniones — *Cubre:* RF-14b. **Hecho cuando:** Test: forma→forma y conector→conector; otro tipo se ignora.
- [x] **G-153** Memoria interna del portapapeles (nada al sistema ni al disco) — *Cubre:* RF-14b, DP-8. **Hecho cuando:** Test: no se llama al portapapeles del sistema; no hay escritura.
- [x] **G-154** Pegar en otro diagrama y en otro espacio con la ventana abierta — *Cubre:* RF-14b. **Hecho cuando:** Test: pega con el mismo aspecto.
- [x] **G-155** Atajos y menú «Copiar formato / Pegar formato», sin conflicto con atajos existentes — *Cubre:* RF-14b. **Hecho cuando:** Test de conflicto del gestor de atajos.
- [x] **G-156** Cada pegado es un solo paso de deshacer — *Cubre:* RF-14b, RF-17. **Hecho cuando:** Test: pegar 5 formas = 1 paso.

### Cierre de datos y compatibilidad

*Requiere: Copiar y pegar.*

- [x] **G-157** Búsqueda: el texto de formas y etiquetas se indexa; colores y coordenadas no — *Cubre:* RF-19. **Hecho cuando:** Test de búsqueda.
- [x] **G-158** Respaldo y restauración completos de un diagrama v2 con todos los estilos, trazados y puntos — *Cubre:* RF-19, RNF-2. **Hecho cuando:** Test de ida y vuelta con igualdad exacta.
- [x] **G-159** Restaurar respaldos anteriores y migrar al abrir, con todos los archivos de referencia — *Cubre:* RF-19, CL-13. **Hecho cuando:** Test con respaldo anterior completo.
- [x] **G-160** e2e: aplicar relleno, contorno, texto y opacidad, recargar y exportar — *Cubre:* RF-11, RF-19. **Hecho cuando:** e2e pasa.
- [x] **G-161** e2e: estilo de conectores con puntas y exportación — *Cubre:* RF-12, RF-19. **Hecho cuando:** e2e pasa.
- [x] **G-162** e2e: predeterminados distintos en dos espacios — *Cubre:* RF-14. **Hecho cuando:** e2e pasa.
- [x] **G-163** e2e: copiar y pegar dentro de un diagrama y entre dos — *Cubre:* RF-14b. **Hecho cuando:** e2e pasa.
- [x] **G-164** e2e: deshacer y rehacer cada acción nueva — *Cubre:* RF-17. **Hecho cuando:** e2e pasa.
- [x] **G-165** e2e: respaldo y restauración de v1 y v2 — *Cubre:* RF-19. **Hecho cuando:** e2e contra servidor falso pasa.

### Verificación final

*Requiere: Cierre de datos y compatibilidad.*

- [x] **G-166** Auditoría axe del editor completo en claro y oscuro — *Cubre:* RF-15, RNF-3. **Hecho cuando:** Cero infracciones graves.
- [x] **G-167** Contraste de símbolos y controles sobre todos los rellenos de la paleta — *Cubre:* RF-15. **Hecho cuando:** Prueba de contraste en verde en ambos temas.
- [x] **G-168** Prueba de privacidad: cero conexiones externas nuevas — *Cubre:* RNF-4. **Hecho cuando:** e2e de red en verde.
- [x] **G-169** Fluidez: 200 formas y 300 conectores, interacciones < 100 ms — *Cubre:* RNF-1. **Hecho cuando:** Medición dentro del presupuesto.
- [x] **G-170** Peso: sin aumento fuera del presupuesto de la spec 002 — *Cubre:* RNF-8. **Hecho cuando:** Medición ≤ tope acordado.
- [x] **G-171** Paridad de textos es-MX/en y prueba «sin valores sueltos» sin nuevas excepciones — *Cubre:* RNF-5, RNF-6. **Hecho cuando:** Pruebas pasan sin cambiar la línea base.
- [ ] **G-172** Verificación manual: táctil en dispositivo real (imán al soltar, objetivos de 44 px) (lista firmada) — *Cubre:* RF-15, CL-12. **Hecho cuando:** Checklist con evidencia.
- [ ] **G-173** Verificación manual: símbolos sobre todos los tonos y teclado completo del panel (lista firmada) — *Cubre:* RF-15, RF-18. **Hecho cuando:** Checklist con evidencia.
- [x] **G-174** Matriz de verificación de CL-1 a CL-14 con su prueba — *Cubre:* CL-1 a CL-14. **Hecho cuando:** Cada caso tiene una prueba que pasa.
- [x] **G-175** Matriz de verificación de RNF-1 a RNF-8 — *Cubre:* RNF-1 a RNF-8. **Hecho cuando:** Todos los presupuestos cumplidos.
- [x] **G-176** Actualizar el manual de uso y regenerar sus capturas con los diagramas nuevos — *Cubre:* RF-1 a RF-14b. **Hecho cuando:** `docs/manual` regenerado y revisado.
- [x] **G-177** Suite completa de las specs 001 y 002 sin regresiones — *Cubre:* RNF-7. **Hecho cuando:** `bun run typecheck` y `bun run test` en verde.
- [ ] **G-178** Demostrar los criterios de finalización 1 a 10 de la spec con evidencia (tarea manual) — *Cubre:* todos. **Hecho cuando:** Checklist completo firmado.
- [x] **G-179** Sincronizar spec.md y plan.md con lo construido — *Cubre:* art. 2. **Hecho cuando:** Sin diferencias entre código, spec y plan.

---

## Matriz de cobertura (generada de las etiquetas de cada tarea)

| Requisito | Tareas | Total |
|---|---|---|
| **RF-1** | G-008, G-011, G-012, G-013 … G-176 | 10 |
| **RF-2** | G-001, G-017, G-042, G-043 … G-176 | 13 |
| **RF-3** | G-036, G-046, G-081, G-176 | 4 |
| **RF-4** | G-001, G-008, G-017, G-044 … G-176 | 12 |
| **RF-5** | G-025, G-042, G-176 | 3 |
| **RF-6** | G-009, G-085, G-086, G-087 … G-176 | 10 |
| **RF-7** | G-015, G-089, G-090, G-091 … G-176 | 13 |
| **RF-8** | G-099, G-100, G-111, G-119 … G-176 | 5 |
| **RF-9** | G-101, G-102, G-103, G-112 … G-176 | 8 |
| **RF-10** | G-088, G-115, G-176 | 3 |
| **RF-11** | G-019, G-024, G-124, G-125 … G-176 | 9 |
| **RF-12** | G-019, G-135, G-136, G-137 … G-176 | 9 |
| **RF-13** | G-003, G-018, G-029, G-034 … G-176 | 13 |
| **RF-14** | G-006, G-007, G-142, G-143 … G-176 | 10 |
| **RF-14b** | G-148, G-149, G-150, G-151 … G-176 | 11 |
| **RF-15** | G-054, G-055, G-056, G-066 … G-173 | 14 |
| **RF-16** | G-057, G-059, G-066 | 3 |
| **RF-17** | G-050, G-064, G-106, G-120 … G-164 | 8 |
| **RF-18** | G-072, G-073, G-074, G-075 … G-173 | 7 |
| **RF-19** | G-002, G-005, G-007, G-010 … G-165 | 28 |
| **RNF-1** | G-004, G-090, G-118, G-169 … G-175 | 5 |
| **RNF-2** | G-005, G-026, G-146, G-158 … G-175 | 5 |
| **RNF-3** | G-083, G-123, G-166, G-175 | 4 |
| **RNF-4** | G-041, G-084, G-123, G-168 … G-175 | 5 |
| **RNF-5** | G-035, G-083, G-171, G-175 | 4 |
| **RNF-6** | G-077, G-171, G-175 | 3 |
| **RNF-7** | G-022, G-023, G-031, G-032 … G-177 | 8 |
| **RNF-8** | G-041, G-084, G-123, G-170 … G-175 | 5 |
| **CL-1** | G-094, G-122, G-174 | 3 |
| **CL-2** | G-048, G-174 | 2 |
| **CL-3** | G-016, G-046, G-174 | 3 |
| **CL-4** | G-094, G-095, G-122, G-174 | 4 |
| **CL-5** | G-045, G-174 | 2 |
| **CL-6** | G-047, G-174 | 2 |
| **CL-7** | G-133, G-174 | 2 |
| **CL-8** | G-127, G-174 | 2 |
| **CL-9** | G-097, G-104, G-116, G-122 … G-174 | 5 |
| **CL-10** | G-056, G-174 | 2 |
| **CL-11** | G-002, G-027, G-030, G-174 | 4 |
| **CL-12** | G-049, G-076, G-172, G-174 | 4 |
| **CL-13** | G-040, G-147, G-159, G-174 | 4 |
| **CL-14** | G-065, G-082, G-174 | 3 |
