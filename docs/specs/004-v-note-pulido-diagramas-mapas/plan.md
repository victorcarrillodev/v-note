# Plan 004 — Pulido de diagramas de flujo y mapas mentales

> **Estado:** borrador · **Implementa:** `docs/specs/004-v-note-pulido-diagramas-mapas/spec.md` (RF-1 a RF-18, RNF-1 a RNF-8, CL-1 a CL-17).
> **Marco:** `docs/constitution.md`. Este plan no contiene código de producción; fija el **cómo**: módulos, modelo de datos, algoritmos en pseudocódigo, decisiones con su alternativa descartada, hitos y pruebas.
> **Cómo leerlo:** cada parte indica entre corchetes los requisitos que cubre, por ejemplo **[RF-3]**. La sección 15 es una matriz que comprueba que no queda ningún RF, RNF ni CL sin cubrir.
> **Punto de partida (estado actual del código):**
> - El diagrama (`packages/ui/src/diagram/DiagramEditor.tsx`) usa `@xyflow/react` con alto fijo de 420 px, `<Background />` (puntos cada 20 px, sin acomodo), barra de herramientas arriba y **paneles de forma y conector debajo** del lienzo.
> - El mapa mental no usa lienzo: `TreeEditor` (`packages/ui/src/diagram/Organizers.tsx`, compartido con el organigrama) pinta botones absolutos sobre una caja con desplazamiento, con la **franja de acciones debajo**; el modelo (`packages/core/src/diagrams/tree.ts`) guarda solo `id`, `text`, `children`, `collapsed`; la distribución es automática (`layoutTree`) y no hay historial, zoom, color ni posiciones.
> - El foco usa una regla global `:focus-visible` con anillo azul de acento (`packages/ui/src/design/tokens.css`); no hay regla global de puntero.
> - Ya existen `components/Popover.tsx` (Radix), `ColorPicker`, `StylePanels`, paleta, aviso de contraste, portapapeles y el historial por instantáneas (`DiagramHistory`).

---

## 1. Resumen y cumplimiento de la constitución

### 1.1 Resumen
Casi todo el pulido sale de **dos piezas comunes** y tres cambios de datos pequeños:

1. Un **marco de lienzo compartido** (`CanvasFrame`) que da, a diagrama y mapa por igual: alto ajustable, vista ampliada, controles de zoom, cuadrícula con acomodo y el menú emergente. Así RNF-8 (coherencia) se cumple por construcción.
2. Un **menú emergente anclado** (`FloatingMenu`, sobre el Popover de Radix ya instalado) que sustituye a las franjas inferiores.
3. **Mapa mental sobre el mismo lienzo** que el diagrama (`@xyflow/react`, ya presente): se obtiene zoom, desplazamiento, cuadrícula y acomodo sin reescribirlos.
4. **Datos aditivos y opcionales**: el mapa gana `off` (desplazamiento), `style` (colores) y `view` (alto); el diagrama gana `view` (alto). Sin campos nuevos obligatorios, un dato anterior se ve y se guarda **idéntico** y el formato de respaldo no cambia.
5. Reglas globales de **puntero** y **foco** en un solo lugar (tokens), con un detector de modalidad de entrada (ratón/táctil frente a teclado).
6. En el núcleo, geometría pura nueva: **cuadrícula**, **puntos de quiebre** (agregar/quitar/proyectar) y **curva continua**; distribución del mapa con desplazamientos.

### 1.2 Cumplimiento de la constitución
| Artículo | Cómo lo respeta este plan |
|---|---|
| 1 Stack mínimo | **Cero dependencias nuevas** (sección 3). |
| 2 La spec manda / hitos | Cinco hitos en orden (sección 13); este plan nace de la spec 004. |
| 3 Lógica separada | Cuadrícula, puntos de quiebre, curva, desplazamientos del mapa, aplicar a la rama y límites de alto viven en `packages/core` sin React ni DOM; la interfaz solo dibuja y llama al núcleo. |
| 4 Tests | Toda regla de datos lleva prueba (sección 14); `bun run typecheck` y `bun run test` pasan antes de cerrar cada tarea. |
| 5 SQLite única fuente de verdad | Todo (posiciones, colores, alto) se guarda en el bloque, es decir en SQLite; solo la preferencia de cuadrícula es del dispositivo (sección 7). Abrir un dato anterior **no lo reescribe** hasta que la persona edita. Eliminar globos pasa por deshacer. |
| 6 Respaldo abierto y privado | Los datos nuevos viajan dentro del JSON del bloque ya respaldado; la salida sigue determinista y sin cambios de formato (sección 11). |
| 7 Idioma | Textos nuevos en español de México con inglés; identificadores en inglés. |

---

## 2. Decisiones de plan

