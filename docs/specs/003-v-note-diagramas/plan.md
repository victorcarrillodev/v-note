# Plan 003 — Diagramas de flujo: conexión precisa, trazados y color

> **Estado:** implementado (Hitos 0 a 3); pendientes solo las tres verificaciones manuales firmadas (`docs/acceptance-diagramas.md`) · **Implementa:** `docs/specs/003-v-note-diagramas/spec.md` (RF-1 a RF-19 incl. RF-14b, RNF-1 a RNF-8, CL-1 a CL-14).
> **Marco:** `docs/constitution.md`. Este plan no contiene código de producción; fija el **cómo**: módulos, modelo de datos con ejemplo, algoritmos en pseudocódigo, decisiones técnicas con su alternativa descartada, hitos y estrategia de pruebas.
> **Cómo leerlo:** cada parte indica entre corchetes los requisitos que cubre, por ejemplo **[RF-3]**. La sección 15 es una matriz que comprueba que no queda ningún RF, RNF ni CL sin cubrir.
> **Punto de partida (estado actual del código):** el diagrama es un JSON de formas (`color` único) y conectores (`from`/`to` = ids de forma, sin anclaje) guardado como texto en el bloque `diagram`; `packages/core/src/diagrams/diagram.ts` define el modelo y `DiagramHistory`; `packages/ui/src/diagram/DiagramEditor.tsx` lo dibuja con `@xyflow/react` (cuatro `Handle` por forma, controles de zoom propios de la librería); `packages/core/src/export/svg.ts` dibuja los conectores como línea centro a centro recortada al borde.

---

## 1. Resumen y cumplimiento de la constitución

### 1.1 Resumen
La causa de que «los conectores se unan donde quieren» es que el modelo **no guarda dónde** se une cada extremo: solo guarda qué formas conecta, y el dibujo decide el punto. La solución es de raíz de datos, no de interfaz:

1. El modelo guarda, por cada extremo, **forma + anclaje** (uno de 8 puntos con nombre) o **un punto libre** del lienzo.
2. Toda la geometría (posición de anclajes, rutas de los cuatro trazados, puntas de flecha, puntos de imán) vive en el **núcleo, en TypeScript puro y probado**; la interfaz solo dibuja lo que el núcleo calcula y la exportación a SVG usa las mismas funciones, así que lo exportado es idéntico a lo que se ve.
3. El estilo (relleno, contorno, texto, opacidad; color, grosor, línea y puntas del conector) pasa a ser un objeto `style` por elemento, con color como **referencia a la paleta del sistema o hex personalizado**.
4. El formato del diagrama sube a **versión 2**; los diagramas v1 se **migran al leerlos**, sin tocar el archivo hasta que la persona edite.
5. Los controles del lienzo (zoom, anclajes, asas, puntos de control) se rehacen con los **tokens del estándar de la spec 002**, con anillo doble, objetivos de 32/44 px y contraste comprobado por pruebas.

### 1.2 Cumplimiento de la constitución
| Artículo | Cómo lo respeta este plan |
|---|---|
| 1 Stack mínimo | **Cero dependencias nuevas** (sección 3). Se sigue con `@xyflow/react`, Radix, Tailwind y Vitest/Playwright. |
| 2 La spec manda / hitos | Cuatro hitos en orden (sección 13); este plan nace de la spec 003 y la sustituye donde la spec 001 (RF-9) difiere (extremos libres al borrar una forma). |
| 3 Lógica separada | Anclajes, rutas, migración, estilo, portapapeles y valores predeterminados viven en `packages/core` sin React, DOM ni Tauri. La UI no calcula geometría. |
| 4 Tests | Toda regla de datos lleva prueba (sección 14); `bun run typecheck` y `bun run test` pasan antes de cerrar cada tarea. |
| 5 SQLite única fuente de verdad | El diagrama sigue en su bloque (SQLite); los predeterminados en la tabla `meta` del espacio. La migración v1→v2 es en lectura y **no sobrescribe** nada sin que la persona edite. Eliminar formas pasa por deshacer. |
| 6 Respaldo abierto y privado | El respaldo conserva los datos nuevos sin cifrar y deterministas; se añade un archivo opcional (sección 11). Sin servicios nuevos ni telemetría. |
| 7 Idioma | Textos nuevos en español de México con traducción al inglés; identificadores en inglés. |

---

## 2. Decisiones de plan

