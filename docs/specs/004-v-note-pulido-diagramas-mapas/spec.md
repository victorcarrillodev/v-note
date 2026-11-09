# Especificación 004 — Pulido de diagramas de flujo y mapas mentales

> **Estado:** borrador · **Cuarta parte de v-note** (specs 001 MVP, 002 interfaz, 003 diagramas).
> **Alcance de este documento:** el QUÉ y el POR QUÉ. No define tecnología, arquitectura ni archivos: eso va en el plan.
> **Relación con otras specs:** refina el RF-9 de la spec 001 y la spec 003 (diagramas de flujo), y el RF-10 de la spec 001 (organizadores gráficos, en particular el mapa mental). Donde se indica, **sustituye** comportamientos de esas specs (el trazado curvo de la 003 y la franja de controles).
> **Notación:** los criterios usan EARS en español (*Cuando… el sistema deberá…*, *Mientras…*, *Si… entonces…*, *Donde…*). Las dudas se marcan con **[NECESITA ACLARACIÓN]**.

---

## 1. Contexto y objetivo

### Contexto
Con las specs 001 a 003, diagramas y mapas mentales ya funcionan, pero el uso diario deja detalles que estorban:

1. Al insertar un diagrama o un mapa aparece **una franja de controles debajo del lienzo** (texto del hijo, agregar hijo, agregar hermano, colapsar, eliminar…) que ocupa espacio y se ve poco cuidada.
2. No hay forma de **editar en grande**: el lienzo es del tamaño que tiene en la página.
3. Los botones **no muestran el puntero de mano**, por lo que no parecen clicables.
4. Los conectores solo se pueden ajustar en sus puntos existentes: no se puede **quitar o agregar esquinas**, y el trazado curvo aún puede mostrar tramos rectos.
5. En el mapa mental, los globos **no se pueden colorear**, **no se pueden mover**, el área no coincide con el **ancho de los demás bloques**, no tiene controles de zoom y las acciones de cada globo viven fuera de él en lugar de aparecer al hacer clic.
6. Al hacer clic en un bloque aparece un **contorno azul de enfoque** que la persona no quiere ver.

### Objetivo
Que diagramas y mapas mentales se sientan **ordenados, directos y cómodos de editar**: los controles aparecen donde se trabaja y solo cuando hacen falta, se puede ampliar el lienzo para trabajar a gusto, y cada elemento se puede acomodar y colorear con libertad.

### Por qué
- Un lienzo limpio deja ver el contenido; los controles fijos lo recortan y distraen.
- Si algo es clicable debe parecerlo; el puntero de mano es la pista más básica.
- Editar diagramas grandes en un recuadro pequeño obliga a hacer zoom y desplazarse constantemente.
- Un conector sin control sobre sus esquinas obliga a rehacerlo cuando solo sobra o falta un quiebre.
- Un mapa mental que no se puede reordenar ni colorear no sirve para organizar ideas con significado visual.

### Decisiones ya tomadas (con la persona responsable del producto)

| ID | Decisión |
|---|---|
| D-1 | Los controles de diagramas y mapas aparecen en un **menú emergente junto al elemento** seleccionado, con solo las opciones de ese elemento. La franja inferior desaparece. |
| D-2 | La vista ampliada es **pantalla completa dentro de la app** (no del sistema operativo), con botón de salir y tecla Esc. |
| D-3 | El **puntero de mano** se aplica a **toda la app**: todo control clicable lo muestra y los deshabilitados muestran el cursor de «no permitido». |
| D-4 | Los puntos de quiebre de un conector se **agregan y quitan con doble clic**, y además con un menú emergente del punto («Eliminar punto»). |
| D-5 | El trazado curvo pasa a ser una **curva suave continua** que atraviesa los puntos, sin tramos rectos ni esquinas. |
| D-6 | En el mapa mental se pueden colorear **relleno, borde, texto y línea hacia el padre** de cada globo. |
| D-7 | El color del mapa se aplica **al globo elegido**, con la opción de **aplicarlo a toda la rama**. |
| D-8 | Los globos se **reubican arrastrándolos libremente**; sus hijos se mueven con ellos y la posición se guarda. |
| D-9 | El mapa mental ofrece acercar, alejar, restablecer al 100 %, ajustar a la vista, mover arrastrando el fondo y zoom con Ctrl + rueda o pellizco. |
| D-10 | El mapa mental ocupa el **ancho de la columna** como los demás bloques y su **alto es ajustable** arrastrando el borde inferior. |
| D-11 | En el mapa mental, **un clic** sobre el globo lo selecciona, abre su menú emergente y permite escribir su texto. |
| D-12 | El **contorno azul de enfoque** se quita en **toda la app** al usar el ratón o el dedo; se conserva un indicador de foco visible solo al navegar con teclado. |
| D-13 | La vista ampliada incluye **controles de zoom y encuadre, botón de salir (y Esc) y deshacer/rehacer**. |
| D-14 | Los elementos (formas, globos y puntos de conectores) **se acomodan a la cuadrícula** del lienzo, tanto en el diagrama como en el mapa. |
| D-15 | El diagrama de flujo también tiene **alto ajustable** arrastrando su borde inferior, igual que el mapa. |
| D-16 | La cuadrícula del diagrama ya existe y se conserva; el mapa mental **recibe una igual**, con **una sola separación** para ambos. |