| ID | Decisión | Alternativa descartada | Cubre |
|---|---|---|---|
| **DP-1** | Un **marco compartido** `CanvasFrame` envuelve el lienzo de ambos bloques y aporta alto ajustable, vista ampliada, zoom, cuadrícula y slot del menú. | Repetir cada función en `DiagramEditor` y en el mapa: dos comportamientos que divergen (RNF-8). | RF-3, RF-12, RF-13, RF-18 |
| **DP-2** | La **vista ampliada** deja el mismo componente montado y cambia su posición a `fixed` sobre toda la ventana (con trampa de foco y `aria-modal`), en vez de remontarlo en un portal. Así se conservan selección, zoom, texto a medio escribir y posición (RF-3, CL-9). | Portal/diálogo que remonta el lienzo: pierde estado y obliga a sincronizarlo. Si un ancestro con `transform` rompe `fixed`, el Hito 0 lo detecta y se pasa a un portal con estado elevado. | RF-3, CL-9 |
| **DP-3** | `FloatingMenu` = Radix Popover **no modal**, anclado a un elemento DOM (globo, forma) o a un **punto virtual** (conector, punto de quiebre), con colisión y reubicación automáticas. | Barra fija en el lienzo: no sigue al elemento. Menú contextual del navegador: sin control de posición. | RF-1, RF-2, CL-1, CL-2 |
| **DP-4** | El **mapa mental se reconstruye sobre `@xyflow/react`** (nuevo `MindMapEditor`). El organigrama conserva `TreeEditor` tal cual (fuera de alcance, sección 16). | Ampliar `TreeEditor` con zoom y arrastre propios: reescribe lo que xyflow ya resuelve y no comparte comportamiento con el diagrama. | RF-9 a RF-14, RNF-8 |
| **DP-5** | Posición del globo = **distribución automática + desplazamiento `off`** propio; el desplazamiento se **hereda** por la rama (la posición efectiva suma los `off` del globo y de sus ancestros). Mover un globo cambia solo su `off`, y la rama lo sigue sin tocar a sus descendientes. | Guardar una posición absoluta por globo: al agregar o colapsar hijos hay que recalcular todo y se pierde la distribución automática. | RF-11, CL-6 a CL-8, CL-17 |
| **DP-6** | El color del globo es un objeto `style` con `fill`, `stroke`, `text` y `line` (línea al padre), con el **mismo tipo de color que el diagrama** (`palette:<id>`, hex o `none`). | Un solo color por globo: no cubre D-6. Otro formato de color: dos paletas que mantener. | RF-9, RF-10 |
| **DP-7** | El **alto** vive en un objeto `view` dentro del JSON del bloque (`view.height`), con mínimo y máximo definidos en el núcleo. | Guardarlo en la preferencia del dispositivo: no viaja con la página ni con el respaldo. | RF-12, RF-16 |
| **DP-8** | **Cuadrícula única de 20 px** (la que ya dibuja el diagrama), acomodo con `snapToGrid` de xyflow más funciones puras del núcleo para tamaños y puntos de quiebre. El interruptor y Alt (movimiento libre) se resuelven en la interfaz. | Dos cuadrículas distintas (D-16): rechazado. Redondear al guardar sin vista previa: el elemento «salta» al soltar. | RF-18 |
| **DP-9** | La preferencia de **mostrar/acomodar cuadrícula** es del **dispositivo** (almacenamiento local, sin envolver en tabla `meta`), compartida por diagrama y mapa. | Guardarla en cada bloque: cambia datos de la persona por una preferencia de vista. | RF-18 |
| **DP-10** | **Conectores:** los puntos de paso del trazado curvo y libre se guardan en el campo `points` que ya existe en el modelo v2; los del trazado de 90° siguen en `waypoints`. Agregar y quitar puntos son operaciones puras del núcleo que sirven a los tres trazados. | Un campo nuevo por trazado: tres caminos de código. | RF-6, RF-7 |
| **DP-11** | La **curva continua** usa una spline de Catmull-Rom centrípeta convertida a Béziers cúbicos, con las **tangentes de los extremos fijadas por la dirección del anclaje**; sin puntos intermedios se mantiene la curva Bézier actual, que ya no tiene tramos rectos. | Reutilizar la curva redondeada con tramos rectos: contradice D-5. Una librería de splines: dependencia nueva. | RF-8, CL-5 |
| **DP-12** | El historial del mapa usa una **utilidad genérica de instantáneas** (`Snapshots<T>`, límite 100) extraída de `DiagramHistory`, que sigue exportando lo mismo para el diagrama. | Historial propio del mapa: lógica duplicada. | RF-15 |
| **DP-13** | **Puntero y foco globales** en tokens: una regla de puntero por rol/estado y un detector de modalidad (`data-input="pointer"|"keyboard"`) que oculta el anillo de foco con ratón o dedo y lo mantiene con teclado. | Quitar `:focus-visible` por completo: rompe accesibilidad (RNF-3). Parchear componente por componente: se olvidan y se pierde la regla «toda la app». | RF-4, RF-5 |
| **DP-14** | La **selección** deja de usar el borde de acento: se indica con un halo neutro (sombra de 3 px con el color de texto al 18 %) más un grosor de borde mayor, comprobado en ambos temas. | Seguir con el borde azul: es justo lo que la persona no quiere ver (D-12). | RF-5 |

---

## 3. Dependencias nuevas
**Ninguna.** Se usan `@xyflow/react`, `@radix-ui/react-popover` y `d3-hierarchy` (ya presentes), Tailwind, Vitest y las pruebas e2e existentes. Si un hito detecta la necesidad de otra, **se detiene y se actualiza este plan antes** (AGENTS).

---

## 4. Modelo de datos **[RF-9 a RF-12, RF-16, RNF-7]**

Todo cambio es **aditivo y opcional**; el lector tolera su ausencia y el escritor **no emite** un campo si no tiene valor (así un dato sin editar se serializa idéntico).

### 4.1 Mapa mental (y árbol del organigrama, que ignora los campos nuevos)
- **Árbol:** además de `root`, un `view` opcional con `height` (px).
- **Globo:** además de `id`, `text`, `children`, `collapsed`: `off` opcional (`{x, y}` desplazamiento propio respecto a la distribución automática) y `style` opcional (`fill`, `stroke`, `text`, `line`, cada uno `palette:<id>`, hex o `none`).
- **Validación al leer (nunca lanza):** un `off` no numérico, un color inválido o un `height` fuera de rango se **descartan** o se acotan; el globo se lee con sus valores por defecto. El lector actual conserva solo `root`: se ajusta para conservar también `view`.

