# Especificación 005 — Estilo de páginas: portadas, cabecera y opciones del archivo

> **Estado:** borrador · **Quinta parte de v-note** (specs 001 MVP, 002 interfaz, 003 diagramas, 004 pulido de diagramas y mapas).
> **Alcance de este documento:** el QUÉ y el POR QUÉ. No define tecnología, arquitectura ni archivos: eso va en el plan.
> **Relación con otras specs:** amplía el RF de ícono y portada de la spec 001, y el RF-5.1 (cabecera de página) y el RF-10 (apariencia) de la spec 002. **Sustituye** el interruptor de ancho completo del RF-10.3 de la 002 por el ancho de contenido de esta spec. Se apoya en la **excepción de Unsplash** del artículo 6 de la constitución (D-15), que también exceptúa el RF-1.9 de la 002 solo para las portadas de Unsplash.
> **Notación:** los criterios usan EARS en español (*Cuando… el sistema deberá…*, *Mientras…*, *Si… entonces…*, *Donde…*). Las dudas se marcan con **[NECESITA ACLARACIÓN]**.

---

## 1. Contexto y objetivo

### Contexto
Hoy una página tiene una portada y un ícono opcionales, un título y la fila de datos. Funciona, pero se queda corta para quien quiere que sus notas de estudio se vean cuidadas y a su gusto:

1. La cabecera tiene un solo aspecto: la portada arriba y el título debajo. No se puede lograr una **cabecera tipo tarjeta**, con el título sobre la imagen, esquinas redondeadas y un degradado que dé legibilidad (referencia: captura del 16 de noviembre de 2026, «Diseño & Estrategia 2025»).
2. Las portadas solo se pueden elegir de forma limitada: no hay un buscador de fotos ni se pueden ajustar el encuadre, la altura, el oscurecido o las esquinas.
3. Las opciones de presentación de una página se limitan al ancho completo. La tipografía, el tamaño de texto y la densidad son ajustes globales del dispositivo, así que no se puede dar a una página un aspecto distinto al de otra.
4. Las páginas largas no tienen **índice**, por lo que moverse entre secciones obliga a desplazarse a ciegas.

### Objetivo
Que cada página pueda **verse como la persona quiere**: una cabecera tipo tarjeta que se arma pieza por pieza, portadas propias o de Unsplash ajustables, y un **menú de opciones del archivo** arriba a la derecha (como el de Notion, pero más completo) con fuentes, espaciado, índice y opciones adicionales.

### Por qué
- Una cabecera atractiva y reconocible ayuda a ubicar una página de un vistazo y hace que dé gusto volver a ella.
- Las notas de estudio se leen mucho más de lo que se escriben: poder ajustar fuente, tamaño e interlineado por página mejora la lectura según el contenido (teoría frente a código, por ejemplo).
- Un índice convierte una página larga en algo navegable.
- Tener todas las opciones en un solo menú, junto a la página, evita ir a Ajustes para cada cambio.

### Decisiones ya tomadas (con la persona responsable del producto)