---

## 2. Usuarios

- **Persona usuaria única** de v-note, en escritorio (ratón y teclado) y también en pantallas táctiles (PWA).
- Construye diagramas de flujo y mapas mentales para estudiar, planear o explicar, desde pocos hasta decenas de elementos.
- Conserva diagramas y mapas creados con versiones anteriores y espera que sigan igual.

---

## 3. Historias de usuario

| ID | Historia | Prioridad |
|---|---|---|
| HU-1 | Como persona usuaria quiero que las opciones de un elemento aparezcan en un **menú emergente** al seleccionarlo, para ahorrar espacio y ver solo lo relevante. | Alta |
| HU-2 | Como persona usuaria quiero **ampliar el diagrama o el mapa a pantalla completa** para editarlo con comodidad. | Alta |
| HU-3 | Como persona usuaria quiero que todo lo clicable muestre el **puntero de mano**. | Alta |
| HU-4 | Como persona usuaria quiero **quitar y agregar esquinas** en un conector para dejarlo con las que necesito. | Alta |
| HU-5 | Como persona usuaria quiero conectores **curvos continuos**, sin tramos rectos. | Alta |
| HU-6 | Como persona usuaria quiero **colorear los globos** del mapa mental (relleno, borde, texto y línea) igual que en el diagrama. | Alta |
| HU-7 | Como persona usuaria quiero **mover los globos** donde yo quiera, con su rama. | Alta |
| HU-8 | Como persona usuaria quiero que el mapa tenga el **mismo ancho que los demás bloques**, alto ajustable y controles de zoom. | Alta |
| HU-9 | Como persona usuaria quiero **escribir y usar las acciones del globo con un clic**, como en el diagrama. | Alta |
| HU-10 | Como persona usuaria quiero que **no aparezca el contorno azul** al hacer clic. | Media |
| HU-11 | Como persona usuaria quiero que mis **diagramas y mapas existentes sigan intactos** al actualizar. | Alta |
| HU-12 | Como persona usuaria quiero **deshacer y rehacer** cualquiera de estas acciones. | Alta |

---

## 4. Requisitos funcionales

### 4.1 Menús emergentes en lugar de la franja inferior

**RF-1 — Menú emergente del elemento seleccionado.**
- Cuando la persona seleccione una forma, un conector o un globo, el sistema deberá mostrar junto a él un menú emergente con las opciones aplicables a ese elemento (por ejemplo: forma, color, trazado, puntas, agregar hijo, agregar hermano, colapsar, eliminar).
- El sistema no deberá mostrar la franja de controles debajo del lienzo.
- Cuando la persona haga clic en un espacio vacío del lienzo o pulse Esc, el sistema deberá cerrar el menú.
- Cuando la persona arrastre el elemento o haga zoom o desplazamiento, el sistema deberá mantener el menú pegado al elemento sin tapar el contenido que se está manipulando.
- Si el elemento queda cerca del borde del lienzo, entonces el sistema deberá reubicar el menú para que siempre quede completo y visible.
- Mientras no haya nada seleccionado, el sistema deberá mostrar únicamente los controles generales (insertar forma, zoom, ampliar, deshacer, rehacer) de forma compacta.