### 4.2 Diagrama de flujo
- Un `view` opcional con `height`. Sin él se usa el alto por defecto actual (420 px). Nada más cambia en el formato v2.

### 4.3 Valores de vista
| Concepto | Valor | Dónde |
|---|---|---|
| Cuadrícula | 20 px (constante del núcleo) | núcleo |
| Alto por defecto del diagrama | 420 px | núcleo |
| Alto por defecto del mapa | el que muestre el mapa inicial completo, entre 320 y 560 px | núcleo |
| Alto mínimo / máximo | 240 px / 1600 px | núcleo |
| Preferencias de cuadrícula | mostrar (sí) y acomodar (sí) | dispositivo |

### 4.4 Compatibilidad **[RF-16, CL-12, CL-15]**
- Un mapa o diagrama sin los campos nuevos se **abre igual** (distribución automática, apariencia por defecto, alto por defecto) y **no se reescribe** al abrir.
- Un mapa o diagrama nuevos con estos campos, abiertos por una versión anterior, **se leen sin error**: la versión anterior ignora los campos que no conoce (el lector solo exige `id`, `text` y `children`). Se verifica con una prueba que lee un archivo nuevo con el lector anterior (RNF-7).

---

## 5. Marco de lienzo compartido **[RF-1 a RF-3, RF-12, RF-13, CL-1, CL-2, CL-9, CL-10, CL-11]**

### 5.1 `CanvasFrame`
Responsabilidades, iguales para diagrama y mapa:
- Ancho de la columna (100 % del contenedor del bloque, igual que los demás bloques) y **alto ajustable**: una asa en el borde inferior que se arrastra con ratón, dedo o teclado (flechas), con vista previa y **un solo paso de historial** al soltar; el alto se acota entre mínimo y máximo (`clampHeight`, núcleo).
- Barra de **zoom** propia (ya existe `CanvasControls`): acercar, alejar, restablecer al 100 %, ajustar a la vista, con porcentaje. Se añade «restablecer al 100 %» y «ampliar». El mapa recibe la misma barra.
- Interruptores de **cuadrícula** (mostrar/ocultar y acomodar/libre).
- **Slot** del menú emergente y del botón «Ampliar».

### 5.2 Vista ampliada **[RF-3, DP-2]**
- «Ampliar» pone el marco en `fixed` cubriendo la ventana con fondo opaco, `role="dialog"` y `aria-modal`, foco atrapado y retorno del foco al botón de origen.
- Barra superior de la vista ampliada: **Salir**, deshacer, rehacer y los controles de zoom/encuadre.
- **Esc** actúa en capas: primero cierra un menú o cuadro abierto, luego sale de la vista (RF-3).
- Selección, zoom, posición del lienzo y texto a medio escribir **se conservan** porque el componente no se remonta (CL-9). Al salir, el bloque vuelve a su alto guardado y la página queda en el mismo punto de desplazamiento.
- Mientras esté abierta, se bloquea el desplazamiento de la página y se oculta el resto de la interfaz a los lectores de pantalla (`inert`).

### 5.3 `FloatingMenu` **[RF-1, RF-2, DP-3]**
- Anclas: **elemento DOM** (globo, forma) o **punto virtual** (conector: punto medio del trazado o el punto seleccionado, convertido con las funciones de coordenadas del lienzo, y actualizado al arrastrar, hacer zoom o desplazar).
- Posición preferida: encima del elemento; si no cabe, debajo o a un lado (colisión de Radix); siempre completo (CL-1). Con un offset que **no tapa** el elemento (RNF-4); alto máximo 40 % del alto visible con desplazamiento interno.
- Se cierra con Esc, clic en vacío o al seleccionar otro elemento, que **cambia** el menú al nuevo (CL-2). No roba el foco cuando el globo está en edición (sección 9.4).
- Contenido en **grupos con etiqueta e ícono** (RF-2): *Apariencia* (relleno, contorno, texto, forma), *Estructura* (conexión, trazado, puntas / agregar hijo, hermano, colapsar), *Acciones* (copiar formato, pegar formato, eliminar). Mismo orden por tipo de elemento. Rol `menu`/`toolbar` con nombres accesibles y recorrido con flechas.
- Los controles actuales (`ShapeStylePanel`, `EdgeStylePanel`, `RouteControls`, `EdgeEnds`) **se reutilizan dentro del menú**; solo cambia su contenedor.
- Sin selección: solo los controles generales compactos (insertar forma, zoom, ampliar, deshacer, rehacer) en una barra delgada **sobre** el lienzo, no debajo. La franja inferior se elimina.

### 5.4 Cambios de tamaño de ventana **[CL-11]**
El marco observa su ancho (`ResizeObserver`); el lienzo se reencuadra **solo si** el usuario no ha movido la vista, para no desorientar.

---

## 6. Puntero y enfoque **[RF-4, RF-5, CL-14, RNF-3]**