| ID | Decisión | Alternativa descartada | Cubre |
|---|---|---|---|
| **DP-1** | Cada extremo de conector guarda **forma + id de anclaje** (`n, ne, e, se, s, sw, w, nw`) o **un punto absoluto**. Los anclajes se identifican por nombre, no por coordenadas. | Guardar coordenadas relativas a la forma: al redimensionar formas no rectangulares (rombo, paralelogramo) el punto dejaría de estar en el contorno. | RF-1, RF-2, RF-3 |
| **DP-2** | Geometría y rutas (**recto, 90°, redondeado, libre**) calculadas por **código propio en el núcleo**, deterministas y con pruebas. | (a) Los trazados de `@xyflow/react`: no admiten extremos libres, tramos ajustables ni exportación idéntica a SVG. (b) Una librería de enrutado ortogonal: dependencia nueva (art. 1) y más peso para un problema pequeño (solo se evitan las dos formas unidas). | RF-6 a RF-9, RF-19 |
| **DP-3** | Los conectores se dibujan en una **capa SVG propia** dentro del lienzo de `@xyflow/react` (que sigue gestionando formas, desplazamiento, zoom, selección y redimensión). Las uniones, el imán y los puntos de control los manejan eventos de puntero propios. | Aristas nativas de la librería con «formas ficticias» para los extremos libres: el estado se desdobla (modelo y librería) y arrastrar tramos igual exige capa propia. | RF-2, RF-4, RF-7 a RF-9 |
| **DP-4** | El diagrama pasa a **`version: 2`** dentro del mismo JSON del bloque; los v1 (sin campo de versión) se **migran en memoria al abrir** y se guardan en v2 solo al editar. | Migración masiva al actualizar: toca datos que la persona no abrió (art. 5) y no es reversible. | RF-19, RNF-7 |
| **DP-5** | Los colores se guardan como **`palette:<id>`** (cambia con el tema) o **hex** (fijo). Un hex v1 que coincide con la paleta se convierte a `palette:<id>`, que es como ya se dibujaba. | Guardar siempre hex y adaptarlo al tema: pierde la intención «este color es fijo» (D-9). | RF-13, RF-19 |
| **DP-6** | El ajuste manual del trazado de 90° se guarda como **puntos de paso** (`waypoints`) por los que la ruta debe pasar. La ruta se recalcula entre puntos. | Guardar un desplazamiento por tramo: se invalida al cambiar el número de tramos al mover formas. | RF-7, CL-9 |
| **DP-7** | Las **puntas de flecha** son geometría calculada por el núcleo (no `<marker>` de SVG) y heredan el color del conector. | `<marker>` de SVG: no toma el color del trazo de forma fiable y complica que la exportación sea idéntica. | RF-12, RF-19 |
| **DP-8** | El **portapapeles es una memoria interna** de la aplicación; no usa el del sistema ni se guarda en disco. | Portapapeles del sistema: expone datos fuera de v-note (regla de AGENTS) y exige permisos por plataforma. | RF-14b |
| **DP-9** | Los estilos predeterminados viven en la tabla `meta` **de cada espacio** (`diagram.default.shape`, `diagram.default.edge`); el respaldo añade un archivo opcional. | Dentro de cada diagrama: obliga a redefinirlos en cada diagrama nuevo. Preferencia del dispositivo: se mezclaría entre espacios. | RF-14 |
| **DP-10** | Un **panel de propiedades** con selectores (forma y anclaje de cada extremo, trazado, estilo) da la vía de teclado y de lector de pantalla equivalente a arrastrar. | Solo gestos de puntero: inaccesible (RNF-3). | RF-18 |
| **DP-11** | Se **sustituye el control de zoom de la librería** por uno propio con los tokens, íconos del estándar y objetivos de 32/44 px. | Restilizar el de la librería con CSS: su marcado fijo no permite garantizar contraste ni tamaño táctil ni estados. | RF-15, RF-16 |
| **DP-12** | Deshacer sigue usando **instantáneas de `DiagramHistory`**; durante un gesto se muestra una vista previa y se **confirma un solo paso al soltar**. | Un paso por movimiento de puntero: llena el historial (límite 100) y rompe «un solo paso» (RF-17). | RF-17 |

---

## 3. Dependencias nuevas
**Ninguna.** Selector de color: campo hexadecimal propio más la entrada de color nativa del navegador/webview (sin biblioteca). Íconos: los del estándar (spec 002 §5); faltantes se añaden al mismo conjunto, sin otra biblioteca. Si en un hito aparece la necesidad de una, **se detiene y se actualiza este plan antes** (AGENTS).

---

## 4. Modelo de datos **[RF-1 a RF-5, RF-11 a RF-14, RF-19, RNF-7]**

### 4.1 Tipos (descripción)
- **Punto:** `{ x, y }` en coordenadas del lienzo (finitos).
- **Anclaje:** uno de `n, ne, e, se, s, sw, w, nw`.
- **Extremo:** o bien `{ node, anchor }` (unido) o bien `{ x, y }` (libre).
- **Estilo de forma:** `fill` (color o `none`), `fillOpacity` (0–1), `stroke` (color), `strokeWidth` (valor del conjunto fijo), `strokeDash` (`solid | dashed | dotted`), `textColor`.
- **Estilo de conector:** `color`, `width` (`thin | medium | thick`), `dash` (`solid | dashed | dotted`), `startCap`/`endCap` (`none | arrow | circle | diamond`), `textColor`.
- **Color:** `palette:<id>` (adaptado al tema) o hex `#rgb/#rrggbb/#rrggbbaa` (fijo).
- **Trazado (`route`):** `straight | orthogonal | curved | free`. Campos propios: `waypoints` (orthogonal), `curvature` (curved, número 0.2–1), `points` y `smooth` (free).

### 4.2 Ejemplo (versión 2)
```json
{
  "version": 2,
  "nodes": [
    { "id": "n1", "shape": "terminator", "x": 0, "y": 0, "w": 140, "h": 50, "text": "Inicio",
      "style": { "fill": "palette:green", "fillOpacity": 1, "stroke": "palette:ink", "strokeWidth": 2, "strokeDash": "solid", "textColor": "palette:ink" } },
    { "id": "n2", "shape": "decision", "x": 0, "y": 140, "w": 140, "h": 80, "text": "¿Válido?",
      "style": { "fill": "#fff3b0", "fillOpacity": 0.6, "stroke": "#b45309", "strokeWidth": 2, "strokeDash": "dashed", "textColor": "#3b2400" } }
  ],
  "edges": [
    { "id": "e1", "from": { "node": "n1", "anchor": "s" }, "to": { "node": "n2", "anchor": "n" },
      "route": "orthogonal", "waypoints": [], "label": "",
      "style": { "color": "palette:ink", "width": "medium", "dash": "solid", "startCap": "none", "endCap": "arrow", "textColor": "palette:ink" } },
    { "id": "e2", "from": { "node": "n2", "anchor": "e" }, "to": { "x": 320, "y": 180 },
      "route": "free", "points": [{ "x": 240, "y": 180 }], "smooth": true, "label": "no",
      "style": { "color": "#dc2626", "width": "thick", "dash": "dotted", "startCap": "circle", "endCap": "arrow", "textColor": "#dc2626" } }
  ]
}
```
`e2` muestra un conector con **extremo libre** y trazado libre suavizado. La serialización usa el mismo JSON de claves ordenadas que el resto del proyecto (`stableJson`) para que el respaldo sea determinista **[RNF-2]**.

### 4.3 Validación al leer (nunca lanza)
- Un diagrama sin `version` se trata como v1 y pasa por la migración; `version: 2` se valida; una versión mayor devuelve error `UNSUPPORTED_VERSION` con mensaje claro (la aplicación no baja de versión).
- Ids únicos; todo extremo unido apunta a una forma existente; los números son finitos; `style` incompleto se completa con el predeterminado; valores desconocidos (trazado, punta, grosor) devuelven error legible en lugar de dibujar algo incorrecto.
- Dos extremos en la misma forma **y** el mismo anclaje: se rechaza al crear (INVALID, motivo `SAME_ANCHOR`) **[RF-5]**; se permite si los anclajes difieren o si al menos un extremo es libre.