**RF-2 — Orden y claridad de las opciones.**
- El sistema deberá agrupar las opciones del menú por tema (apariencia, estructura, acciones) con etiqueta legible e ícono.
- El sistema deberá mantener los mismos grupos y el mismo orden para el mismo tipo de elemento.
- El sistema deberá permitir operar todo el menú con teclado y anunciarlo a lectores de pantalla.

### 4.2 Vista ampliada

**RF-3 — Pantalla completa dentro de la app.**
- Cuando la persona active «Ampliar» en un diagrama o en un mapa, el sistema deberá mostrarlo en pantalla completa dentro de la ventana de la app.
- El sistema deberá mostrar en la vista ampliada los controles de zoom y encuadre, deshacer y rehacer, y un botón de salir.
- Cuando la persona pulse Esc o el botón de salir, el sistema deberá volver a la página en el mismo punto donde estaba, conservando todos los cambios.
- Mientras esté en vista ampliada y haya un menú o cuadro abierto, Esc deberá cerrar primero ese elemento y solo después la vista.
- El sistema deberá mantener la selección, el zoom y la posición del lienzo al entrar y al salir.

### 4.3 Puntero y enfoque

**RF-4 — Puntero de mano en toda la app.**
- Cuando el puntero esté sobre un control clicable (botón, pestaña, elemento de menú, forma, globo, asa, casilla), el sistema deberá mostrar el puntero de mano.
- Mientras un control esté deshabilitado, el sistema deberá mostrar el cursor de «no permitido» y no responder al clic.
- Donde un elemento permita arrastrar o redimensionar, el sistema deberá mostrar el cursor correspondiente (mover, redimensionar).

**RF-5 — Sin contorno azul al hacer clic.**
- Cuando la persona haga clic o toque un bloque, el sistema no deberá mostrar el anillo azul de enfoque.
- Cuando la persona navegue con teclado, el sistema deberá mostrar un indicador de foco visible, con contraste suficiente en claro y oscuro.
- El sistema deberá seguir distinguiendo visualmente el elemento seleccionado (por ejemplo, con un indicador discreto distinto del anillo de enfoque).

### 4.4 Conectores del diagrama de flujo

**RF-6 — Quitar puntos de quiebre.**
- Cuando la persona haga doble clic sobre un punto de quiebre de un conector, el sistema deberá eliminarlo y rehacer el trazado con los puntos restantes.
- Cuando la persona seleccione un punto de quiebre, el sistema deberá ofrecer en un menú emergente la opción «Eliminar punto».
- Si el conector ya no tiene puntos intermedios, entonces el sistema deberá trazarlo directo entre sus extremos según su tipo de trazado.

**RF-7 — Agregar puntos de quiebre.**
- Cuando la persona haga doble clic sobre un tramo del conector, el sistema deberá agregar un punto de quiebre en ese lugar.
- Cuando la persona arrastre un punto de quiebre, el sistema deberá moverlo con vista previa y registrar un solo paso de historial al soltar.
- El sistema no deberá limitar la cantidad de puntos de quiebre más allá de lo razonable para el rendimiento (RNF-1).

**RF-8 — Conector curvo continuo.**
- Cuando el trazado de un conector sea curvo, el sistema deberá dibujarlo como una curva suave y continua que pasa por sus puntos, sin tramos rectos ni esquinas.
- Cuando la persona mueva un punto de la curva, el sistema deberá ajustar la curva de forma suave en ambos lados del punto.
- Cuando el conector curvo no tenga puntos intermedios, el sistema deberá trazar una curva suave entre sus extremos que salga de cada anclaje en la dirección del anclaje.
- El sistema deberá exportar la curva con la misma forma que se ve en el lienzo.
- El trazado «libre» con segmentos rectos (spec 003) se conserva como trazado aparte.

### 4.5 Mapa mental: color