### 6.1 Puntero
- **Una sola regla global** en tokens: elementos con rol de botón, enlace, pestaña, opción, ítem de menú, casilla, interruptor, control deslizante y selector de color → `pointer`; deshabilitado (`:disabled`, `[aria-disabled="true"]`) → `not-allowed`.
- Se añade una clase de utilidad para elementos clicables que no son controles nativos (formas, globos, asas): `pointer` en reposo, `grab`/`grabbing` al arrastrar, `move`, y cursores de redimensión (`ns-resize`, `nwse-resize`, etc.) en las asas.
- Los estilos en línea que hoy fijan un cursor (el globo del mapa usa `grab`) se **retiran** a favor de la clase.
- **Prueba de contrato:** una prueba recorre los componentes de la app y falla si un `button`/`role=button` renderizado no resuelve a `pointer` (lectura del estilo calculado, en navegador real).

### 6.2 Foco
- El detector `useInputModality` fija `data-input="pointer"` ante un `pointerdown` y `data-input="keyboard"` ante un `keydown` de navegación (Tab, flechas, Enter, Esc).
- La regla de foco pasa a: anillo doble **solo** cuando `data-input="keyboard"`; con `pointer` se quita el anillo azul y la sombra de separación. Los campos de texto con foco de ratón muestran un **borde de control reforzado** neutro (no azul) para que se note dónde se escribe.
- En contraste forzado se mantiene el anillo del sistema.
- Se identifican y neutralizan **las fuentes** del azul al hacer clic en un bloque: la regla `:focus-visible` global, el borde de selección del nodo (sección DP-14) y el contorno de selección que pone el editor de bloques al seleccionar un bloque «atómico». El Hito 0 las enumera midiendo el color de contorno calculado al hacer clic, para no dejar ninguna.
- **Selección discreta [DP-14]:** halo neutro y borde más grueso en ambos temas; contraste 3:1 contra el fondo (criterio de componentes de interfaz).

---

## 7. Cuadrícula **[RF-18, CL-15 a CL-17]**

### 7.1 Núcleo (funciones puras)
- `GRID = 20`.
- `snap(valor)`, `snapPoint(punto)`: al múltiplo más cercano.
- `snapBox(caja, mínimo)`: acomoda esquina superior izquierda y **bordes** (RF-18), respetando el tamaño mínimo de la forma (CL-16): si el mínimo no es múltiplo, se sube al siguiente múltiplo.
- `snapOffset(posiciónEfectivaDeseada, posiciónAutomáticaMásDesplazamientoDeAncestros)`: devuelve el `off` que deja el globo exactamente en un punto de la cuadrícula (mapa).

### 7.2 Diagrama
- `ReactFlow` recibe `snapToGrid` y `snapGrid` según la preferencia; mientras se mantiene **Alt**, el acomodo se suspende (movimiento libre).
- Al **redimensionar**, `onResize` aplica `snapBox` para mostrar el acomodo durante el gesto y no solo al soltar.
- **Formas nuevas** (insertadas por botón o pegadas) se colocan con `snapPoint`.
- **Puntos de quiebre** y extremos libres de conectores se acomodan con `snapPoint` al arrastrarlos y al crearlos con doble clic.
- Las posiciones guardadas de diagramas existentes **no se tocan** al abrir (CL-15).

### 7.3 Mapa mental
- El mismo `ReactFlow` y la misma cuadrícula (dibujada por `<Background>` con el mismo paso) (D-16).
- Al soltar un globo, se calcula `off` con `snapOffset` sobre el globo arrastrado; **los descendientes no se acomodan** y conservan su distancia relativa (CL-17) porque heredan el `off` del padre.
- Globo nuevo: se coloca en su lugar de la distribución automática y, si hay colisión o el padre está fuera de cuadrícula, se calcula un `off` que lo deje en un punto libre de la cuadrícula (sección 9.5).

### 7.4 Preferencia
- Dos banderas (`mostrar`, `acomodar`) en almacenamiento local con valor inicial «sí/sí», leídas con tolerancia a fallo (sin almacenamiento, funciona con los valores iniciales). Compartidas por diagrama y mapa, y por la vista ampliada.

---

## 8. Conectores **[RF-6 a RF-8, CL-3 a CL-5]**

### 8.1 Operaciones puras del núcleo
- `nearestOnPath(camino, punto)`: proyección del clic sobre el trazado → `{distancia, parámetro, segmento}`; sirve para saber **sobre qué tramo** se hizo doble clic.
- `addBendAt(diagrama, idConector, punto)`: inserta un punto en la posición **correcta de la lista** (según el segmento más cercano) en `waypoints` (90°) o `points` (curvo y libre); el punto se acomoda a la cuadrícula si está activa y **no se coloca encima de los extremos** (se separa un mínimo del anclaje, CL-4).
- `removeBend(diagrama, idConector, índice)`: quita ese punto; si no quedan puntos, el conector vuelve al trazado directo de su tipo (RF-6, CL-3).
- Ambas devuelven el diagrama nuevo (o error) y se prueban sin React.

### 8.2 Interfaz
- **Doble clic en un punto** → `removeBend`. **Doble clic en un tramo** → `addBendAt`. Un punto seleccionado muestra un menú emergente con «Eliminar punto» (RF-6).
- Arrastrar un punto mueve con vista previa y **un paso de historial** al soltar (RF-7); sin tope de puntos más que el de rendimiento (RNF-1).
- El doble clic sobre un punto debe ganar al doble clic del lienzo; el área sensible del punto usa el tamaño táctil de la spec 003 (32/44 px).
- En el trazado de 90°, los puntos de paso son los editables; los **quiebres automáticos** del algoritmo no se «eliminan» (se vuelven a calcular). Para obtener menos esquinas se quitan puntos de paso o se usa «Restablecer ruta» (ya existe). Esto queda en supuestos (sección 16).

