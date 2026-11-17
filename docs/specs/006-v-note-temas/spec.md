# Especificación 006 — Temas de color

> **Estado:** implementada (sin dudas abiertas) · **Sexta parte de v-note** (specs 001 MVP, 002 interfaz, 003 diagramas, 004 pulido de diagramas y mapas, 005 estilo de páginas).
> **Alcance de este documento:** el QUÉ y el POR QUÉ. No define tecnología, arquitectura ni archivos: eso va en el plan.
> **Relación con otras specs:** amplía el RF-10.1 de la spec 002 (elección de **tema**: claro, oscuro, sistema) y respeta su RF-10.2 (los ajustes de apariencia son **del dispositivo**) y su RF-14.1 (contraste). Se apoya en el color de acento por página de la spec 005 (RF-8.2, D-21), que debe seguir leyéndose en cada tema.
> **Diseño de referencia:** lienzo «Temas de v-note» (16 de noviembre de 2026), con una vista previa de cada tema. Los valores exactos de color se fijan en el plan.
> **Notación:** los criterios usan EARS en español (*Cuando… el sistema deberá…*, *Mientras…*, *Si… entonces…*, *Donde…*). Las dudas se marcan con **[NECESITA ACLARACIÓN]**.

---

## 1. Contexto y objetivo

### Contexto
Hoy la persona puede elegir entre tres temas: **claro**, **oscuro** y **sistema**. Son correctos y cuidan el contraste, pero tienen un solo aspecto cada uno:

1. Quien pasa horas estudiando en la app no puede darle un tono que le resulte más cómodo o que le guste más (frío, cálido, verde, violeta…).
2. No hay una opción de **máximo contraste** (blanco y negro) para quien lo necesita o lo prefiere, ni una opción de **grises neutros** sin tinte de color.
3. El tema oscuro único cubre desde quien estudia de noche en una habitación oscura hasta quien solo quiere un fondo no blanco; no hay término medio.

### Objetivo
Que la persona pueda **elegir entre diez temas nuevos** (cinco claros y cinco oscuros, incluidos uno en blanco y negro y otro en tonos grises) además de los tres actuales, y que cualquiera de ellos se vea bien en **toda** la aplicación y cumpla el mismo contraste que ya exige el proyecto.

### Por qué
- Leer y escribir durante mucho tiempo es más cómodo con una paleta a gusto de cada quien.
- El blanco y negro y los grises cubren necesidades de accesibilidad y de sobriedad que hoy no tienen respuesta.
- Es una mejora de comodidad que no cambia el contenido ni los datos: bajo riesgo y gran efecto en el uso diario.

### Decisiones ya tomadas (con la persona responsable del producto)

| ID | Decisión |
|---|---|
| D-1 | Se añaden **diez temas** a los tres actuales. **Claros:** Océano, Bosque, Atardecer, Lavanda y Blanco y negro. **Oscuros:** Medianoche, Esmeralda, Rosa nocturna, Ámbar y Grafito. Claro, Oscuro y Sistema siguen **exactamente como están**. |
| D-2 | Cada tema nuevo es **claro u oscuro** (su *variante*). Todo lo que hoy distingue entre claro y oscuro (editor, diagramas, mapas mentales, portadas, colores de bloque) sigue la variante del tema. |
| D-3 | Un tema cambia **superficies, bordes, texto, acento, estados y botón principal**. Los **colores de bloque, de chips y las portadas con degradado** son los de su variante (clara u oscura): así lo que ya está guardado se ve igual en cualquier tema, y su contraste ya está garantizado (CL-5 de la spec 002). |
| D-4 | **Blanco y negro** usa negro puro sobre blanco puro, con acento negro y bordes de control negros (contraste máximo). **Grafito** usa grises neutros sin tinte de color, con acento gris claro. |
| D-5 | En **Blanco y negro** los estados (éxito, aviso, error) **conservan su color**, porque en gris puro no se distinguirían, y además nunca dependen solo del color: llevan icono o texto (RF-5.4). La spec 002 no lo exige para los estados (su RF-14.3 lo pide solo para el foco), así que esta spec lo añade. |
| D-6 | La elección de tema es **del dispositivo**: no viaja en el respaldo, no es por espacio ni por página (RF-10.2 de la 002). |
| D-7 | Los temas son un **catálogo cerrado** que viene con la aplicación. No hay colores libres (misma razón que D-21 de la 005: el contraste queda garantizado). |
| D-8 | Elegir un tema con color **fija** su variante: ya no sigue al sistema. **Sistema** conserva su comportamiento actual (elige entre Claro y Oscuro) y no escoge temas con color. Emparejar temas con el sistema queda **fuera de alcance** (confirmado el 16 de noviembre de 2026). |
| D-9 | El comando **«Cambiar tema»** pasa de cualquier tema claro a **Oscuro** y de cualquier tema oscuro a **Claro** (los estándar). No cicla por los temas. |
| D-10 | Al **exportar** una página a HTML o PDF, el diálogo deja elegir entre el **aspecto estándar** (el de hoy, que es la opción predeterminada) y el **tema actual**. |