**RF-9 — Color por globo.**
- Cuando la persona seleccione un globo, el sistema deberá ofrecer en su menú emergente elegir el color de relleno, borde y texto del globo, y el color de la línea que lo une con su padre.
- El sistema deberá reutilizar la misma paleta, el color personalizado y los colores recientes del diagrama de flujo.
- El sistema deberá mantener contraste legible: si el texto y el relleno elegidos no cumplen el contraste mínimo, entonces el sistema deberá avisarlo sin impedirlo.

**RF-10 — Color de toda la rama.**
- Cuando la persona elija «Aplicar a la rama», el sistema deberá aplicar la apariencia del globo a todos sus descendientes actuales.
- El sistema no deberá cambiar los globos hijos nuevos que se creen después, salvo que la persona vuelva a aplicar a la rama.
- El sistema deberá deshacer la aplicación a la rama con un solo paso de historial.

### 4.6 Mapa mental: reubicar globos

**RF-11 — Arrastre libre con la rama.**
- Cuando la persona arrastre un globo, el sistema deberá moverlo junto con todos sus descendientes, mostrando las líneas ajustadas en tiempo real.
- Cuando la persona suelte el globo, el sistema deberá guardar la nueva posición y registrar un solo paso de historial.
- El sistema deberá mantener las posiciones al cerrar y volver a abrir la página.
- Cuando la persona elija «Reordenar automáticamente», el sistema deberá restaurar la distribución automática de todo el mapa.
- Cuando la persona agregue un hijo nuevo, el sistema deberá colocarlo cerca de su padre sin superponerse con otros globos.
- El globo raíz podrá moverse; al moverlo se desplaza todo el mapa.

### 4.7 Mapa mental: tamaño y vista

**RF-12 — Ancho de columna y alto ajustable.**
- El sistema deberá mostrar el mapa y el diagrama con el mismo ancho que los demás bloques de la página, en cualquier ancho de ventana.
- Cuando la persona arrastre el borde inferior del mapa o del diagrama, el sistema deberá cambiar su alto y guardarlo.
- Cuando se cree un mapa o un diagrama, el sistema deberá darle un alto por defecto suficiente para ver su contenido inicial completo.
- Los diagramas existentes conservarán su alto actual hasta que la persona lo cambie.

**RF-13 — Controles de vista.**
- El sistema deberá mostrar sobre el mapa los botones de acercar, alejar, restablecer al 100 %, ajustar a la vista y ampliar, con el porcentaje de zoom actual.
- Cuando la persona arrastre el fondo del mapa, el sistema deberá desplazar la vista.
- Cuando la persona use Ctrl + rueda o un gesto de pellizco, el sistema deberá cambiar el zoom centrado en el puntero.
- El sistema deberá recordar el zoom y la posición solo mientras la página esté abierta; al reabrirla, deberá encuadrar el mapa completo.

### 4.8 Mapa mental: interacción con un clic

**RF-14 — Clic en el globo.**
- Cuando la persona haga clic en un globo, el sistema deberá seleccionarlo, abrir su menú emergente y dejar el cursor listo para escribir su texto.
- El menú deberá incluir: agregar hijo, agregar hermano, colapsar o expandir, eliminar y color.
- Cuando la persona pulse Esc, el sistema deberá cerrar el menú sin perder el texto escrito.
- Cuando la persona elimine un globo con hijos, el sistema deberá avisar cuántos globos se eliminarán y permitir deshacer.
- El campo «Texto hijo» y los botones de la franja inferior dejan de existir.
- Cuando el texto quede vacío al salir del globo, el sistema deberá conservar el globo con un texto de relleno atenuado.

### 4.9 Cuadrícula