### 8.3 Curva continua **[RF-8, DP-11]**
Pseudocódigo:
```
puntos = [inicio, ...points, fin]
tangenteInicio = dirección de salida del anclaje de inicio
tangenteFin    = dirección de llegada del anclaje de fin
si puntos.length == 2:
    curva = Bézier cúbica con controles a (distancia*curvatura) a lo largo de cada tangente   # sin tramos rectos
sino:
    para cada par consecutivo: calcular controles con Catmull-Rom centrípeta;
    en los extremos usar la tangente del anclaje en lugar de la de la spline
asegurar continuidad C1 en cada punto (sin esquinas) y sin bucles
```
- Los puntos casi alineados o muy cercanos se **regularizan** (distancia mínima entre puntos) para evitar picos y bucles (CL-5).
- `pathToSvg` del núcleo emite la misma curva para el lienzo y para la exportación (RF-8, tercera viñeta). Las puntas se orientan según la tangente final de la curva (`capShape` ya recibe la dirección).
- Los conectores curvos anteriores (con `curvature`) **no cambian de aspecto**: su curva ya carece de tramos rectos.
- El trazado libre con segmentos rectos (`smooth` apagado) se conserva (spec 004, RF-8 última viñeta).

---

## 9. Mapa mental **[RF-9 a RF-14, CL-6 a CL-10, CL-13]**

### 9.1 Lienzo y nodos
- `MindMapEditor` dentro de `CanvasFrame`; cada globo es un nodo de `ReactFlow` con un tipo propio (`MindNode`) y se posiciona con la **posición efectiva** (sección 9.2). Las líneas al padre se dibujan en una capa SVG propia en el espacio del lienzo (`ViewportPortal`, como en el diagrama), con el color `line` del hijo.
- Visibilidad: los globos colapsados ocultan sus descendientes (sin cambios respecto de hoy). `onlyRenderVisibleElements` para RNF-1.
- El texto largo hace crecer el globo hasta un ancho máximo y luego se ajusta en líneas (CL-13); la distribución automática usa el tamaño real medido para no solapar.

### 9.2 Posición efectiva y distribución **[DP-5, RF-11]**
```
efectiva(g) = automática(g) + suma de off(h) para h en [ancestros de g, g]
```
- `automática` sigue siendo `layoutTree` (mapa mental: ramas a izquierda y derecha).
- **Arrastrar** (`onNodeDrag`): en vista previa, el nodo y **toda su rama** se desplazan el mismo delta; al soltar (`onNodeDragStop`) se calcula el `off` del globo con `snapOffset` (si el acomodo está activo) y se confirma **un solo paso de historial**.
- **Raíz:** su `off` mueve todo el mapa (CL-7); sus hijos no cambian.
- **Colapsar** un globo movido: sus hijos se ocultan y reaparecen en su sitio porque conservan sus `off` (CL-8).
- **Reordenar automáticamente** (RF-11): borra todos los `off` del árbol en **un** paso de historial.
- **Superposición** (CL-6): se permite; «Reordenar» la deshace.

### 9.3 Color **[RF-9, RF-10, DP-6]**
- El menú del globo reutiliza `ColorPicker` (paleta del sistema, personalizado, recientes) para `fill`, `stroke`, `text` y `line`, y el **aviso de contraste** existente entre relleno y texto (no bloquea).
- **Aplicar a la rama**: operación pura `applyStyleToBranch(árbol, id, estilo)` que copia el `style` del globo a todos sus descendientes **actuales** (RF-10); los hijos creados después nacen **sin estilo propio** (apariencia por defecto), salvo que se vuelva a aplicar. Un solo paso de historial.
- La exportación a SVG y a HTML dibuja los colores con la misma resolución de paleta que el diagrama (sección 11).

### 9.4 Un clic en el globo **[RF-14, D-11]**
- Pulsación sin movimiento (< 5 px) → **selecciona**, abre el `FloatingMenu` y pone el texto en **edición** (campo de texto sobre el globo con el cursor listo). Un arrastre (> 5 px) mueve el globo y **no** abre el campo (distingue clic de arrastre y evita que el campo de texto robe el gesto de arrastre).
- El menú no roba el foco del campo (no se enfoca automáticamente); `Esc` cierra el menú sin perder el texto; el texto se confirma al salir del campo (desenfoque, Enter o clic fuera), como un solo paso de historial por edición.
- Menú: agregar hijo, agregar hermano (no en la raíz), colapsar o expandir (solo con hijos), eliminar (no en la raíz) y color. «Eliminar» con hijos **avisa cuántos globos se eliminan** en un aviso en línea con «Deshacer».
- Texto vacío al salir: el globo se conserva y muestra un texto de relleno atenuado (RF-14 última viñeta).
- Se retiran por completo el campo «Texto hijo» y la franja inferior.

### 9.5 Globo nuevo sin superposición **[RF-11]**
```
candidata = automática(nuevo) + off de los ancestros
mientras candidata choca con otro globo visible:
    mover candidata hacia abajo una celda de cuadrícula   (acotado a N intentos)
off(nuevo) = candidata - automática(nuevo) - off de ancestros   # solo si hizo falta moverlo
```

### 9.6 Controles de vista **[RF-13]**
Barra de zoom del marco (acercar, alejar, 100 %, ajustar a la vista, ampliar) con porcentaje; arrastrar el fondo desplaza; Ctrl + rueda o pellizco hace zoom centrado en el puntero (comportamiento nativo de xyflow, configurado). El zoom y la posición se recuerdan **solo mientras la página está abierta**; al reabrir se encuadra el mapa completo (CL-10: si no cabe al zoom mínimo, se avisa).