---

## 2. Usuarios

- **Persona principal:** quien estudia programación y usa v-note a diario, solo, en escritorio o en la web, a veces de noche y a veces con poca luz; le importa que la app sea cómoda de mirar durante horas.
- **Persona que necesita contraste alto o sobriedad:** quien prefiere o necesita blanco y negro, o grises sin color.

---

## 3. Historias de usuario

- **HU-1.** Como persona usuaria, quiero elegir entre varios temas de color, claros y oscuros, para usar el que me resulte más cómodo.
- **HU-2.** Como persona usuaria, quiero ver una vista previa de cada tema antes de elegirlo, para no probarlos uno por uno a ciegas.
- **HU-3.** Como persona usuaria, quiero un tema en blanco y negro y otro en tonos grises, para tener máximo contraste o un aspecto sobrio sin color.
- **HU-4.** Como persona usuaria, quiero que el cambio de tema se vea al instante y en toda la aplicación, sin recargar, y que al volver a abrir la app siga igual.
- **HU-5.** Como persona usuaria, quiero que mis páginas, portadas, diagramas y colores de acento se lean bien en cualquier tema, para no tener que ajustar nada al cambiar.

---

## 4. Requisitos funcionales

### RF-1 Catálogo de temas

- **RF-1.1** El sistema deberá ofrecer, además de Sistema, Claro y Oscuro, los diez temas de D-1: cinco claros y cinco oscuros.
- **RF-1.2** El sistema deberá dar a cada tema un **nombre** en español y en inglés y deberá indicar si es claro u oscuro.
- **RF-1.3** El sistema deberá definir en cada tema todos los colores de superficie, borde, texto, acento, estado y botón principal que usan hoy los temas Claro y Oscuro, de modo que ninguna parte de la interfaz quede sin color propio.
- **RF-1.4** El sistema deberá mostrar los temas Claro, Oscuro y Sistema exactamente como antes de esta spec (D-1).
- **RF-1.5** Los colores de bloque, de chips y las portadas con degradado deberán ser los de la variante (clara u oscura) del tema elegido (D-3).

### RF-2 Elegir el tema

- **RF-2.1** El sistema deberá ofrecer en Ajustes un selector de tema agrupado en **Sistema**, **Temas claros** y **Temas oscuros** (Claro y Oscuro van en su grupo).
- **RF-2.2** El sistema deberá mostrar en cada opción una **vista previa en miniatura** con los colores principales del tema (fondo, lateral, tarjeta, acento y texto) y su nombre.
- **RF-2.3** Cuando la persona elija un tema, el sistema deberá aplicarlo de inmediato en toda la aplicación, sin recargar, y conservarlo al reiniciar (RF-10.2 de la 002).
- **RF-2.4** El selector deberá usarse por completo con teclado y lector de pantalla: cada opción anunciará su nombre, si es clara u oscura y si está seleccionada.
- **RF-2.5** El sistema deberá tratar la elección como una preferencia **del dispositivo**: no se incluirá en el respaldo ni se restaurará con él (D-6).
- **RF-2.6** Cuando la persona use el comando «Cambiar tema» (atajo y paleta de comandos), el sistema deberá pasar a **Oscuro** si el tema actual es claro, y a **Claro** si es oscuro, también cuando el tema actual sea uno de color (D-9).

### RF-3 Aplicación en toda la aplicación

- **RF-3.1** El sistema deberá aplicar el tema a todo lo visible: barra superior, lateral, páginas, bases de datos, tableros, menús, diálogos, avisos, índice y selector de portada.
- **RF-3.2** El editor, los diagramas y los mapas mentales deberán seguir la **variante** del tema, y su fondo y sus trazos deberán leerse sobre las superficies de ese tema.
- **RF-3.3** Los controles del sistema (barras de desplazamiento, campos de formulario, selección de texto) deberán seguir la variante del tema.
- **RF-3.4** Cuando el tema cambie, el sistema deberá actualizar también las demás ventanas abiertas de la aplicación (captura rápida, recordatorios) sin recargarlas.
- **RF-3.5** Al abrir la aplicación, el sistema deberá mostrar el tema elegido **desde el primer pintado**, sin destello del tema anterior.