| ID | Decisión |
|---|---|
| D-1 | **Unsplash como excepción acotada.** Se enmienda la constitución para permitir solo Unsplash, como función **opcional y apagada por defecto** que se activa en Ajustes. La imagen elegida se descarga y se guarda en local, así que la portada se ve sin internet. La clave de la API vive solo en el llavero del sistema. |
| D-2 | **Cada pieza de la cabecera tipo tarjeta es configurable por separado:** título sobre la portada, descripción, etiqueta, fecha de actualización, ícono que sobresale, degradado y esquinas redondeadas. Ninguna depende de otra salvo donde se indique. |
| D-3 | **Las portadas se respaldan optimizadas:** al importarlas se reducen a un tamaño máximo y se comprimen, y viajan en el respaldo para restaurarse con la página. |
| D-4 | De la portada se puede ajustar: **encuadre** (reposicionar), **altura**, **intensidad del oscurecido**, **redondeo de esquinas** (todas juntas o cada una por separado) y usar un **color sólido o un degradado** en lugar de una imagen. |
| D-5 | Las opciones del archivo viven en un **botón con menú flotante** arriba a la derecha de la página, que no ocupa espacio mientras está cerrado. |
| D-6 | Las fuentes salen de un **catálogo incluido en la aplicación** (de 8 a 12 familias libres), sin descargas ni fuentes del sistema. |
| D-7 | Espaciado por página: **ancho del contenido**, **tamaño de texto** e **interlineado y separación entre bloques**. |
| D-8 | El índice existe en dos formas: **índice flotante** en el margen derecho (opcional por página) y **bloque de índice** insertable. |
| D-9 | Opciones adicionales: **bloquear página**, **color de acento**, **estadísticas** y **restablecer estilo**. Todas las opciones se guardan con la página, y **«Usar como predeterminado»** las fija como estilo de las páginas nuevas del espacio. |
| D-10 | El estilo tarjeta y sus piezas se aplican **por página**. Una página nueva parte del estilo predeterminado del espacio (D-9) y, si no hay uno, del estilo clásico actual. |
| D-11 | Las opciones de estilo de una página **tienen prioridad** sobre los ajustes globales de apariencia de la spec 002. Cada opción ofrece un valor «Predeterminado» que sigue al ajuste global. |
| D-12 | El menú permite elegir una fuente para el **texto** y otra para los **títulos**. La fuente del código sigue el ajuste global. |
| D-13 | La etiqueta de la cabecera muestra por defecto el **nombre del espacio**, y la persona puede cambiarla por un texto propio. |
| D-14 | **Unsplash con copia local:** la foto elegida se guarda en local, se avisa a Unsplash de la descarga y se muestra el crédito del autor. Que la copia local pueda no ajustarse del todo a las condiciones de Unsplash (que piden mostrar las fotos desde sus enlaces) es un **riesgo aceptado** por tratarse de una app personal sin distribución pública. |
| D-15 | La constitución se enmienda con una **excepción nombrada** en el artículo 6 solo para Unsplash. Cualquier otro servicio externo necesitará su propia enmienda. |
| D-16 | **Catálogo de fuentes** (10 familias, licencia OFL): sans Inter, Geist y Nunito (redondeada); serif Source Serif 4, Lora y Merriweather; mono JetBrains Mono y Fira Code; lectura Atkinson Hyperlegible; manuscrita Caveat. |
| D-17 | El **bloqueo** protege el contenido, el título, la cabecera y la portada de la página. Sus propiedades se pueden seguir cambiando desde las vistas de una base de datos (tabla, tablero…). |
| D-18 | El índice incluye por defecto los encabezados **H1 a H3**, y el menú permite limitarlo a «hasta H1», «hasta H2» o «hasta H3». El ajuste es de la página y se aplica igual al índice flotante y a los bloques de índice. |
| D-19 | Todo cambio hecho desde el menú de opciones se puede **deshacer y rehacer** como cualquier otra edición de la página. |
| D-20 | Cuando el ícono sobresale de la portada, va dentro de un **cuadro claro con esquinas redondeadas** (como en la captura de referencia), para que se vea sobre cualquier imagen. |
| D-21 | El color de acento se elige solo de la **paleta incluida**, que ya garantiza el contraste; no hay color de acento libre. |

---

## 2. Usuarios

- **Persona principal:** quien estudia programación y usa v-note para tomar apuntes, armar guías y organizar proyectos. Trabaja sola, en escritorio o en la web, a veces sin internet, y le importa que sus páginas se vean ordenadas y bonitas.
- **Misma persona, al repasar:** lee páginas largas y necesita moverse rápido entre secciones y leer cómodamente durante mucho tiempo.

---

## 3. Historias de usuario