---

## 10. Historial, teclado y táctil **[RF-15, RF-17, RNF-3]**

### 10.1 Historial **[DP-12]**
- Utilidad genérica `Snapshots<T>` (límite 100). `DiagramHistory` pasa a apoyarse en ella sin cambiar su interfaz pública; el mapa mental la usa por primera vez.
- Un gesto continuo (arrastre, redimensionar alto, mover varios puntos) = **un paso**. «Reordenar», «Aplicar a la rama» y eliminar rama = un paso cada uno. Editar texto = un paso por edición confirmada.
- Deshacer y rehacer: botones de la barra y de la vista ampliada, y atajos dentro del lienzo (sin chocar con el deshacer del editor de bloques: se capturan solo con el foco en el lienzo).

### 10.2 Teclado **[RF-17]**
- Tab recorre globos/formas; **Enter** abre el menú (y la edición en un globo); **Esc** cierra por capas; **flechas** mueven el elemento seleccionado una celda (Shift = 5 celdas; con acomodo apagado, 1 px/10 px); **Supr/Retroceso** elimina; **Ctrl+C / Ctrl+V** reutilizan el portapapeles interno; **+ / − / 0** zoom; **F** ajustar a la vista; **Ctrl+Mayús+F** ampliar.
- Los menús y selectores son navegables con teclado y se anuncian con nombre, rol y estado; el cambio de selección y los avisos de eliminación van en una región `status`.

### 10.3 Táctil **[RF-17, CL-12 de la spec 003]**
Un toque equivale a un clic; los objetivos del menú, asas y puntos miden ≥ 44 px con puntero grueso; el menú reubica para no quedar bajo el dedo; el pellizco hace zoom y el arrastre con un dedo sobre el fondo desplaza.

---

## 11. Respaldo, restauración, exportación y búsqueda **[RF-16, RNF-7]**
- **Respaldo y restauración:** los campos nuevos viajan en el JSON del propio bloque (ya respaldado); **no cambia la versión ni la estructura del formato** (`docs/backup-format.md` solo documenta los campos aditivos). Salida determinista: el serializador ordena las claves y no emite campos vacíos, así un mapa sin editar produce **exactamente los mismos bytes** que antes (prueba con la golden anterior).
- **Exportación (SVG/HTML/PDF):** el mapa exportado aplica `off` y colores con una sola función del núcleo (`resolveTreeLayout`) compartida con la interfaz; la curva del conector se emite con el mismo `pathToSvg`.
- **Markdown y búsqueda:** el texto del mapa sigue extrayéndose igual (`treeText`); colores, posiciones y alto no entran al texto.
- El organigrama, que comparte el modelo, **ignora** `off`/`style` y se exporta como antes.

---

## 12. Estructura de módulos (sin código)

### 12.1 Núcleo `packages/core/src/diagrams/` (TypeScript puro)
| Módulo | Contenido |
|---|---|
| `grid.ts` | `GRID`, `snap`, `snapPoint`, `snapBox`, `snapOffset` |
| `view.ts` | alto por defecto, `clampHeight`, `readView`/`writeView` |
| `bends.ts` | `nearestOnPath`, `addBendAt`, `removeBend` |
| `routing/curved.ts` (modificado) | curva continua (Catmull-Rom centrípeta + tangentes de anclaje) |
| `tree.ts` (modificado) | tipos con `off`, `style`, `view`; lectura tolerante; serialización sin campos vacíos |
| `treeView.ts` | `resolveTreeLayout` (posición efectiva), `moveBranch`, `reflowAuto`, `placeNewNode`, `applyStyleToBranch`, `setNodeStyle` |
| `history.ts` | `Snapshots<T>` genérico (`DiagramHistory` se apoya en él) |

### 12.2 Interfaz
| Módulo | Contenido |
|---|---|
| `packages/ui/src/canvas/CanvasFrame.tsx` | marco, alto ajustable, ampliar, zoom, cuadrícula |
| `packages/ui/src/canvas/FloatingMenu.tsx` | menú anclado (elemento y punto virtual) |
| `packages/ui/src/canvas/gridPrefs.ts` | preferencias de cuadrícula (dispositivo) |
| `packages/ui/src/design/inputModality.ts` + `tokens.css` | detector de modalidad, reglas de puntero y de foco, halo de selección |
| `packages/ui/src/diagram/MindMapEditor.tsx`, `MindNode.tsx`, `MindMenu.tsx` | el mapa mental nuevo |
| `packages/ui/src/diagram/DiagramEditor.tsx` (modificado) | usa `CanvasFrame`, `FloatingMenu`, `snapToGrid`, puntos de quiebre; sin franja inferior |
| `packages/ui/src/editor/schema.tsx` (modificado) | el bloque `mindmap` usa `MindMapEditor`; `orgchart` sigue con `TreeEditor` |
| i18n es-MX/en | textos nuevos |

### 12.3 Adaptadores
Sin cambios: nada de plataforma interviene.

---

## 13. Hitos de entrega **[art. 2]**