**RF-18 — Acomodo a la cuadrícula.**
- Cuando la persona mueva una forma, un globo o un punto de quiebre, el sistema deberá acomodar su posición a la cuadrícula del lienzo al soltarlo, y deberá mostrar el ajuste durante el arrastre.
- Cuando la persona cambie el tamaño de una forma o de un globo, el sistema deberá acomodar sus bordes a la cuadrícula.
- Cuando la persona inserte una forma o un globo nuevo, el sistema deberá colocarlo en un punto de la cuadrícula.
- Cuando se mueva un globo con su rama, el sistema deberá acomodar el globo arrastrado y conservar la distancia entre él y sus descendientes.
- Cuando la persona mantenga pulsada una tecla modificadora (Alt) mientras arrastra, el sistema deberá permitir el movimiento libre, sin acomodar.
- El sistema deberá ofrecer un control para activar o desactivar el acomodo a la cuadrícula y para mostrar u ocultar la cuadrícula, y deberá recordar la elección.
- Mientras el acomodo esté activo, el sistema deberá mantener la separación de la cuadrícula constante al cambiar el zoom, en el diagrama, el mapa y la vista ampliada.
- El sistema deberá conservar la cuadrícula actual del diagrama y mostrar una cuadrícula igual en el mapa mental, con la misma separación en ambos.
- Los diagramas y mapas existentes no deberán moverse al abrirlos: el acomodo solo aplica a las acciones nuevas.

### 4.10 Edición, compatibilidad y accesibilidad

**RF-15 — Deshacer y rehacer.** Todas las acciones nuevas (mover globos, colorear, aplicar a la rama, agregar o quitar puntos, cambiar el alto) deberán poder deshacerse y rehacerse, y un gesto continuo deberá producir un solo paso de historial.

**RF-16 — Compatibilidad.**
- El sistema deberá abrir los diagramas y mapas creados antes de esta spec sin cambios visibles ni pérdida de datos.
- Cuando un mapa antiguo no tenga posiciones ni colores guardados, el sistema deberá usar la distribución y la apariencia automáticas.
- El sistema deberá incluir las posiciones, colores y alto del mapa en el respaldo, la restauración, la exportación y la búsqueda, sin cambiar la versión del formato de respaldo.

**RF-17 — Teclado y táctil.**
- El sistema deberá permitir hacer con teclado: seleccionar un globo o conector, abrir su menú, cambiar el color, agregar y quitar hijos, mover el globo seleccionado con las flechas, ampliar y salir.
- En pantallas táctiles, un toque deberá hacer lo mismo que un clic y los objetivos tocables deberán medir al menos 44 px.

---

## 5. Requisitos no funcionales

| ID | Requisito |
|---|---|
| RNF-1 | **Fluidez.** Arrastrar globos, puntos o el fondo con 200 elementos deberá mantenerse fluido (fotogramas ≤ 100 ms en el peor caso). |
| RNF-2 | **Peso.** No se añaden dependencias sin justificarlas en el plan. |
| RNF-3 | **Accesibilidad.** Contraste WCAG 2.1 AA en claro y oscuro; el foco por teclado siempre es visible; menús con roles y nombres accesibles. |
| RNF-4 | **Espacio.** El menú emergente no deberá ocupar más del 40 % del alto visible del lienzo y no deberá tapar el elemento seleccionado. |
| RNF-5 | **Privacidad.** Ningún dato sale del equipo; todo se guarda en el espacio de trabajo local. |
| RNF-6 | **Idioma.** Textos en español de México con i18n es/en desde el inicio. |
| RNF-7 | **Compatibilidad de datos.** Sin migración destructiva; abrir y guardar con la versión anterior no corrompe nada. |
| RNF-8 | **Coherencia.** Diagrama y mapa comparten la misma lógica de menús, colores, zoom y vista ampliada. |

---

## 6. Casos límite