### RF-4 Convivencia con el estilo de página (spec 005)

- **RF-4.1** Cada color de acento de página deberá leerse en cada tema: contraste mínimo de 4,5:1 sobre el lienzo y la tarjeta del tema, y 4,5:1 para el texto sobre el acento.
- **RF-4.2** Cuando la persona cambie de tema, las páginas con color de acento, portada o estilo propio deberán conservar su elección, y solo cambiará la forma en que el tema la pinta.
- **RF-4.3** Las portadas con imagen, con color propio o con degradado propio **no deberán cambiar** con el tema; el texto sobre la portada deberá mantener su contraste con el oscurecido (RF-3.3 de la 005).

### RF-5 Contraste y legibilidad

- **RF-5.1** El sistema deberá cumplir en **cada tema** los mismos mínimos que ya cumplen Claro y Oscuro (RF-14.1 de la 002): texto principal y suave ≥ 4,5:1 sobre todas las superficies; acento y estados como texto ≥ 4,5:1 sobre lienzo, lateral y tarjeta; texto de ayuda ≥ 4,5:1 sobre lienzo y tarjeta; texto sobre el botón principal ≥ 4,5:1; bordes de control ≥ 3:1 sobre todas las superficies.
- **RF-5.2** Los colores de bloque de la variante deberán leerse ≥ 4,5:1 sobre el lienzo y la tarjeta de cada tema, y el texto principal ≥ 4,5:1 sobre sus fondos.
- **RF-5.3** El tema **Blanco y negro** deberá alcanzar el contraste máximo (21:1) entre texto y fondo y entre acento y fondo (D-4).
- **RF-5.4** Los estados (éxito, aviso, error) no deberán depender solo del color en ningún tema (D-5).
- **RF-5.5** Si un tema nuevo incumple cualquiera de estos mínimos, entonces el proyecto no deberá poder cerrarse: una prueba por tema deberá fallar.

### RF-6 Exportación

- **RF-6.1** Cuando la persona exporte una página a HTML o PDF, el sistema deberá ofrecer en el diálogo dos aspectos: **estándar** y **tema actual** (D-10).
- **RF-6.2** El aspecto **estándar** deberá ser el predeterminado y producir un resultado idéntico al de antes de esta spec, sea cual sea el tema elegido.
- **RF-6.3** Cuando se elija **tema actual**, el sistema deberá exportar con los colores de ese tema, y el documento deberá cumplir los mismos contrastes de RF-5.
- **RF-6.4** El documento exportado deberá verse igual al abrirlo después, sin depender del tema de la aplicación en ese momento ni de ningún recurso externo.
- **RF-6.5** El aspecto elegido deberá valer solo para esa exportación; no será un ajuste que se conserve.

---

## 5. Requisitos no funcionales

| ID | Categoría | Criterio |
|---|---|---|
| **RNF-1** | **Funcionamiento sin internet** | Todo lo de esta spec funciona sin conexión y no hace ninguna petición de red. |
| **RNF-2** | **Accesibilidad** | Contrastes de RF-5. Selector con teclado y lector de pantalla (RF-2.4). Objetivos táctiles de al menos 44 px. Un tema no es el único medio para distinguir un estado (RF-5.4). |
| **RNF-3** | **Rendimiento** | Cambiar de tema se refleja en menos de 100 ms y no recarga la aplicación ni pierde la posición ni el texto en edición. |
| **RNF-4** | **Tamaño** | Sin dependencias nuevas, fuentes nuevas ni imágenes: solo valores de color. |
| **RNF-5** | **Datos** | No cambia el esquema de la base ni el formato del respaldo. Un valor guardado que ya no existe se trata como «Sistema» (CL-1). |
| **RNF-6** | **Idioma** | Todos los textos nuevos están en español de México y en inglés (i18n). |
| **RNF-7** | **Mantenimiento** | Los temas viven en un solo catálogo; añadir uno más no exige tocar los componentes. |

---

## 6. Casos límite