| Hito | Objetivo | Se cierra cuando |
|---|---|---|
| **0 — Verificaciones** | Comprobar con código desechable en `spikes/` los cuatro riesgos de la sección 17 y medir el punto de partida. | Resultados en `spikes/RESULTS-pulido.md`; decisiones de DP-2, DP-3 y DP-4 confirmadas o corregidas en este plan. |
| **1 — Base común** | Puntero y foco globales; cuadrícula en el núcleo; `FloatingMenu`; `CanvasFrame` (alto, ampliar, zoom, cuadrícula); el **diagrama** pasa al marco, a menús emergentes y a acomodo. | Criterios 1 a 4, 11 y 12 (parte diagrama) de la spec con pruebas. |
| **2 — Conectores** | Agregar/quitar puntos de quiebre y curva continua, con exportación idéntica. | Criterios 5 y 6. |
| **3 — Mapa mental** | Modelo ampliado, historial, `MindMapEditor`: clic único, color y rama, mover con rama, controles de vista, alto y cuadrícula. | Criterios 7 a 11 y 12. |
| **4 — Cierre** | Respaldo/export/búsqueda, accesibilidad, rendimiento, casos límite, documentación (`docs/manual`, formato de respaldo) y matriz de aceptación. | Criterio 13 y todos los CL con prueba. |

### 13.1 Verificaciones previas del Hito 0 (código desechable)
1. **Vista ampliada con `fixed`** dentro del editor de bloques: ¿hay un ancestro con `transform`/`overflow` que lo rompa? ¿El lienzo se reencuadra bien al cambiar de tamaño? (decide DP-2).
2. **Fuentes del contorno azul:** medir el color de contorno calculado al hacer clic en diagrama, mapa y bloques para listar **todas** las reglas que lo producen (sección 6.2).
3. **Mapa sobre xyflow con 200 globos:** fluidez al arrastrar una rama completa; si el peor fotograma supera 100 ms, se evalúa mover la rama sin pasar por el estado de React durante el gesto.
4. **Popover anclado a un punto virtual** que sigue el desplazamiento y el zoom del lienzo sin parpadeo, y **clic frente a arrastre** sobre un nodo con campo de texto (DP-4, sección 9.4).

---

## 14. Estrategia de pruebas **[art. 4, RNF-1 a RNF-8]**

**Siempre primero la prueba** (como en la spec 003).

### 14.1 Unitarias del núcleo (Vitest)
- `grid`: `snap` en límites (negativos, medias), `snapBox` con tamaño mínimo mayor que la celda (CL-16), `snapOffset` deja al globo exactamente en la cuadrícula.
- `bends`: `nearestOnPath` en los tres trazados; `addBendAt` inserta en el índice correcto y respeta la distancia mínima a los anclajes (CL-4); `removeBend` del único punto devuelve el trazado directo (CL-3).
- `curved`: continuidad en cada punto (sin esquinas: tangente entrante = saliente), sin tramos rectos, sin bucles con puntos casi alineados o muy cercanos (CL-5), tangentes de extremo según anclaje; la salida SVG del núcleo es idéntica a la del lienzo.
- `tree`/`treeView`: lectura tolerante (campos inválidos descartados), serialización sin campos vacíos y **byte a byte igual** para un árbol sin editar (golden anterior); posición efectiva con herencia de ancestros; mover raíz (CL-7); colapsar globo movido (CL-8); `applyStyleToBranch` solo toca descendientes actuales y un hijo nuevo nace sin estilo; `placeNewNode` evita colisión; `reflowAuto` borra todos los `off`.
- `view`: `clampHeight` en mínimo y máximo.
- `history`: genérico con límite 100; `DiagramHistory` mantiene su suite sin cambios.
- Compatibilidad: leer con el lector anterior un árbol nuevo (RNF-7).

### 14.2 Interfaz (Vitest + Testing Library)
- `FloatingMenu`: reubicación en bordes (CL-1), cambio de menú al cambiar la selección (CL-2), Esc por capas, navegación por teclado, nombres accesibles.
- `CanvasFrame`: alto ajustable con teclado, `clampHeight`, ampliar/salir conservando selección y texto (CL-9), foco atrapado y devuelto.
- Contrato de **puntero**: todo `button`/`role=button`/ítem de menú resuelve a `pointer`; deshabilitados a `not-allowed` (RF-4).
- Contrato de **foco**: con `data-input="pointer"` no hay anillo; con `keyboard` sí, en claro y oscuro (RF-5).
- `MindMapEditor`: un clic selecciona, abre el menú y deja escribir; arrastre no abre el campo; texto vacío; eliminar con hijos avisa el conteo y se deshace; «Aplicar a la rama»; «Reordenar».
- Diagrama: doble clic en punto lo elimina y en tramo agrega; `snapToGrid` activo/inactivo y Alt libre; la franja inferior no existe.

### 14.3 De extremo a extremo (navegador real, pruebas e2e del proyecto)
- Diagrama: insertar, seleccionar → aparece el menú junto al elemento; ampliar y salir; acomodo a cuadrícula al mover y al redimensionar; doble clic para agregar/quitar quiebres; curva continua.
- Mapa: clic en globo escribe y abre menú; arrastrar globo con su rama y volver a abrir la página (posición persistida); color de rama; zoom/100 %/ajustar; alto ajustable persistido; mismo ancho que otros bloques en tres anchos de ventana (CL-11).
- Puntero (`getComputedStyle` en botones reales) y foco (sin anillo azul con clic, anillo con Tab).
- Privacidad: ninguna petición de red a destinos externos durante todo el flujo (RNF-5).
- Rendimiento: 200 globos y 200 formas, arrastre con peor fotograma ≤ 100 ms (RNF-1).

### 14.4 Verificación manual (lista firmada)
Táctil en dispositivo real (objetivos de 44 px, menú que no queda bajo el dedo), recorrido completo por teclado y con lector de pantalla, y demostración de los criterios de finalización 1 a 13, en `docs/acceptance-pulido.md`.

