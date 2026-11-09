# Especificación 003 — Diagramas de flujo: conexión precisa, trazados y color

> **Estado:** cerrada (8 de noviembre de 2026; Hitos 0 a 3 implementados); las verificaciones manuales firmadas quedan diferidas · **Tercera parte de v-note** (la primera es `specs/001-v-note-mvp`, la segunda `specs/002-v-note-ui`).
> **Alcance de este documento:** el QUÉ y el POR QUÉ. No define tecnología, arquitectura ni archivos: eso va en el plan.
> **Relación con otras specs:** amplía y, donde se indica, **sustituye** el RF-9 de la spec 001 (diagramas de flujo). Los organizadores gráficos (RF-10) no se tocan.
> **Notación:** los criterios usan EARS en español (*Cuando… el sistema deberá…*, *Mientras…*, *Si… entonces…*, *Donde…*). Las dudas se marcan con **[NECESITA ACLARACIÓN]**.

---

## 1. Contexto y objetivo

### Contexto
Los diagramas de flujo de v-note ya permiten insertar formas, conectarlas, editar su texto, moverlas, cambiarles un color y navegar el lienzo con zoom. En el uso real aparecen cuatro problemas:

1. Los conectores se unen **donde el sistema decide** (hoy, el centro de cada forma) y no donde la persona los deja.
2. Los controles indispensables —acercar y alejar, símbolos, conectores y asas— **no se distinguen bien** sobre el lienzo.
3. Los conectores solo pueden ser una línea directa: no hay trazados redondeados, de ángulos rectos ni libres.
4. Cada forma tiene **un único color**; no se puede elegir por separado el contorno, el relleno ni el texto, ni dar estilo a los conectores.

### Objetivo
Que la persona pueda dibujar diagramas de flujo **con control total sobre dónde se conecta cada línea, cómo se traza y cómo se ve cada elemento**, con controles siempre legibles y sin perder ni alterar los diagramas que ya tiene.

### Por qué
- Un diagrama sirve para explicar; si las líneas se cruzan o se pegan donde no se quiere, el mensaje se pierde y la persona rehace el trabajo a mano.
- Color y trazado son el lenguaje visual de un diagrama (ramas «sí/no», flujos principales y alternos, estados): sin ellos, los diagramas complejos no se leen.
- Los controles ilegibles frenan el uso diario, sobre todo en tema oscuro y en pantallas táctiles.

### Decisiones ya tomadas (con la persona responsable del producto)
| ID | Decisión |
|---|---|
| D-1 | La unión de un conector se elige con **puntos de anclaje fijos** por forma, con efecto imán al acercarse; no se suelta en cualquier punto del contorno. |
| D-2 | Cada forma tiene **8 puntos de anclaje**. |
| D-3 | Al mover o redimensionar una forma, cada conector **sigue al mismo anclaje**; nunca cambia de punto por sí solo. |
| D-4 | Un conector puede tener **uno o ambos extremos libres** (sin forma). |
| D-5 | Trazados disponibles: **recto directo**, **ángulos de 90°**, **redondeado** y **libre con puntos de control**. |
| D-6 | En el trazado de 90° la ruta es **automática, con tramos ajustables** por la persona. |
| D-7 | Estilo de conector: color, grosor, tipo de línea y puntas de flecha por extremo. |
| D-8 | Estilo de forma: relleno, contorno, texto y opacidad del relleno. |
| D-9 | Los colores se eligen de la **paleta del sistema** o con un **color personalizado**; los personalizados son **fijos** en ambos temas y los de la paleta se adaptan al tema. |
| D-10 | Controles del lienzo con **contraste AA y tamaño táctil mínimo**. |
| D-11 | Los diagramas existentes **se abren sin cambiar de aspecto**. |
| D-12 | Los 8 anclajes son los 4 centros de lado y las 4 esquinas (proyectadas al contorno real). |
| D-13 | El trazado libre puede verse como segmentos rectos o suavizado, a elección por conector. |
| D-14 | Se puede guardar el estilo de una forma y de un conector como predeterminado, por tipo. |
| D-15 | Entran en esta spec copiar y pegar formas y estilos; alinear, distribuir y agrupar quedan para una spec posterior. |
| D-16 | El estilo predeterminado es **por espacio de trabajo**. |
| D-17 | El portapapeles de formas y estilos funciona **solo dentro de v-note** (entre diagramas y espacios), sin usar el portapapeles del sistema. |

---

## 2. Usuarios

- **Persona usuaria única** de v-note, en escritorio (Linux, Windows, macOS) y en la web instalable (PWA), con ratón, teclado o pantalla táctil.
- Incluye a quien usa **tema claro u oscuro**, **zoom del sistema** o **reducción de movimiento**, y a quien depende del teclado.