### 4.4 Migración v1 → v2 (en lectura) **[RF-19, CL-11, CL-13]**
```
migrate(v1):
  para cada forma n:
    style.fill        = n.color                 // si coincide con la paleta → palette:<id>, si no, hex tal cual
    style.stroke      = palette:ink, strokeWidth = 2, strokeDash = solid   // la nota: dashed (como se dibujaba)
    style.textColor   = palette:ink, fillOpacity = 1
  para cada conector e (from, to ids):
    e.from = { node: from, anchor: "e" }        // el editor dibujaba TODOS los conectores
    e.to   = { node: to,   anchor: "w" }        // del lado derecho de origen al izquierdo de destino
    e.route = curved ; e.style = estilo de conector por defecto (flecha al final)
  version = 2
```
Reglas: nunca se pierden texto, posiciones, ids ni conexiones; la migración es una función pura y determinista, con **archivos de referencia** (diagramas v1 en `fixtures/v1` con su v2 esperada en `fixtures/v2`) y prueba de que migrar dos veces no cambia nada.
**Verificado en H0 (`spikes/RESULTS-diagramas.md`, G-002):** en pantalla todos los conectores v1 usan el punto de unión derecho → izquierdo con trazo curvo (de ahí el problema de la spec), por eso la migración los une a **este → oeste** y no «al anclaje más cercano»; la exportación SVG dibujaba centro a centro, y pasa a usar los anclajes en el Hito 1.

---

## 5. Anclajes **[RF-1, RF-2, RF-3, RF-5, CL-1, CL-2, CL-3, CL-12]**

### 5.1 Posición de los ocho anclajes por forma
La caja de la forma es `(x, y, w, h)`; `cx, cy` su centro.
| Forma | n / e / s / w | ne / se / sw / nw |
|---|---|---|
| Proceso, nota | Centros de lado | Esquinas de la caja |
| Inicio/fin (terminator, extremos semicirculares de radio `h/2`) | Centros de lado | Punto del arco a 45° en cada extremo (proyección de la esquina sobre el contorno real) |
| Decisión (rombo) | Los cuatro vértices | Punto medio de cada lado diagonal, p. ej. `ne = (cx + w/4, cy − h/4)` (cruce de la diagonal de la caja con el contorno) |
| Entrada/salida (paralelogramo de inclinación 15°; desplazamiento `s = h·tan 15°`) | `n`/`s`: centro de arriba/abajo; `e`/`w`: punto medio del lado inclinado | Los cuatro vértices: `nw = (x+s, y)`, `ne = (x+w, y)`, `se = (x+w−s, y+h)`, `sw = (x, y+h)` |

Cada anclaje tiene también una **dirección de salida** (hacia afuera de la forma): `n=(0,−1)`, `e=(1,0)`, `s=(0,1)`, `w=(−1,0)`; para las esquinas se elige el eje dominante según la posición del otro extremo (horizontal si `|dx| ≥ |dy|`, vertical si no). Las tres tablas se prueban con **valores exactos** por forma, incluida la forma al tamaño mínimo (CL-3).

### 5.2 Imán y selección del anclaje
```
nearestAnchor(diagram, punto, radio, excluirExtremoPropio):
  mejor = null
  para cada forma f cuyo contorno ampliado por `radio` contenga el punto:
    para cada anclaje a de f:
      d = distancia(punto, posicion(f, a))
      si d <= radio y (mejor == null o d < mejor.d): mejor = {f, a, d}
  devolver mejor        // empates: gana la forma más arriba en el orden de dibujo
```
`radio` = **16 px de pantalla** (24 px en puntero grueso), convertido a unidades del lienzo dividiendo entre el zoom. Si no hay anclaje en el radio, el extremo queda **libre** en la posición soltada **[RF-4]**.

### 5.3 Seguimiento **[RF-3]**
El conector guarda `{ node, anchor }`: al mover o redimensionar, la posición se **recalcula** desde la forma; el anclaje nunca cambia solo. No hay estado derivado guardado, así que no puede quedar desfasado.

### 5.4 Eliminar una forma **[RF-4, CL-6, CL-14]**
`deleteNode` devuelve el diagrama y la lista de conectores **liberados**: cada uno conserva su extremo como punto libre en la **última posición del anclaje**. La interfaz avisa «N conectores quedaron con extremo libre» con la acción **Deshacer** (spec 002 §9.2). Deshacer restaura forma y uniones exactas por ser instantánea.

---

## 6. Trazados **[RF-6 a RF-10, CL-4, CL-9]**

Todos los trazados producen un **camino** (lista de órdenes de dibujo `M/L/C` y una función para obtener punto y tangente en cualquier posición). Interfaz y exportación SVG consumen ese mismo resultado. Un extremo libre toma como dirección de salida la que apunta hacia el otro extremo.

### 6.1 Recto **[RF-6]**
Línea del punto de origen al de destino.

### 6.2 Ángulos de 90° **[RF-7, CL-1, CL-4, CL-9]**
```
rutaOrtogonal(p0, d0, p1, d1, obstaculos = [formaOrigen, formaDestino], pasos = waypoints):
  puntos = [p0, ...pasos, p1]
  ruta = []
  para cada par consecutivo (a, b) de puntos:
    sa = a + dirSalida(a) * 16        // tramo corto obligatorio al salir de un anclaje
    sb = b + dirLlegada(b) * 16
    xs = {sa.x, sb.x} ∪ {bordes de cada obstaculo ampliado 16}
    ys = {sa.y, sb.y} ∪ {bordes de cada obstaculo ampliado 16}
    grafo = cuadricula comprimida con cruces de xs × ys, sin nodos dentro de obstaculos
    camino = A*(sa → sb) con coste = longitud + 20 * numeroDeGiros
    ruta += [a] + camino + [b]
  devolver simplificar(ruta)         // elimina puntos colineales; todos los tramos horizontales o verticales
```
- **Invariantes (probados):** todos los tramos son horizontales o verticales; ningún tramo cruza el interior de las dos formas unidas; el resultado es **determinista** para la misma entrada (desempates por orden fijo).
- **Ajuste de un tramo [RF-7]:** al arrastrar un tramo se añade un **punto de paso** sobre la nueva posición del tramo; la ruta se recalcula pasando por él y el resto se reajusta.
- **Restablecer:** vaciar `waypoints`.
- **Al mover formas:** se recalcula; un punto de paso que quede dentro de un obstáculo ampliado se descarta (se avisa una vez); los demás se conservan.
- **Anclajes enfrentados o formas encimadas [CL-1, CL-4]:** el A* rodea el obstáculo; si no hay camino, cae a una ruta en «U» alrededor de la unión de ambas cajas. Nunca pasa por el texto de la forma.