### 14.5 Auditoría automática
Auditoría de accesibilidad (axe, ya en el proyecto) sobre diagrama, mapa, menús y vista ampliada, en ambos temas.

---

## 15. Matriz de trazabilidad

| Requisito | Dónde se cubre | Prueba principal |
|---|---|---|
| RF-1, RF-2 | §5.3 | 14.2 `FloatingMenu`; 14.3 diagrama y mapa |
| RF-3 | §5.2 | 14.2 `CanvasFrame`; 14.3 ampliar |
| RF-4 | §6.1 | contrato de puntero; 14.3 |
| RF-5 | §6.2, DP-14 | contrato de foco; 14.3 |
| RF-6, RF-7 | §8.1, §8.2 | 14.1 `bends`; 14.2/14.3 diagrama |
| RF-8 | §8.3, DP-11 | 14.1 `curved`; exportación idéntica |
| RF-9, RF-10 | §9.3, DP-6 | 14.1 `treeView`; 14.2 mapa |
| RF-11 | §9.2, §9.5, DP-5 | 14.1 `treeView`; 14.3 persistencia |
| RF-12 | §5.1, DP-7 | 14.1 `view`; 14.3 ancho y alto |
| RF-13 | §9.6 | 14.2/14.3 mapa |
| RF-14 | §9.4 | 14.2 mapa |
| RF-15 | §10.1, DP-12 | 14.1 `history`; 14.2 |
| RF-16 | §4.4, §11 | 14.1 compatibilidad y golden |
| RF-17 | §10.2, §10.3 | 14.2 teclado; manual táctil |
| RF-18 | §7, DP-8, DP-9 | 14.1 `grid`; 14.2/14.3 acomodo |
| RNF-1 | §9.1, §13.1 (3) | 14.3 rendimiento |
| RNF-2 | §3 | revisión de dependencias |
| RNF-3 | §5.3, §6.2, §10 | 14.2 + 14.5 axe + manual |
| RNF-4 | §5.3 | 14.2 `FloatingMenu` (alto máximo y no tapa) |
| RNF-5 | §1.2 (art. 5 y 6) | 14.3 privacidad |
| RNF-6 | i18n | prueba de paridad es/en (ya existe) |
| RNF-7 | §4.4, §11 | 14.1 compatibilidad |
| RNF-8 | DP-1, §5 | 14.2 pruebas compartidas del marco |
| CL-1, CL-2 | §5.3 | 14.2 `FloatingMenu` |
| CL-3, CL-4, CL-5 | §8 | 14.1 `bends`, `curved` |
| CL-6, CL-7, CL-8 | §9.2 | 14.1 `treeView` |
| CL-9 | §5.2, DP-2 | 14.2 `CanvasFrame` |
| CL-10 | §9.6 | 14.2 mapa |
| CL-11 | §5.4 | 14.3 anchos |
| CL-12 | §4.4 | 14.1 compatibilidad |
| CL-13 | §9.1 | 14.2 mapa (texto largo) |
| CL-14 | §6.2, §10.2 | 14.2 foco por teclado |
| CL-15, CL-16, CL-17 | §7 | 14.1 `grid` y `treeView` |

---

## 16. Supuestos de valores (ajustables en la revisión)
- El **organigrama no se modifica** (menús, color, mover y zoom no aplican): la spec habla de mapa mental y diagrama. Si se quiere igualar, se añade como hito aparte. El puntero y el foco sí le llegan por ser globales.
- Cuadrícula de **20 px**, la misma que ya dibuja el diagrama (D-16).
- Alto mínimo **240 px**, máximo **1600 px**; diagrama por defecto **420 px**; mapa por defecto entre **320 y 560 px**.
- En el trazado de 90° los **quiebres automáticos** no son eliminables; se quitan los puntos de paso o se restablece la ruta (sección 8.2).
- Distancia mínima entre puntos de curva y a los anclajes: **12 px** (se confirma en pruebas).
- Preferencia de cuadrícula por **dispositivo**, no por espacio de trabajo.
- Atajo de ampliar **Ctrl+Mayús+F**, sin chocar con los del editor de bloques (se verifica en el Hito 1).

---

## 17. Riesgos y mitigaciones
| Riesgo | Mitigación |
|---|---|
| La vista ampliada con `fixed` falla por un ancestro con `transform` o por el editor de bloques | Hito 0 (1); alternativa: portal con estado elevado (DP-2) |
| Quedan fuentes de contorno azul sin identificar (p. ej. selección del editor de bloques) | Hito 0 (2) enumera todas; prueba e2e mide el color de contorno tras clic |
| Mover una rama de 200 globos en el estado de React cae por debajo del presupuesto | Hito 0 (3); mover por vista previa fuera del estado hasta soltar |
| Un clic con campo de texto se confunde con un arrastre | Umbral de 5 px y campo que se activa solo tras el clic (sección 9.4); prueba dedicada |
| La spline produce bucles o picos con puntos cercanos | Regularización de puntos y pruebas de CL-5 con casos patológicos |
| Un dato nuevo abre mal en una versión anterior | Prueba de lectura con el lector anterior (RNF-7); campos aditivos y opcionales |
| Los atajos de teclado chocan con los del editor de bloques | Capturar solo con el foco dentro del lienzo; pruebas de foco |

---

## 18. Decisiones sobre los pendientes de la spec
| ID | Resolución |
|---|---|
| P-2 (dónde se guardan posiciones, colores y alto sin cambiar el respaldo) | **Resuelto:** dentro del JSON del propio bloque como campos aditivos opcionales (`off`, `style`, `view`); el formato de respaldo no cambia (§4, §11). |