- **HU-1.** Como persona usuaria, quiero que el título y la descripción de una página se vean sobre su portada, con esquinas redondeadas y un degradado, para que la página tenga una cabecera atractiva y fácil de reconocer.
- **HU-2.** Como persona usuaria, quiero activar o desactivar cada pieza de esa cabecera (etiqueta, fecha, ícono, descripción, degradado, esquinas) para armarla a mi gusto.
- **HU-3.** Como persona usuaria, quiero usar como portada una imagen de mi equipo, una foto de Unsplash, un color o un degradado, para no depender de imágenes que ya tenga.
- **HU-4.** Como persona usuaria, quiero ajustar el encuadre, la altura, el oscurecido y el redondeo de la portada, para que la imagen luzca bien y el título se lea.
- **HU-5.** Como persona usuaria, quiero un menú arriba a la derecha de la página con todas sus opciones de presentación, para cambiarlas sin salir de ella.
- **HU-6.** Como persona usuaria, quiero elegir la fuente, el tamaño de texto, el interlineado y el ancho de cada página, para adaptar su lectura a su contenido.
- **HU-7.** Como persona usuaria, quiero un índice de los encabezados de la página, flotante o como bloque, para saltar entre secciones.
- **HU-8.** Como persona usuaria, quiero bloquear una página, darle un color de acento, ver sus estadísticas y restablecer su estilo, para cuidarla y personalizarla aún más.
- **HU-9.** Como persona usuaria, quiero fijar el estilo de una página como predeterminado, para que mis páginas nuevas salgan ya con ese aspecto.
- **HU-10.** Como persona usuaria, quiero que portadas y estilos se respalden y se restauren con la página, para no perder nada al cambiar de equipo.

---

## 4. Requisitos funcionales

### RF-1 Cabecera tipo tarjeta

- **RF-1.1** El sistema deberá permitir, por página, mostrar el **título sobre la portada**. Si se desactiva, la cabecera vuelve al estilo clásico (portada arriba, título debajo).
- **RF-1.2** El sistema deberá permitir a cada página una **descripción** opcional de una o dos líneas, editable en el lugar, que se muestra bajo el título.
- **RF-1.3** El sistema deberá permitir activar por separado cada pieza de la cabecera: **etiqueta**, **fecha de actualización**, **descripción**, **ícono que sobresale** del borde inferior de la portada (dentro de un cuadro claro redondeado, D-20), **degradado** y **esquinas redondeadas** (D-2).
- **RF-1.4** Donde la etiqueta esté activa, el sistema deberá mostrar el nombre del espacio o el texto propio que la persona escriba (D-13).
- **RF-1.5** Donde la fecha de actualización esté activa, el sistema deberá mostrar cuándo se editó la página por última vez, en forma relativa («Actualizado hoy», «hace 3 días») y con la fecha exacta al pasar el puntero o al enfocarla.
- **RF-1.6** Cuando la página no tenga portada, las piezas que dependen de ella (título sobre la portada, degradado, ícono que sobresale) no deberán mostrarse, y la cabecera deberá verse en el estilo clásico sin huecos.
- **RF-1.7** Mientras el título esté sobre la portada, el sistema deberá mostrar el título, la descripción, la etiqueta y la fecha con un color y una sombra que se lean sobre la imagen, y el botón «Cambiar portada» solo al pasar el puntero o enfocar la cabecera.
- **RF-1.8** El título y la descripción deberán seguir siendo editables en el lugar cuando estén sobre la portada.

### RF-2 Origen de la portada