### 6.3 Redondeado **[RF-8]**
```
curva(p0, d0, p1, d1, curvatura = 0.5):
  k = limitar(distancia(p0, p1) * curvatura, 24, 160)
  c0 = p0 + d0 * k ; c1 = p1 + d1 * k       // salen hacia afuera de la forma: sin picos
  devolver Bezier cúbica(p0, c0, c1, p1)
```
La persona ajusta `curvature` arrastrando el asa central; se conserva al mover formas.

### 6.4 Libre **[RF-9]**
```
rutaLibre(p0, puntos[], p1, suave):
  P = [p0, ...puntos, p1]
  si !suave: devolver poligonal(P)
  sino: Catmull-Rom → cúbicas con tensión 0.5 que pasan por todos los puntos de P
```
Añadir un punto: doble clic sobre un tramo (o botón del panel) lo inserta en esa posición; eliminar: seleccionar el punto y suprimir (o botón del panel). Cambiar `smooth` conserva los puntos. Los extremos libres y los puntos de control son **absolutos**.

### 6.5 Cambio de trazado **[RF-6, CL-9]**
Se conservan anclajes, texto y estilo. Los datos propios del trazado anterior (`waypoints`, `curvature`, `points`) se **descartan con aviso** «Se descartaron los ajustes del trazado anterior» con Deshacer.

### 6.6 Etiqueta **[RF-10]**
Se coloca en el punto medio **por longitud de arco**; se dibuja con un fondo del color del lienzo y sin cruzarse con la línea; sigue siendo legible en los cuatro trazados y en exportación.

### 6.7 Puntas de flecha **[RF-12, DP-7]**
`cap(tipo, punto, tangente, grosor) → geometría`: `arrow` (triángulo abierto escalado con el grosor), `circle`, `diamond`, `none`. La línea se acorta lo necesario para que no asome bajo la punta. Mismo color que la línea.

---

## 7. Estilo, color y valores predeterminados **[RF-11 a RF-14]**

### 7.1 Paleta del sistema **[RF-13, RF-14]**
- Se amplía `diagramPalette` para tres usos: **relleno** (los ocho tonos actuales, más «sin relleno»), **contorno/línea/texto** (tonos fuertes derivados de los tokens de color de bloque de la spec 002 §4.2, más `ink` = texto principal). Cada entrada tiene un valor para tema claro y otro para oscuro.
- Verificación en H0: listar los tokens de color de bloque que ya existen y confirmar que hay variante de texto/borde para los nueve; si falta alguno, se añade al catálogo de tokens (con su par oscuro y prueba de contraste) **en el mismo hito**.
- Un color `palette:<id>` se resuelve al dibujar con el tema vigente; un hex se dibuja tal cual en ambos temas.

### 7.2 Selector de color **[RF-13]**
Cuadrícula de la paleta, campo hexadecimal con validación, entrada de color nativa y fila de **últimos usados** (máximo 8). Los últimos usados se guardan como **preferencia del dispositivo** (almacén de preferencias existente de la spec 002, DP-10), no en el espacio ni en el respaldo, porque no son contenido.

### 7.3 Aviso de contraste **[RF-13, CL-7]**
```
relleno visible = mezclar(color de relleno, fondo del lienzo del tema vigente, fillOpacity)
si contraste(textColor, relleno visible) < 4.5: mostrar aviso no bloqueante
```
Usa la función de contraste que ya tiene la interfaz (spec 002); el aviso nunca impide aplicar el color.

### 7.4 Opacidad y «sin relleno» **[RF-11, CL-8]**
`fillOpacity` solo afecta al relleno. Con relleno `none` o 0 %, el interior sigue siendo **área de selección** (la zona sensible es la forma completa, no solo lo pintado).

### 7.5 Aplicar a varias formas **[RF-11]**
Un cambio de estilo sobre una selección múltiple produce **un solo paso** de historial.

### 7.6 Estilos predeterminados **[RF-14]**
- Claves `diagram.default.shape` y `diagram.default.edge` en la tabla `meta` del espacio (cada espacio ya tiene su base).
- «Usar como predeterminado» guarda el estilo (y, para el conector, también el trazado) del elemento seleccionado; «Restablecer» borra la clave.
- Al crear un elemento se lee el predeterminado (o el del sistema); **no** altera los existentes.

---

## 8. Copiar y pegar **[RF-14b, CL-14]**
```
copiar(diagrama, idsFormas):
  formas  = formas seleccionadas
  internos = conectores con ambos extremos en formas seleccionadas
  externos = conectores con un solo extremo en la selección → se copian con el otro extremo LIBRE en su posición actual
  guardar en memoria { tipo, version, formas, conectores }   // nunca al disco ni al sistema
pegar(diagrama, clip, vecesPegado):
  desplazamiento = 24 * (vecesPegado + 1)
  renombrar todos los ids con newId(); remapear los extremos internos
  los puntos libres, waypoints y puntos de control se desplazan igual
  devolver diagrama con todo añadido (un solo paso) y la nueva selección
copiarEstilo / pegarEstilo: solo entre elementos del mismo tipo (forma→forma, conector→conector); no toca texto, tamaño, posición ni uniones.
```
Cabe pegar en **otro diagrama** (incluso de otro espacio) mientras la ventana siga abierta. Atajos: copiar/pegar usuales y, para estilo, «Copiar formato / Pegar formato» en el menú del elemento y con teclas del estándar de atajos (no se pisan atajos existentes: prueba de conflicto del gestor de atajos).