---

## 3. Historias de usuario

| ID | Historia | Prioridad |
|---|---|---|
| HU-1 | Como persona usuaria quiero **elegir en qué punto de una forma se une cada conector** para que las líneas queden donde yo las pienso. | Alta |
| HU-2 | Como persona usuaria quiero que los conectores **sigan al mismo punto** cuando muevo o cambio de tamaño una forma, para no rehacer el diagrama. | Alta |
| HU-3 | Como persona usuaria quiero **ver bien** los botones de zoom y todos los símbolos, conectores y asas, en claro y oscuro, para trabajar sin esforzarme. | Alta |
| HU-4 | Como persona usuaria quiero elegir entre conectores **rectos, de 90°, redondeados o libres** para adaptar el diagrama a cada caso. | Alta |
| HU-5 | Como persona usuaria quiero **colorear por separado** relleno, contorno y texto de cada forma, y el estilo de cada conector, para dar significado visual. | Alta |
| HU-6 | Como persona usuaria quiero **dejar un extremo de conector libre** para anotar flujos que aún no tienen destino o que salen del diagrama. | Media |
| HU-7 | Como persona usuaria quiero que mis **diagramas existentes se vean igual** al actualizar. | Alta |
| HU-8 | Como persona usuaria quiero poder **deshacer y rehacer** cualquiera de estas acciones nuevas. | Alta |
| HU-9 | Como persona usuaria quiero **guardar un estilo como predeterminado** para que mis nuevas formas y conectores nazcan con mi aspecto. | Media |
| HU-10 | Como persona usuaria quiero **copiar y pegar formas y estilos**, dentro del mismo diagrama o a otro, para no repetir trabajo. | Media |

---

## 4. Requisitos funcionales

### 4.1 Puntos de anclaje y conexión

**RF-1 — Anclajes por forma.**
- El sistema deberá dotar a cada forma de ocho puntos de anclaje sobre su contorno: los cuatro centros de lado y las cuatro esquinas.
- En las formas no rectangulares (inicio/fin, decisión, entrada/salida), el sistema deberá proyectar las esquinas sobre el contorno real de la forma, no sobre su caja envolvente (p. ej. sobre el borde diagonal del rombo).
- Mientras la persona arrastre un extremo de conector cerca de una forma, el sistema deberá mostrar sus anclajes y resaltar el más cercano.

**RF-2 — Unir un conector a un anclaje.**
- Cuando la persona suelte un extremo de conector sobre un anclaje, o a distancia de imán de uno, el sistema deberá unirlo exactamente a ese anclaje.
- Cuando se cree un conector arrastrando desde un anclaje, el sistema deberá usar ese anclaje como origen.
- El sistema deberá permitir que varios conectores compartan un mismo anclaje.
- Cuando la persona arrastre un extremo ya unido hacia otro anclaje, el sistema deberá reubicarlo, de la misma forma o de otra forma.

**RF-3 — Seguimiento.**
- Cuando se mueva una forma, el sistema deberá mantener cada conector unido al mismo anclaje y recalcular el trazado.
- Cuando se redimensione una forma, el sistema deberá mantener cada conector unido al mismo anclaje, que se desplaza con el contorno.
- El sistema no deberá cambiar por sí solo el anclaje de ningún conector.

**RF-4 — Extremos libres.**
- Cuando la persona suelte un extremo de conector en un lugar sin forma, el sistema deberá dejarlo como extremo libre en esa posición del lienzo.
- Cuando se arrastre un extremo libre sobre un anclaje, el sistema deberá unirlo; y viceversa, al despegar un extremo de un anclaje deberá quedar libre.
- El sistema deberá permitir conectores con ambos extremos libres.
- Cuando se elimine una forma con conectores unidos, el sistema deberá conservar esos conectores con el extremo correspondiente libre, en la última posición del anclaje, e informarlo a la persona. *(Sustituye la regla de RF-9 de la spec 001, que eliminaba o dejaba sin extremo esos conectores.)*

**RF-5 — Reglas de validez.**
- El sistema deberá permitir un conector cuyos dos extremos estén unidos a la misma forma en anclajes distintos.
- Si los dos extremos coinciden en el mismo punto y ninguno está libre, entonces el sistema deberá rechazar la unión e informar el motivo.

### 4.2 Trazado de conectores