- **RF-2.1** Cuando la persona elija «Cambiar portada», el sistema deberá ofrecer un selector con las pestañas **Subir**, **Unsplash** (solo si está activado), **Colores** y **Degradados**, además de **Quitar portada**.
- **RF-2.2** Cuando la persona suba una imagen (con el selector de archivos, arrastrándola o pegándola), el sistema deberá aceptar PNG, JPEG y WebP de hasta 20 MB, reducirla a un ancho máximo de 2560 px conservando la proporción, comprimirla y guardarla en el espacio (D-3).
- **RF-2.3** Si la imagen no es de un formato admitido, pesa más del límite o está dañada, entonces el sistema deberá rechazarla con un mensaje claro y dejar la portada anterior intacta.
- **RF-2.4** Donde Unsplash esté activado, el sistema deberá permitir buscar fotos por palabra, ver los resultados en miniatura y elegir una. Al elegirla, deberá descargarla una sola vez, optimizarla igual que en RF-2.2 y guardarla en el espacio.
- **RF-2.5** Cuando la portada venga de Unsplash, el sistema deberá guardar y mostrar el crédito del autor («Foto de *nombre* en Unsplash») y avisar a Unsplash de la descarga, como piden sus condiciones (D-14).
- **RF-2.6** Si no hay conexión, falta la clave de Unsplash o Unsplash responde con error o con el límite de peticiones agotado, entonces la pestaña deberá explicar el problema, y las demás pestañas deberán seguir funcionando.
- **RF-2.7** Las pestañas **Colores** y **Degradados** deberán ofrecer una paleta incluida y permitir un color propio. Los degradados deberán permitir al menos dos colores y su dirección.
- **RF-2.8** Cuando se reemplace o se quite una portada, la imagen anterior deberá conservarse mientras alguna página o la papelera la use, y deberá dejar de ocupar espacio cuando nadie la use.

### RF-3 Ajustes de la portada

- **RF-3.1** El sistema deberá permitir **reposicionar** la portada arrastrándola para elegir la parte visible, con «Guardar» y «Cancelar», y también con el teclado.
- **RF-3.2** El sistema deberá permitir elegir la **altura** de la portada: baja, media o alta.
- **RF-3.3** El sistema deberá permitir ajustar la **intensidad del oscurecido** (degradado sobre la imagen) desde nada hasta fuerte, con vista previa en vivo.
- **RF-3.4** El sistema deberá permitir ajustar el **redondeo de las esquinas** de la portada con un solo valor para las cuatro o con un valor distinto para cada esquina (D-4).
- **RF-3.5** Todos los cambios de portada deberán poder deshacerse y rehacerse como cualquier otra edición de la página.

### RF-4 Menú de opciones del archivo

- **RF-4.1** La página deberá mostrar arriba a la derecha un **botón de opciones** que abre un menú flotante (D-5), y que no deberá ocupar espacio del contenido.
- **RF-4.2** El menú deberá agrupar sus opciones en secciones: **Tipografía**, **Espaciado**, **Cabecera y portada**, **Índice** y **Página**.
- **RF-4.3** Cuando la persona cambie una opción, el sistema deberá aplicarla al instante a la página, sin recargarla.
- **RF-4.4** El menú deberá poder abrirse, recorrerse y cerrarse solo con el teclado, y deberá cerrarse con Esc o al hacer clic fuera, devolviendo el foco al botón.
- **RF-4.5** Las opciones de estilo deberán ser **de la página**: se conservan con ella, viajan en el respaldo y se restauran (HU-10).
- **RF-4.6** Cuando la persona deshaga o rehaga un cambio hecho desde el menú, el sistema deberá revertirlo o reaplicarlo como cualquier otra edición de la página (D-19).

### RF-5 Tipografía

- **RF-5.1** El sistema deberá incluir el **catálogo de 10 familias tipográficas** de D-16, agrupadas por tipo (sans, serif, monoespaciada, lectura, manuscrita), que funcionen sin internet (D-6).
- **RF-5.2** El menú deberá permitir elegir la fuente del **texto** y la de los **títulos** de la página por separado (D-12), y cada opción deberá mostrarse escrita con su propia fuente.
- **RF-5.3** Cada opción de tipografía deberá incluir «Predeterminado», que sigue el ajuste global de apariencia (D-11).

### RF-6 Espaciado

- **RF-6.1** El sistema deberá permitir elegir el **ancho del contenido**: estrecho, normal, ancho o completo. Esta opción **sustituye** al interruptor de ancho completo de la spec 002 (RF-10.3).
- **RF-6.2** Cuando se abra una página que tenía activado el ancho completo de la spec 002, su ancho de contenido deberá quedar en «completo», sin que la persona tenga que hacer nada.
- **RF-6.3** El sistema deberá permitir elegir el **tamaño de texto** de la página: pequeño, normal o grande.
- **RF-6.4** El sistema deberá permitir elegir el **interlineado y la separación entre bloques**: compacto, normal o amplio.
- **RF-6.5** Cada opción de espaciado deberá incluir «Predeterminado», que sigue el ajuste global (D-11).