---

## 9. Edición, historial y teclado **[RF-17, RF-18, CL-12]**

### 9.1 Un paso por gesto **[RF-17, DP-12]**
Conexión, reubicación de extremo, arrastrar un tramo, mover un punto de control, cambio de trazado, cambio de estilo, pegado y borrado: **un solo paso** cada uno, confirmado al soltar.

### 9.2 Teclado y lector de pantalla **[RF-18]**
- Las formas y conectores se recorren con Tab/flechas; el conector seleccionado abre el **panel de propiedades** con: forma y anclaje de **Origen** y **Destino** (o «Libre» + X/Y), trazado, estilo y puntos de control (lista editable). Todo lo que se hace arrastrando se puede hacer desde el panel.
- Cada conector expone `role` y nombre accesible «Conector de \<forma\> (\<anclaje\>) a \<forma\> (\<anclaje\>) \<texto\>»; los extremos libres se leen como «extremo libre».
- Con reducción de movimiento activa no hay animación del imán ni del cambio de trazado (spec 002 §15).

### 9.3 Táctil **[CL-12]**
Se usa el evento de puntero único (ratón, lápiz, dedo). El imán se aplica **al soltar**; los objetivos son de 44 px en puntero grueso.

---

## 10. Interfaz y controles visibles **[RF-15, RF-16, RNF-3, RNF-5, CL-10]**

### 10.1 Componentes
- **Capa de conectores:** dibuja los caminos del núcleo, la selección, las asas de extremo, los puntos de control, el asa de curvatura y los tramos arrastrables.
- **Capa de anclajes:** muestra los ocho puntos de la forma **seleccionada, bajo el puntero o durante el arrastre de un extremo**, con el más cercano resaltado.
- **Controles del lienzo (propios):** acercar, alejar, ajustar a la vista y nivel de zoom en %, con nombre accesible y tooltip, sobre superficie de tarjeta con borde de control.
- **Panel de propiedades y selector de color** con los componentes base de la spec 002.

### 10.2 Reglas de visibilidad (probadas)
| Elemento | Regla |
|---|---|
| Íconos y símbolos (anclajes, asas, puntos de control, puntas, selección) | Contraste ≥ 3:1 contra el lienzo **y** contra el elemento sobre el que se dibujan en ambos temas. Para lograrlo, los símbolos usan **anillo doble**: relleno de tarjeta + trazo de acento, de modo que siempre hay un tono claro y uno oscuro. |
| Texto de controles (nivel de zoom, etiquetas) | ≥ 4,5:1. |
| Área activa | ≥ 32 px de lado (cuadro transparente alrededor del símbolo visible); **≥ 44 px** con puntero grueso. |
| Estados | Normal, hover, foco (anillo doble de la spec 002), activo, deshabilitado: todos distinguibles; el deshabilitado cumple 3:1 de contraste de borde. |
| Zoom bajo/alto | Los anclajes y asas de lo **seleccionado** mantienen su tamaño en pantalla dividiendo entre el zoom (con un tope); los controles del lienzo no escalan **[CL-10]**. |
| Superposición | Los controles indispensables van por encima de formas y conectores en el orden de capas; nunca se ocultan tras el contenido. |

**Decisiones de implementación del Hito 1 (verificadas en Chrome real):**
- **Capas.** Los trazos van **debajo** de las formas (z negativo) y los anclajes y las asas de los extremos **encima** de todo (z 3000, por encima del 1000 con que la librería eleva una forma seleccionada). Sin esto el tirador de redimensión de la forma se comía los clics sobre los anclajes.
- **Tiradores de redimensión.** Coinciden con los anclajes de las esquinas, así que los de las esquinas se desplazan 14 px (por eje) hacia afuera, fuera del área activa del anclaje (≈ 16 px). Los lados conservan su línea de arrastre; cerca de un anclaje manda el anclaje.
- **Anclaje elegido por cercanía.** Con zoom muy alejado las áreas activas de los 8 anclajes se solapan, así que al pulsar se toma siempre el anclaje **más cercano al puntero** de esa forma, no el elemento bajo el puntero.
- **Foco.** El conector enfocado con teclado muestra un anillo doble que sigue su trazo (el contorno por defecto del navegador dibujaba un rectángulo enorme alrededor de su caja).
- **Camino redondeado adelantado** del Hito 2 (base): los diagramas antiguos se dibujaban curvos y debían conservarlo.
- **Exportación.** Desde el Hito 1 el SVG dibuja los **mismos caminos** que el lienzo (anclajes reales, extremos libres, punta de flecha provisional); el archivo dorado de exportación cambió a propósito. El Markdown del respaldo escribe `A (derecha) → B (izquierda)`.

**Decisiones de implementación del Hito 2 (verificadas en Chrome real):**
- **Asa de curvatura.** El punto medio de la curva no depende de la curvatura cuando los dos anclajes se enfrentan (la curva es simétrica), así que el asa «central» no servía: el asa está en el primer punto de control (sobre la dirección de salida del origen) y la curvatura es la distancia del puntero sobre esa dirección entre la distancia entre extremos (0,2–1). Con una curvatura elegida ya no rige el tope de 160 de la curvatura por defecto.
- **Tramos arrastrables.** Solo los intermedios: el primero y el último llevan el tramo corto de salida del anclaje (y su área activa se solapaba con la del extremo).
- **Punto de paso al arrastrar un tramo.** `routeWithPin` mueve el punto de paso existente que ya esté en ese tramo o inserta uno nuevo en el orden en que la ruta recorre el trazado; la búsqueda continúa en línea recta a través del punto (conserva la dirección entre tramos).
- **Desempate.** Entre rutas igual de cortas y con los mismos giros gana la que cruza por el centro (coste de 1e-4 por unidad de desvío, nunca mayor que un giro); así la «Z» de dos formas en diagonal siempre queda con el tramo vertical a mitad de camino.
- **Clic tras soltar.** Al soltar un asa sobre el fondo el navegador lanza un clic sobre el fondo, que deseleccionaba el conector; se ignora durante 400 ms tras terminar un gesto.
- **Estado final de la búsqueda.** La búsqueda tolera formas encimadas: si ningún camino evita las cajas devuelve la ruta en «U» alrededor de ambas, que sigue siendo ortogonal.