| ID | Situación | Comportamiento esperado |
|---|---|---|
| CL-1 | La preferencia guardada nombra un tema que ya no existe, o es un valor dañado | Se usa «Sistema» y no se muestra error. |
| CL-2 | El almacenamiento del dispositivo está bloqueado (modo privado) | El tema elegido se aplica durante la sesión y se avisa de que no se conservará, como con los demás ajustes de apariencia. |
| CL-3 | Se cambia el tema en una ventana mientras hay otra abierta | La otra ventana lo aplica sola (RF-3.4). |
| CL-4 | Se cambia el tema con un diálogo, un menú o el editor abiertos | Se repintan sin cerrarse, y el texto en edición y el cursor no se pierden (RNF-3). |
| CL-5 | El sistema cambia de claro a oscuro mientras hay un tema con color elegido | No pasa nada: el tema elegido manda (D-8). Solo «Sistema» sigue al sistema. |
| CL-6 | Una página usa una portada con color o degradado propio | La portada se ve igual en cualquier tema (RF-4.3). |
| CL-7 | Una página usa un color de acento y se cambia a un tema de otro tono (por ejemplo, acento verde en Rosa nocturna) | El acento sigue legible (RF-4.1) y no se pierde la elección (RF-4.2). |
| CL-8 | Pantalla estrecha o móvil | El selector se adapta al ancho disponible, con las miniaturas en una o dos columnas. |
| CL-9 | Un respaldo se restaura en otro dispositivo | El tema de ese dispositivo no cambia, porque no viaja en el respaldo (D-6). |
| CL-10 | Se abre una versión anterior de la app con un tema nuevo guardado | La versión anterior no lo conoce y usa «Sistema»; al volver a la nueva, el tema sigue elegido si no se cambió. |
| CL-11 | Se exporta con «tema actual» estando en «Sistema» | Se exporta con el Claro u Oscuro que el sistema esté mostrando en ese momento. |
| CL-12 | Se exporta con un tema oscuro una página con un diagrama | El diagrama conserva su aspecto y se lee: va sobre una tarjeta de color claro (DP-10 del plan). |

---

## 7. Fuera de alcance

- Que la persona **cree o edite** temas, elija colores libres o importe y exporte temas.
- Temas **por espacio o por página**, o cambio automático por la hora.
- **Emparejar** un tema claro y uno oscuro para que «Sistema» alterne entre ellos (D-8).
- Que «Cambiar tema» cicle por todos los temas (D-9) o que recuerde el aspecto de exportación elegido (RF-6.5).
- Cambiar la tipografía, la densidad o el estilo de página (siguen como en las specs 002 y 005).
- Adaptar los colores de bloque y las portadas a cada tema (D-3).
- Adaptar los temas al modo de **contraste forzado** del sistema operativo: sigue valiendo el RF-14.11 de la spec 002 (la interfaz debe seguir siendo utilizable) y los temas no deben impedirlo (se comprueba en la Fase 0 del plan).
- Guardar el tema en el respaldo (D-6).

---

## 8. Criterios de finalización

1. **Catálogo:** existen los diez temas de D-1, cada uno con nombre en español e inglés y su variante, y Claro, Oscuro y Sistema se ven como antes (RF-1).
2. **Selector:** Ajustes muestra los temas agrupados con vista previa y se usa con ratón, teclado y lector de pantalla (RF-2).
3. **Aplicación completa:** al elegir un tema, toda la aplicación, incluidos editor, diagramas, mapas y ventanas secundarias, lo muestra al instante y sin destello al abrir (RF-3, RNF-3).
4. **Páginas:** los acentos, portadas y estilos de página se leen y se conservan en cualquier tema (RF-4).
5. **Contraste:** una prueba por tema comprueba todos los mínimos de RF-5 y falla si alguno se incumple.
6. **Datos:** un tema guardado desconocido se trata como Sistema, el respaldo no cambia y no hay migración (RNF-5).
7. **Exportación:** el diálogo ofrece aspecto estándar (idéntico al de antes) o tema actual, y el documento exportado se ve igual al abrirlo después (RF-6).
8. **Calidad:** `bun run typecheck` y `bun run test` pasan, y hay pruebas para el catálogo, la resolución del tema, el arranque sin destello y los contrastes.

---

## 9. Dudas abiertas

No quedan dudas abiertas. Se resolvieron con la persona responsable el 16 de noviembre de 2026:

| ID | Duda | Resolución |
|---|---|---|
| DA-1 | Qué hace «Cambiar tema» con un tema de color elegido. | Pasa a Claro u Oscuro estándar según la variante actual (D-9, RF-2.6). |
| DA-2 | Emparejar «Sistema» con un tema claro y uno oscuro. | Fuera de alcance; Sistema sigue eligiendo entre Claro y Oscuro (D-8). |
| DA-3 | Exportación respecto al tema elegido. | El diálogo deja elegir entre aspecto estándar (predeterminado) y tema actual (D-10, RF-6). |