### RF-7 Índice

- **RF-7.1** Donde el índice flotante esté activado en una página, el sistema deberá mostrar en el margen derecho la lista de sus encabezados, con sangría según su nivel.
- **RF-7.2** Mientras la persona se desplaza por la página, el índice flotante deberá resaltar la sección visible.
- **RF-7.3** Cuando la persona elija una entrada del índice (flotante o bloque), el sistema deberá llevarla al encabezado correspondiente.
- **RF-7.4** El sistema deberá permitir insertar un **bloque de índice** desde el menú de bloques, con la lista de encabezados de la página como enlaces.
- **RF-7.5** Cuando cambien, se agreguen o se borren encabezados, los dos índices deberán actualizarse solos.
- **RF-7.6** Si la página no tiene encabezados, entonces el índice flotante no deberá mostrarse y el bloque de índice deberá mostrar un aviso discreto («Agrega encabezados para ver el índice»).
- **RF-7.7** Si no hay espacio suficiente en el margen derecho, entonces el índice flotante deberá reducirse a una marca discreta que lo despliega al pasar el puntero, al enfocarla o al tocarla.
- **RF-7.8** El menú deberá permitir elegir los niveles que entran en el índice: «hasta H1», «hasta H2» o «hasta H3» (por defecto). El ajuste se aplica al índice flotante y a todos los bloques de índice de la página (D-18).

### RF-8 Opciones de página

- **RF-8.1** El sistema deberá permitir **bloquear la página**. Mientras esté bloqueada, su contenido, título, cabecera y portada no deberán poder editarse, deberá verse un indicador de bloqueo y deberá poder desbloquearse desde el indicador o desde el menú.
- **RF-8.1.1** Mientras una página bloqueada pertenezca a una base de datos, sus propiedades deberán poder seguir cambiándose desde las vistas de la base (tabla, tablero…), incluido moverla de columna (D-17).
- **RF-8.2** El sistema deberá permitir elegir un **color de acento** de la página, solo de la paleta incluida (D-21), que se aplica a enlaces, casillas, resaltados y al índice de esa página.
- **RF-8.3** El menú deberá mostrar las **estadísticas** de la página: palabras, caracteres, tiempo estimado de lectura, fecha de creación y fecha de última edición.
- **RF-8.4** Cuando la persona elija **«Restablecer estilo»**, el sistema deberá devolver todas las opciones de estilo de la página a los valores predeterminados, sin tocar su contenido, y el cambio deberá poder deshacerse.
- **RF-8.5** Cuando la persona elija **«Usar como predeterminado»**, el sistema deberá guardar el estilo de la página como predeterminado del espacio. Las páginas nuevas partirán de él y las existentes no cambiarán.

### RF-9 Ajustes y privacidad de Unsplash

- **RF-9.1** El sistema deberá incluir en Ajustes un interruptor para **activar Unsplash**, apagado por defecto, con una explicación de qué datos salen del equipo.
- **RF-9.2** Cuando la persona active Unsplash, el sistema deberá pedir la clave de la API y guardarla solo en el llavero del sistema, nunca en el espacio, en el respaldo, en registros ni en archivos de configuración.
- **RF-9.3** Mientras Unsplash esté activado, lo único que deberá salir del equipo hacia Unsplash son los términos de búsqueda, la clave y las peticiones de descarga de las fotos elegidas. Nunca el contenido ni los datos de las páginas.
- **RF-9.4** Mientras Unsplash esté desactivado, la aplicación no deberá conectarse a Unsplash en ningún momento.

---

## 5. Requisitos no funcionales