**RF-6 — Tipos de trazado.**
- El sistema deberá ofrecer cuatro trazados para cada conector: **recto directo**, **ángulos de 90°**, **redondeado** y **libre**.
- Cuando se cree un conector, el sistema deberá usar el trazado predeterminado vigente y deberá permitir cambiarlo en cualquier momento sin romper las uniones.
- Cuando la persona cambie el trazado, el sistema deberá conservar anclajes, textos y estilo.

**RF-7 — Trazado de 90°.**
- El sistema deberá trazar el conector solo con tramos horizontales y verticales.
- El sistema deberá salir de cada anclaje en la dirección hacia afuera de la forma y calcular la ruta de modo que no cruce las formas a las que está unido.
- Cuando la persona arrastre un tramo, el sistema deberá moverlo y reajustar el resto de la ruta manteniendo los ángulos rectos.
- Cuando la persona restablezca la ruta, el sistema deberá volver al cálculo automático.
- Cuando se muevan las formas, el sistema deberá recalcular la ruta; los tramos ajustados a mano deberán conservarse mientras sigan siendo válidos.

**RF-8 — Trazado redondeado.**
- El sistema deberá trazar una curva suave que salga de cada anclaje en la dirección hacia afuera de la forma y no forme picos ni quiebres.
- Donde la persona ajuste la curvatura, el sistema deberá conservarla al mover las formas.

**RF-9 — Trazado libre.**
- Cuando la persona seleccione un conector libre, el sistema deberá mostrar sus puntos de control.
- Cuando la persona arrastre un punto de control, el sistema deberá moverlo y redibujar el conector.
- Cuando la persona añada o elimine un punto de control, el sistema deberá actualizar el trazado.
- El sistema deberá permitir elegir, por conector, si el trazado libre se muestra como segmentos rectos (poligonal) o como curva suavizada que pasa por los puntos de control, y deberá conservar los puntos al cambiar de modo.

**RF-10 — Texto del conector.**
- El sistema deberá mantener el texto del conector centrado sobre su trazado y legible en todos los trazados, sin quedar tapado por la línea.

### 4.3 Estilo y color

**RF-11 — Estilo de la forma.**
- El sistema deberá permitir asignar, por separado, a cada forma: **color de relleno** (con opción «sin relleno»), **color de contorno**, **grosor y tipo de línea del contorno** y **color del texto**.
- El sistema deberá permitir fijar la **opacidad del relleno** de 0 a 100 %, sin afectar al contorno ni al texto.
- Cuando la persona seleccione varias formas, el sistema deberá aplicar el cambio a todas.

**RF-12 — Estilo del conector.**
- El sistema deberá permitir asignar a cada conector: **color de línea** (que también colorea las puntas), **grosor** (fino, medio, grueso), **tipo de línea** (continua, discontinua, punteada) y **color del texto** de su etiqueta.
- El sistema deberá permitir elegir la **punta de cada extremo** por separado: flecha, círculo, rombo o ninguna.

**RF-13 — Selector de color.**
- El sistema deberá ofrecer una **paleta del sistema** y un selector de **color personalizado**.
- Los colores de la paleta deberán adaptarse al tema claro u oscuro; los personalizados deberán verse igual en ambos temas.
- Si un color de texto elegido tiene un contraste menor de 4,5:1 con el relleno visible de la forma, entonces el sistema deberá mostrar un aviso no bloqueante.
- Cuando se aplique un color, el sistema deberá mostrarlo de inmediato en el lienzo y dejarlo recuperable con deshacer.
- El sistema deberá recordar los últimos colores personalizados usados.

**RF-14 — Estilo predeterminado.**
- Cuando se cree una forma o un conector, el sistema deberá aplicar el estilo predeterminado vigente de su tipo (forma o conector); si la persona no ha definido uno, el de la paleta del sistema.
- Cuando la persona elija «Usar como predeterminado» en una forma o en un conector, el sistema deberá guardar su estilo como predeterminado de ese tipo para los elementos que se creen después, sin modificar los ya existentes.
- El sistema deberá permitir restablecer el estilo predeterminado al del sistema.
- El sistema deberá incluir los estilos predeterminados en el respaldo y la restauración.

**RF-14b — Copiar y pegar.**
- Cuando la persona copie una o varias formas y las pegue, el sistema deberá crear copias con nuevos identificadores, con su texto, tamaño y estilo, desplazadas respecto a las originales para que no se encimen.
- Cuando entre las formas copiadas haya conectores cuyos dos extremos estén en ellas, el sistema deberá copiarlos con sus anclajes, trazados y estilo; los conectores con un extremo fuera de la selección se copiarán con ese extremo libre.
- Cuando la persona copie el estilo de un elemento y lo pegue sobre otro del mismo tipo, el sistema deberá aplicarle ese estilo sin alterar su texto, tamaño, posición ni uniones.
- El sistema deberá permitir pegar en otro diagrama de v-note, conservando el aspecto.
- Cada pegado deberá ser un solo paso de deshacer.