**Decisiones de implementación del Hito 3 (verificadas en Chrome real):**
- **Opacidad solo del relleno:** se mezcla el color de relleno con transparente (`color-mix`); el contorno y el texto no se tocan. «Sin relleno» y 0 % conservan la caja completa de la forma, así que se selecciona por el interior.
- **Puntas** (`caps.ts`): flecha, círculo y rombo se calculan en el núcleo con un tamaño que crece con el grosor (flecha: 8 + 2·grosor) y la línea se acorta bajo ellas (nunca más del 80 % de lo que mide). Lienzo y exportación usan el mismo resultado (`styledPath`). La trama de las líneas (`dashArray`) también es común.
- **Estilos predeterminados** (`defaults.ts`): `diagram.default.shape` y `diagram.default.edge` en `meta` de cada espacio (el segundo guarda también el trazado). La interfaz los recibe por un contexto que aporta la página (`DiagramDefaultsProvider`) con la base del espacio abierto. Un valor dañado se ignora.
- **Respaldo:** `diagram-defaults.json` solo si existe; al restaurar se valida antes de escribir nada. Al añadirlo se vio que la lista de archivos que se descargan de GitHub para restaurar (`NEEDED`) **no incluía `tags.json`** (las etiquetas no se restauraban desde GitHub); se añadió junto con el nuevo archivo.
- **Portapapeles:** memoria de la ventana (`diagramClipboard.ts`); las formas copiadas llevan sus conectores internos y los de un solo extremo con el otro libre; el desplazamiento es 24 por pegado acumulado; copiar y pegar formato solo entre el mismo tipo. Atajos propios Ctrl/Cmd+C/V y Ctrl/Cmd+Alt+C/V, sin choque con los de la aplicación (prueba).
- **Selector de color:** paleta (relleno: 10 tonos + «sin relleno»; contorno y texto: tinta + 9 tonos fuertes), campo hexadecimal (3, 6 u 8 dígitos, con o sin `#`) y entrada de color nativa. Los últimos 8 personalizados se guardan en el dispositivo (`localStorage`), no en el respaldo.
- **Aviso de contraste:** compara el texto con el relleno visible en el tema vigente (`diagramContrast.ts`); no bloquea.
- **Rendimiento:** memoria acotada de rutas ortogonales y capa de conectores memorizada (ver `spikes/RESULTS-diagramas.md`).

### 10.3 Valores y tokens **[RNF-5]**
Todo color, radio, espaciado y sombra sale de los tokens; las pruebas «sin valores sueltos» de la spec 002 deben pasar **sin añadir excepciones** a su línea base. Los textos nuevos se añaden a `es-MX` y `en`, con prueba de paridad de claves.

---

## 11. Respaldo, restauración, exportación y búsqueda **[RF-19, RNF-2, RNF-7, CL-13]**
- **Respaldo (`data/<id>.json`):** ya guarda el bloque con el diagrama como texto; pasa a contener la v2 tal cual, determinista. Un respaldo anterior (v1) se restaura y se migra **al abrir** (misma función de la sección 4.4).
- **Estilos predeterminados:** archivo opcional `diagram-defaults.json` en la raíz del respaldo, solo si el espacio los definió. **`formatVersion` no cambia** (1): es un añadido compatible, como ya se hizo con `databases/` y `reminders.json`; `docs/backup-format.md` se actualiza en H0 (antes de escribir código de respaldo). Restaurar un respaldo sin ese archivo deja los predeterminados en los del sistema.
- **Markdown legible:** la nota de diagrama pasa de «A → B» a «A (anclaje) → B (anclaje)», conservando el texto; los extremos libres se muestran como «(extremo libre)».
- **Exportación SVG/HTML/PDF:** `diagramToSvg` usa los **mismos caminos, puntas, anclajes y estilos** que la interfaz (colores resueltos al tema claro para exportar, igual que hoy); texto escapado y salida determinista. Hex y `palette:<id>` se resuelven a color final.
- **Búsqueda:** el texto de formas y etiquetas sigue indexándose; no se indexan colores ni coordenadas.
- **Regla:** cada hito deja exportación y respaldo coherentes con **lo que ese hito añade**; ninguno deja el SVG exportado distinto de lo que se ve.

---

## 12. Estructura de módulos (sin código)

### 12.1 Núcleo `packages/core/src/diagrams/` (TypeScript puro)
| Módulo | Responsabilidad | Cubre |
|---|---|---|
| `diagram.ts` (existente, ampliado) | Tipos v2, operaciones (añadir, mover, redimensionar, borrar con liberación de conectores, conectar, reubicar extremo), validación y serialización | RF-2 a RF-5, RF-19 |
| `migrate.ts` | Migración v1 → v2, pura y determinista | RF-19 |
| `geometry.ts` | Puntos, cajas, segmentos, intersecciones, longitud de arco | base |
| `anchors.ts` | Posición y dirección de anclajes por forma; `nearestAnchor` | RF-1, RF-2 |
| `routing/straight.ts`, `routing/orthogonal.ts`, `routing/curved.ts`, `routing/free.ts`, `routing/index.ts` | Los cuatro trazados y la función común `connectorPath` | RF-6 a RF-9 |
| `caps.ts` | Geometría de puntas | RF-12 |
| `style.ts` | Tipos de estilo, conjuntos permitidos (grosor, línea, puntas), validación de colores, mezcla y contraste con el lienzo | RF-11 a RF-13 |
| `defaults.ts` | Leer/escribir/restablecer predeterminados en `meta` | RF-14 |
| `clipboard.ts` | Copiar, pegar, copiar/pegar estilo | RF-14b |
| `history` (existente, `DiagramHistory`) | Sin cambios de contrato; se prueba con las acciones nuevas | RF-17 |
| `export/svg.ts` (existente) | Usa `connectorPath` y `caps` | RF-19 |
| `backup/markdown.ts` (existente) | Texto de diagrama con anclajes | RF-19 |