| ID | Tipo | Requisito |
|---|---|---|
| **RNF-1** | **Funcionamiento sin internet** | Todo lo de esta spec funciona sin conexión, salvo buscar y descargar en Unsplash. Las portadas ya elegidas, incluidas las de Unsplash, se ven sin internet. |
| **RNF-2** | **Privacidad** | Sin Unsplash activado, la prueba de privacidad de la spec 001 sigue pasando sin cambios. Con Unsplash activado, solo hay conexiones a Unsplash (RF-9.3). |
| **RNF-3** | **Accesibilidad** | El menú, el selector de portada, el reposicionado y el índice se usan por completo con teclado y lector de pantalla. Los textos sobre la portada mantienen un contraste mínimo AA con el oscurecido predeterminado. Los objetivos táctiles miden al menos 44 px. |
| **RNF-4** | **Rendimiento** | El menú se abre en menos de 100 ms. Optimizar una imagen de 20 MB no congela la interfaz y muestra progreso. Cambiar una opción de estilo se refleja en menos de 100 ms. |
| **RNF-5** | **Datos y respaldo** | Las portadas y las opciones de estilo se respaldan y restauran sin pérdida. La salida del respaldo sigue siendo determinista: la misma imagen produce siempre el mismo archivo, y un respaldo sin cambios no genera commit. Los respaldos anteriores a esta spec siguen restaurándose, con el estilo predeterminado. |
| **RNF-6** | **Tamaño** | El catálogo de fuentes no añade más de 5 MB a la aplicación (subconjunto latino). Cada portada optimizada pesa normalmente menos de 1 MB. |
| **RNF-7** | **Idioma** | Todos los textos nuevos están en español de México y en inglés (i18n). |
| **RNF-8** | **Exportación** | Al exportar a Markdown, la descripción y el bloque de índice se exportan como texto legible. Las opciones de estilo, que no tienen equivalente en Markdown, viajan solo en el JSON. |

---

## 6. Casos límite

| ID | Caso | Comportamiento esperado |
|---|---|---|
| CL-1 | Imagen muy pequeña (por ejemplo, 300 px de ancho) | Se acepta sin agrandarla y se avisa que puede verse borrosa. |
| CL-2 | Imagen vertical o muy panorámica | Se recorta a la cabecera según el encuadre elegido; el reposicionado permite elegir qué parte se ve. |
| CL-3 | Imagen muy clara con el título encima y oscurecido en «nada» | Se permite, pero el menú avisa que el título puede no leerse y sugiere subir el oscurecido. |
| CL-4 | Título o descripción muy largos sobre la portada | El título se ajusta en varias líneas y la cabecera crece. La descripción se corta en dos líneas con puntos suspensivos y se ve completa al editarla. |
| CL-5 | La misma imagen se usa como portada en varias páginas | Se guarda una sola vez. Quitarla de una página no la quita de las demás. |
| CL-6 | Una página con portada va a la papelera y luego se restaura | La portada se conserva mientras la página esté en la papelera y vuelve con ella. |
| CL-7 | Se pega una imagen desde el portapapeles o se arrastra un archivo sobre la cabecera | Se trata igual que subirla (RF-2.2). |
| CL-8 | Se pierde la conexión mientras se descarga una foto de Unsplash | La portada anterior no cambia y se avisa que la descarga falló. |
| CL-9 | Se revoca o se borra la clave de Unsplash del llavero | La pestaña Unsplash pide la clave de nuevo; las portadas ya guardadas no se ven afectadas. |
| CL-10 | Se desactiva Unsplash con páginas que ya usan fotos de Unsplash | Las fotos siguen viéndose con su crédito; solo se oculta la búsqueda. |
| CL-11 | La página bloqueada se intenta editar con un atajo, al pegar o al arrastrar | No cambia nada y se muestra el indicador de bloqueo. |
| CL-12 | El índice flotante en una página con cientos de encabezados | El índice se desplaza por su cuenta y la página no se vuelve lenta. |
| CL-13 | Encabezados con el mismo texto | Cada entrada del índice lleva a su propio encabezado. |
| CL-14 | Se restaura un respaldo hecho antes de esta spec | Las páginas se ven en el estilo clásico; las que tenían ancho completo quedan con ancho «completo». |
| CL-15 | Un respaldo de esta spec se abre en una versión anterior de la app | Se aplica el comportamiento de versión no soportada de la spec 001: avisar sin modificar nada. |
| CL-16 | Una fuente del catálogo no carga | Se usa una alternativa de la misma familia incluida, como en el CL-27 de la spec 002. |
| CL-17 | Pantalla estrecha o móvil | La cabecera tipo tarjeta se adapta al ancho, el índice flotante pasa a la forma reducida (RF-7.7) y el menú ocupa el ancho disponible. |