### 4.4 Visibilidad de los controles

**RF-15 — Controles legibles.**
- El sistema deberá mostrar siempre, sobre el lienzo y en ambos temas, los controles de **acercar, alejar y ajustar a la vista**, con ícono y nombre accesible.
- El sistema deberá dar a los íconos y símbolos del lienzo (anclajes, asas de redimensionar, puntos de control, puntas de flecha, selección) un contraste de al menos 3:1 con el fondo del lienzo y con el elemento sobre el que se dibujan; y a todo texto de control, al menos 4,5:1.
- El sistema deberá dar a todo control un área activa de al menos 32 px de lado y de al menos 44 px en pantallas táctiles.
- El sistema deberá distinguir con claridad los estados de cada control: normal, bajo el puntero, enfocado, activo y deshabilitado.
- Mientras un control esté enfocado con el teclado, el sistema deberá mostrar el anillo de foco del estándar de la spec 002.
- El sistema no deberá ocultar controles indispensables tras el contenido del diagrama.

**RF-16 — Elementos seleccionados.**
- Cuando se seleccione una forma o un conector, el sistema deberá mostrar su selección con un contorno visible sobre cualquier color de fondo o de relleno.
- El sistema deberá mostrar el nivel de zoom actual de forma legible.

### 4.5 Edición, accesibilidad y compatibilidad

**RF-17 — Deshacer y rehacer.**
- El sistema deberá registrar como un solo paso cada conexión, reubicación de extremo, cambio de trazado, ajuste de tramo, punto de control y cambio de estilo.
- Cuando la persona deshaga o rehaga, el sistema deberá restituir uniones, trazados y estilos exactos.

**RF-18 — Teclado y accesibilidad.**
- El sistema deberá permitir seleccionar una forma o un conector con el teclado, cambiar su trazado y su estilo, y mover un extremo entre anclajes sin ratón.
- El sistema deberá exponer a tecnologías de apoyo, para cada conector, sus dos extremos y su texto.
- Donde esté activa la reducción de movimiento, el sistema no deberá animar el efecto imán ni los cambios de trazado.

**RF-19 — Compatibilidad con diagramas existentes.**
- Cuando se abra un diagrama creado antes de esta spec, el sistema deberá mostrarlo sin cambios visibles: el color único de cada forma pasa a ser su relleno y los conectores quedan unidos a los mismos puntos por donde se dibujaban (lado derecho de la forma de origen y lado izquierdo de la de destino) con el mismo trazo curvo.
- El sistema no deberá perder texto, posiciones ni conexiones al convertir un diagrama.
- El sistema deberá incluir los nuevos datos (anclajes, trazados, estilos, puntos de control) en el **respaldo, la restauración, la exportación y la búsqueda**, y deberá poder restaurar respaldos anteriores a esta spec.
- La exportación a imagen o documento deberá reproducir colores, trazados, puntas y anclajes tal como se ven en el lienzo.

---

## 5. Requisitos no funcionales

| ID | Requisito |
|---|---|
| RNF-1 | **Fluidez:** arrastrar formas y extremos con ruta recalculada en diagramas de hasta 200 formas y 300 conectores sin demora perceptible (menos de 100 ms por interacción). |
| RNF-2 | **Datos locales y respaldo:** los diagramas siguen guardándose solo en el equipo; el respaldo a GitHub conserva todo lo nuevo sin cifrar y con salida determinista. |
| RNF-3 | **Accesibilidad:** cumplir WCAG 2.1 AA en el editor de diagramas en ambos temas (contraste, foco, teclado, objetivos táctiles). |
| RNF-4 | **Privacidad:** cero conexiones externas nuevas. |
| RNF-5 | **Consistencia visual:** usar los valores del estándar de la spec 002 (tokens, radios, espaciado, anillo de foco); sin valores sueltos. |
| RNF-6 | **Idioma:** todos los textos nuevos en español de México con traducción al inglés. |
| RNF-7 | **Compatibilidad:** sin pérdida de datos al abrir diagramas o respaldos anteriores. |
| RNF-8 | **Tamaño:** el aumento de peso de la aplicación se mantiene dentro del presupuesto de la spec 002. |

---

## 6. Casos límite