### 12.2 Interfaz `packages/ui/src/diagram/`
`DiagramEditor.tsx` (se adelgaza: orquesta), `ShapeNode.tsx`, `ConnectorLayer.tsx`, `AnchorOverlay.tsx`, `CanvasControls.tsx`, `PropertiesPanel.tsx`, `ColorPicker.tsx`, `diagramClipboard.ts` (memoria interna), `useConnectorDrag.ts`. `packages/ui/src/design/diagramPalette.ts` se amplía (sección 7.1). Nada de geometría en la interfaz: solo llama al núcleo.

### 12.3 Adaptadores
Solo se usa lo existente (almacén de preferencias para «últimos colores», base del espacio para predeterminados). **No se añade nada específico de plataforma**, por lo que el cambio Tauri↔Electron no se ve afectado.

---

## 13. Hitos de entrega **[art. 2]**
No se inicia un hito hasta cerrar el anterior. Cada hito deja la aplicación utilizable, con exportación y respaldo coherentes.

| Hito | Contenido | Cubre | Hecho cuando |
|---|---|---|---|
| **H0 — Verificaciones y modelo** | Verificaciones previas desechables (sección 13.1); `docs/backup-format.md` actualizado; modelo v2, validación, serialización, **migración v1→v2** con archivos de referencia; paleta ampliada y tokens faltantes; el editor actual lee y guarda v2 **sin cambiar su aspecto** | RF-19, RNF-7 (base), RNF-2 | Diagramas y respaldos v1 se abren idénticos; round-trip estable; `typecheck` y `test` en verde; resultados en `spikes/RESULTS-diagramas.md` |
| **H1 — Conexión y controles** | Anclajes, imán, extremos libres, seguimiento, borrado liberando conectores, capa de conectores recta, controles de zoom y símbolos con anillo doble, panel de extremos (teclado) | RF-1 a RF-5, RF-15, RF-16, parte de RF-17 y RF-18 | La persona conecta a un anclaje elegido y se queda ahí; auditoría axe y pruebas de contraste/tamaño en verde |
| **H2 — Trazados** | Recto, 90° (ruta y tramos ajustables), redondeado, libre; etiqueta; cambio de trazado; exportación con los caminos | RF-6 a RF-10, CL-1, CL-4, CL-9 | Los cuatro trazados se crean, ajustan, se deshacen y se exportan idénticos; invariantes del enrutador en verde |
| **H3 — Estilo y cierre** | Estilo de formas y conectores, puntas, selector de color y aviso de contraste, predeterminados, copiar/pegar, respaldo/exportación/búsqueda finales, manual y capturas, matrices | RF-11 a RF-14b, RF-17, RF-18 (completos), RF-19, RNF-1 a RNF-8, CL-1 a CL-14 | Criterios de finalización 1 a 10 de la spec demostrados con evidencia |

### 13.1 Verificaciones previas del Hito 0 (código desechable en `spikes/`)
1. **Capa propia sobre `@xyflow/react` 12.12:** probar que una capa SVG dentro del lienzo sigue el desplazamiento y el zoom, y que los eventos de puntero llegan sin chocar con la selección de formas. *Si falla:* sincronizar una capa hermana con la transformación de la vista; si tampoco, detenerse y revisar DP-3.
2. **Aspecto actual del conector** en pantalla y en exportación (sección 4.4) para fijar la regla de migración.
3. **Tokens de color de bloque** disponibles para contorno/texto (sección 7.1).
4. **Rendimiento del enrutador:** A* en 300 conectores recalculados al mover una forma conectada con 10 conectores < 100 ms **[RNF-1]**.
5. **Contenido exacto del respaldo de un diagrama** y del Markdown legible, para no romper restauraciones.

---

## 14. Estrategia de pruebas **[art. 4, RNF-1 a RNF-8]**
Regla TDD de siempre: primero la prueba, que falla; luego la implementación.

### 14.1 Unitarias del núcleo (Vitest)
| Área | Pruebas |
|---|---|
| Anclajes | Tabla de **valores exactos** de los ocho puntos por forma y tamaño (incluido mínimo y proporciones extremas); dirección de salida; `nearestAnchor` con empates y fuera de radio |
| Modelo | Crear, mover, redimensionar y borrar; seguimiento al mismo anclaje; liberación de conectores al borrar; rechazo `SAME_ANCHOR`; ids únicos; versión mayor rechazada |
| Migración | Diagramas v1 de referencia → v2 esperada (JSON exacto); idempotencia; nada se pierde; hex de paleta → `palette:<id>` |
| Rutas | Ortogonal: solo tramos H/V, no cruza las dos formas, determinista, respeta puntos de paso y descarta los inválidos; casos CL-1/CL-4; curva: sale hacia afuera, sin picos; libre: pasa por los puntos, poligonal y suavizado; etiqueta en el punto medio; **pruebas de propiedades** con diseños aleatorios de semilla fija |
| Puntas | Geometría y orientación por tipo, color heredado, línea acortada |
| Estilo | Validación de color, conjuntos permitidos, mezcla con opacidad, contraste del aviso |
| Predeterminados | Leer/escribir/restablecer por espacio; no alteran lo existente |
| Portapapeles | Ids nuevos, conectores internos remapeados, externos con extremo libre, desplazamiento acumulado, pegar en otro diagrama, copiar/pegar estilo solo entre mismo tipo |
| Historial | Cada acción nueva = 1 paso; deshacer/rehacer restituyen uniones y estilos exactos |
| Respaldo/exportación | Round-trip determinista (v1 y v2), restaurar respaldo anterior (archivo de referencia), `diagram-defaults.json` opcional, SVG con caminos y estilos esperados y texto escapado |

### 14.2 Interfaz (Vitest + Testing Library)
Contraste y tamaños de todos los símbolos y controles en ambos temas con la función de contraste existente; estados de cada control; teclas y panel de propiedades (mover un extremo sin ratón); nombres accesibles de conectores; paridad `es-MX`/`en`; prueba «sin valores sueltos» sin nuevas excepciones; aviso de contraste de color de texto.