---

## 7. Fuera de alcance

- Subir fuentes propias o usar las fuentes instaladas en el sistema.
- Márgenes laterales independientes del ancho del contenido.
- Otros bancos de imágenes (Pexels, Pixabay…) o generar portadas con IA.
- Portadas animadas (GIF, video) y edición de imagen (filtros, recorte libre, rotación).
- Estilos por bloque (fuente o tamaño de un párrafo concreto) y color de fondo de la página.
- Plantillas de página con estilo y temas completos por página.
- Bloqueo con contraseña o con permisos: el bloqueo solo evita ediciones accidentales.
- Cambiar los ajustes globales de apariencia de la spec 002 (siguen igual; esta spec solo añade opciones por página encima).

---

## 8. Criterios de finalización

1. **Cabecera tipo tarjeta:** una página puede verse como la captura de referencia, y cada pieza (etiqueta, fecha, descripción, ícono, degradado, esquinas, título sobre la portada) se activa y desactiva por separado (RF-1).
2. **Portadas:** se puede usar una imagen subida, una foto de Unsplash, un color o un degradado, y los errores no tocan la portada anterior (RF-2).
3. **Ajustes de portada:** encuadre, altura, oscurecido y redondeo (juntas y por esquina) funcionan y se pueden deshacer (RF-3).
4. **Menú:** el botón de opciones abre el menú con sus cinco secciones, que funciona con ratón, teclado y lector de pantalla (RF-4, RNF-3).
5. **Tipografía y espaciado:** fuentes de texto y títulos, ancho, tamaño de texto e interlineado se aplican al instante, y el ancho completo anterior se conserva como «completo» (RF-5, RF-6).
6. **Índice:** el índice flotante y el bloque de índice se actualizan solos y llevan a cada encabezado (RF-7).
7. **Opciones de página:** bloquear, color de acento, estadísticas, restablecer estilo y «Usar como predeterminado» funcionan como se describe (RF-8).
8. **Unsplash y privacidad:** Unsplash está apagado por defecto, su clave solo vive en el llavero y, apagado, la prueba de privacidad pasa sin cambios (RF-9, RNF-2).
9. **Respaldo:** portadas y estilos se respaldan y restauran sin pérdida, la salida es determinista y los respaldos anteriores siguen restaurándose (RNF-5, CL-14).
10. **Calidad:** `bun run typecheck` y `bun run test` pasan, y hay pruebas para cada regla de datos nueva (optimización de imagen, respaldo, migración del ancho completo, índice).

---

## 9. Dudas abiertas

No quedan dudas abiertas. Todas se resolvieron con la persona responsable el 16 de noviembre de 2026:

| ID | Duda | Resolución |
|---|---|---|
| DA-1 | Copia local de Unsplash frente a sus condiciones, que piden mostrar las fotos desde sus enlaces. | Copia local con aviso de descarga y crédito; riesgo aceptado (D-14). |
| DA-2 | Redacción de la enmienda a la constitución. | Excepción nombrada solo para Unsplash en el artículo 6 (D-15), ya aplicada. |
| DA-3 | Fuentes del catálogo. | Lista de 10 familias OFL (D-16). Que quepan en el límite de RNF-6 se comprueba en el plan. |
| DA-4 | Bloqueo y propiedades en bases de datos. | Las propiedades se editan desde la base (D-17). |
| DA-5 | Niveles del índice. | H1 a H3, con opción de limitarlo (D-18). |
| DA-6 | Supuestos S-1 a S-4. | Confirmados; ahora son D-10 a D-13. |