| ID | Caso | Comportamiento esperado |
|---|---|---|
| CL-1 | Dos formas encimadas o pegadas | La ruta de 90° sigue siendo legible; los anclajes se distinguen por proximidad al puntero. |
| CL-2 | Varios conectores en el mismo anclaje | Se permite; se dibujan sin ocultar la selección del que está activo. |
| CL-3 | Redimensionar una forma al mínimo | Los anclajes se mantienen separados y utilizables; no colapsan. |
| CL-4 | Ruta de 90° imposible de evitar la forma (anclajes enfrentados) | Se calcula un rodeo razonable; nunca atraviesa el texto de la forma. |
| CL-5 | Conector con ambos extremos libres sobre el vacío | Se puede seleccionar, mover entero, estilizar y eliminar. |
| CL-6 | Eliminar una forma con conectores | Los conectores quedan con extremo libre y se informa cuántos (RF-4). |
| CL-7 | Color personalizado con poco contraste respecto al texto | Aviso no bloqueante; se permite aplicarlo. |
| CL-8 | Relleno 0 % de opacidad o «sin relleno» | La forma sigue siendo seleccionable por su contorno y su interior. |
| CL-9 | Cambiar de trazado con tramos ajustados | Se conservan anclajes y estilo; los ajustes del trazado anterior se descartan con aviso. |
| CL-10 | Diagrama muy grande o vista alejada | Los controles del lienzo mantienen su tamaño y legibilidad; los anclajes y asas no desaparecen al alejarse en la forma seleccionada. |
| CL-11 | Diagrama antiguo con conectores que se cruzan | Se abre idéntico; los conectores quedan en los anclajes este → oeste por donde ya se dibujaban. |
| CL-12 | Pantalla táctil sin puntero con «imán» | El imán actúa al soltar el dedo cerca de un anclaje; los objetivos cumplen 44 px. |
| CL-13 | Respaldo creado antes de esta spec | Se restaura completo y se convierte al abrirse (RF-19). |
| CL-14 | Deshacer tras eliminar una forma con conectores | Vuelven forma y conectores con sus uniones originales. |

---

## 7. Fuera de alcance

- Formas nuevas de diagrama y dibujo a mano alzada: se mantienen las cinco formas actuales (inicio/fin, proceso, decisión, entrada/salida, nota).
- Alinear, distribuir y agrupar formas: quedan para una spec posterior. (Copiar y pegar formas y estilos **sí** entra: RF-14b.)
- Organizadores gráficos (mapa mental, organigrama, línea de tiempo, matriz).
- Colaboración, comentarios en el lienzo, plantillas de diagrama y diagramado automático.
- Cualquier cambio en el formato de respaldo que no sea el crecimiento compatible de los datos del diagrama.
- Importar diagramas de otras herramientas.

---

## 8. Criterios de finalización

1. La persona puede unir un conector a cualquiera de los ocho anclajes de una forma y queda exactamente ahí (RF-1, RF-2).
2. Al mover o redimensionar formas, ningún conector cambia de anclaje (RF-3).
3. Se pueden crear y mantener conectores con extremos libres (RF-4).
4. Existen y funcionan los cuatro trazados, con ajuste manual de tramos y de puntos de control (RF-6 a RF-9).
5. Se pueden asignar relleno, contorno, texto y opacidad a las formas, y color, grosor, tipo de línea y puntas a los conectores, con paleta y color personalizado, y guardar el estilo como predeterminado (RF-11 a RF-14).
   Copiar y pegar formas y estilos funciona dentro y entre diagramas (RF-14b).
6. Zoom y demás controles cumplen contraste, tamaño táctil y foco en ambos temas, comprobado con auditoría de accesibilidad (RF-15, RF-16, RNF-3).
7. Todas las acciones nuevas se deshacen y rehacen (RF-17) y se pueden hacer con teclado (RF-18).
8. Los diagramas y respaldos anteriores se abren sin cambios visibles ni pérdida de datos, y los nuevos datos entran en respaldo, restauración, exportación y búsqueda (RF-19, RNF-7).
9. Los presupuestos RNF-1 a RNF-8 se cumplen y `bun run typecheck` y `bun run test` pasan.
10. Todos los casos límite CL-1 a CL-14 tienen una prueba que pasa.

---

## 9. Dudas abiertas

| ID | Duda |
|---|---|
Ninguna pendiente. Las cuatro dudas del borrador quedaron resueltas (D-12 a D-15).

| ID | Pendiente para el plan (no cambia el QUÉ) |
|---|---|
| P-1 | ~~Alcance del estilo predeterminado (RF-14)~~ **Resuelto:** por espacio de trabajo (D-16). |
| P-2 | ~~Alcance del portapapeles (RF-14b)~~ **Resuelto:** solo dentro de v-note, sin tocar el portapapeles del sistema (D-17). |