### 14.3 De extremo a extremo (Playwright)
Conectar a un anclaje concreto y comprobar que **persiste tras recargar**; mover y redimensionar formas y comprobar que los conectores siguen al mismo anclaje; extremo libre y reunión; los cuatro trazados y el ajuste de un tramo; aplicar relleno/contorno/texto/opacidad y conservarlos tras recargar y en la exportación; predeterminados por espacio (cambiar de espacio); copiar/pegar dentro y entre diagramas; deshacer/rehacer de cada acción; **axe** del editor en claro y oscuro; prueba de privacidad (cero conexiones externas); medición de **200 formas / 300 conectores** (< 100 ms por interacción) ampliando el e2e de escala existente; restauración de un respaldo previo a la spec; dos capturas de referencia (claro/oscuro) de los controles.

### 14.4 Verificación manual (lista firmada)
Recorrido táctil en un dispositivo real (imán al soltar, objetivos de 44 px); revisión visual de contraste de símbolos sobre rellenos de todos los tonos; teclado completo en el panel de propiedades.

---

## 15. Matriz de trazabilidad

| Requisito | Parte del plan |
|---|---|
| RF-1 Anclajes | 4.1, 5.1, 5.2 |
| RF-2 Unir a un anclaje | 4.1, 5.2, 9.1 |
| RF-3 Seguimiento | 5.3 |
| RF-4 Extremos libres | 5.2, 5.4 |
| RF-5 Reglas de validez | 4.3 |
| RF-6 Tipos de trazado | 6.1, 6.5 |
| RF-7 Trazado de 90° | 6.2, DP-6 |
| RF-8 Redondeado | 6.3 |
| RF-9 Libre | 6.4 |
| RF-10 Texto del conector | 6.6 |
| RF-11 Estilo de la forma | 4.1, 7.4, 7.5 |
| RF-12 Estilo del conector | 4.1, 6.7, DP-7 |
| RF-13 Selector de color | 7.1 a 7.3, DP-5 |
| RF-14 Estilo predeterminado | 7.6, DP-9 |
| RF-14b Copiar y pegar | 8, DP-8 |
| RF-15 Controles legibles | 10.1, 10.2, DP-11 |
| RF-16 Elementos seleccionados | 10.2 |
| RF-17 Deshacer y rehacer | 9.1, DP-12 |
| RF-18 Teclado y accesibilidad | 9.2, DP-10 |
| RF-19 Compatibilidad | 4.4, 11, DP-4 |
| RNF-1 Fluidez | 6.2, 13.1 (4), 14.3 |
| RNF-2 Datos locales y respaldo | 1.2, 11 |
| RNF-3 Accesibilidad | 9.2, 10.2, 14.2, 14.3 |
| RNF-4 Privacidad | 3, 14.3 |
| RNF-5 Consistencia visual | 10.3 |
| RNF-6 Idioma | 10.3 |
| RNF-7 Compatibilidad | 4.4, 11 |
| RNF-8 Tamaño | 3 (sin dependencias); medición en el cierre de H3 |
| CL-1 Formas pegadas | 6.2 |
| CL-2 Varios en un anclaje | 5.1 (permitido), 10.2 |
| CL-3 Tamaño mínimo | 5.1 |
| CL-4 Ruta imposible | 6.2 |
| CL-5 Ambos extremos libres | 4.1, 5.2 |
| CL-6 Borrar forma con conectores | 5.4 |
| CL-7 Poco contraste | 7.3 |
| CL-8 Sin relleno | 7.4 |
| CL-9 Cambio de trazado | 6.5 |
| CL-10 Zoom extremo | 10.2 |
| CL-11 Diagrama antiguo con cruces | 4.4 |
| CL-12 Táctil | 9.3 |
| CL-13 Respaldo anterior | 4.4, 11 |
| CL-14 Deshacer tras borrar | 5.4, 8 |

---

## 16. Supuestos de valores (ajustables en la revisión)
| Valor | Supuesto |
|---|---|
| Distancia del imán | 16 px de pantalla (24 px en puntero grueso) |
| Tramo mínimo al salir de un anclaje | 16 unidades |
| Coste de giro en la ruta de 90° | 20 |
| Curvatura inicial / rango | 0,5 / 0,2–1 |
| Grosores | fino 1 · medio 2 · grueso 4 (unidades del lienzo) |
| Desplazamiento al pegar | 24 unidades, acumulable |
| Últimos colores recordados | 8 |
| Radio de las esquinas del terminador | `h/2` |
| Inclinación del paralelogramo | 15° (la actual) |
| Trazado de un conector nuevo | 90° (los diagramas migrados quedan redondeados, como se veían); se guarda con el estilo predeterminado |
| Geometría de anclajes | Se construye en H0 porque la migración la necesita; la interacción (imán, arrastre) llega en H1 |

## 17. Riesgos y mitigaciones
| Riesgo | Mitigación |
|---|---|
| La capa propia de conectores no convive con la selección de la librería (DP-3) | Verificación 13.1 (1) antes de escribir la interfaz; alternativa de capa hermana sincronizada |
| La migración cambia el aspecto de un diagrama real | Archivos de referencia reales, prueba de equivalencia visual de segmentos y verificación 13.1 (2) |
| Rutas de 90° poco naturales en diseños densos | Pruebas de propiedades, coste de giro ajustable, ajuste manual con puntos de paso |
| Rendimiento con diagramas grandes | Recalcular solo los conectores de la forma movida, memorizar por geometría, medición en e2e |
| Símbolos ilegibles sobre ciertos rellenos | Anillo doble + prueba de contraste contra todos los tonos de la paleta |
| Una versión anterior de la aplicación no abre un diagrama v2 | Se informa de forma clara (`UNSUPPORTED_VERSION`) y se documenta que no se baja de versión; el respaldo conserva el texto |
| Atajos de copiar/pegar chocan con el editor de la nota | El editor de diagramas ya detiene la propagación de teclas; prueba de conflicto de atajos |

## 18. Decisiones sobre las preguntas del plan
| Pregunta | Decisión |
|---|---|
| Estilo predeterminado | Por espacio de trabajo (DP-9) |
| Alcance del portapapeles | Solo dentro de v-note (DP-8) |
| Cómo calcular rutas | Código propio en el núcleo (DP-2) |
| Formato de datos | Mismo JSON con versión 2, migración en lectura (DP-4) |
| Hitos | Cuatro, por valor (sección 13) |