| ID | Caso | Comportamiento esperado |
|---|---|---|
| CL-1 | Menú cerca del borde del lienzo o de la ventana | Se reubica para quedar completo |
| CL-2 | Seleccionar otro elemento con un menú abierto | El menú cambia al nuevo elemento |
| CL-3 | Doble clic sobre un punto que es el único intermedio | Se elimina y el conector queda directo |
| CL-4 | Doble clic en un tramo muy cerca de un extremo | Agrega el punto sin tapar el anclaje |
| CL-5 | Conector curvo con un solo punto o con puntos casi alineados | La curva sigue suave, sin picos ni bucles |
| CL-6 | Mover un globo sobre otro | Se permite superponer; «Reordenar automáticamente» los separa |
| CL-7 | Mover la raíz de un mapa grande | Se mueve todo el mapa sin perder la relación entre globos |
| CL-8 | Colapsar un globo ya movido | Sus hijos se ocultan y reaparecen en su lugar |
| CL-9 | Salir de la vista ampliada con cambios sin terminar de escribir | El texto se conserva |
| CL-10 | Mapa con muchos globos y alto mínimo | «Ajustar a la vista» encuadra todo sin pasar el zoom mínimo; si no cabe, avisa |
| CL-11 | Cambiar el ancho de la ventana o abrir la barra lateral | El mapa y el diagrama se adaptan al ancho de la columna |
| CL-12 | Mapa o diagrama de versiones anteriores | Se ven y se comportan como antes, hasta que la persona edite |
| CL-13 | Texto largo en un globo | El globo crece y la distribución automática evita superposiciones |
| CL-14 | Teclado: enfoque dentro de un bloque y Tab | El foco sale del bloque sin quedar atrapado |
| CL-15 | Elemento antiguo fuera de la cuadrícula | No se mueve al abrir; al arrastrarlo se acomoda |
| CL-16 | Forma al tamaño mínimo y cuadrícula más grande que ese tamaño | Respeta el tamaño mínimo y se acomoda al punto más cercano |
| CL-17 | Mover una rama cuyos descendientes no están en la cuadrícula | Conservan su distancia relativa al globo arrastrado |

---

## 7. Fuera de alcance

- Cambiar el contenido, las formas o las reglas de conexión de los diagramas de flujo (spec 003).
- Nuevos tipos de organizadores gráficos.
- Menús emergentes, color, reubicación y zoom del **organigrama**, la línea de tiempo y la matriz: solo se mejoran el diagrama de flujo y el mapa mental (el puntero y el foco sí aplican a toda la app).
- Colaboración, comentarios o sincronización.
- Exportar a formatos nuevos (solo se mantienen los actuales).
- Un tema visual nuevo para toda la app; solo se ajustan el puntero y el enfoque.
- Personalizar la distribución automática del mapa (direcciones, espaciados).

---

## 8. Criterios de finalización

1. La franja inferior ya no existe y las opciones aparecen en menús emergentes junto al elemento (RF-1, RF-2).
2. Se puede ampliar a pantalla completa un diagrama y un mapa, y volver sin perder nada (RF-3).
3. Todo control clicable muestra el puntero de mano y los deshabilitados el cursor de no permitido (RF-4).
4. No aparece el contorno azul al usar ratón o dedo, y el foco por teclado sigue visible (RF-5).
5. Se pueden quitar y agregar puntos de quiebre en un conector (RF-6, RF-7).
6. El conector curvo es continuo y sin tramos rectos, también al exportar (RF-8).
7. Los globos se colorean (relleno, borde, texto y línea), incluida la rama completa (RF-9, RF-10).
8. Los globos se reubican arrastrando con su rama y se puede reordenar automáticamente (RF-11).
9. El mapa y el diagrama tienen el ancho de la columna y alto ajustable, y el mapa tiene controles de vista (RF-12, RF-13).
10. Un clic en el globo abre su menú y permite escribir (RF-14).
11. Formas, globos y puntos se acomodan a la cuadrícula en diagrama, mapa y vista ampliada, con opción de movimiento libre y de desactivarlo (RF-18).
12. Todo se deshace y rehace, se opera con teclado y táctil, y los datos anteriores se abren sin cambios (RF-15 a RF-17).
13. Los presupuestos RNF-1 a RNF-8 se cumplen, todos los casos límite CL-1 a CL-17 tienen una prueba que pasa, y `bun run typecheck` y `bun run test` pasan.

---

## 9. Dudas abiertas

| ID | Duda |
|---|---|
| — | Ninguna pendiente. Las 13 preguntas de aclaración quedaron resueltas (D-1 a D-13), más la cuadrícula y el alto del diagrama (D-14 a D-16). |

| ID | Pendiente para el plan (no cambia el QUÉ) |
|---|---|
| P-1 | ~~Alto ajustable del diagrama~~ **Resuelto:** sí, igual que el mapa (D-15). |
| P-3 | ~~Cuadrícula en diagrama y mapa~~ **Resuelto:** la del diagrama se conserva, el mapa recibe una igual y comparten separación (D-16). |
| P-2 | Dónde se guardan posiciones, colores y alto del mapa dentro de los datos existentes, para no cambiar el formato de respaldo. |
