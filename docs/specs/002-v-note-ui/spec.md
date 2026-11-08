# Especificación 002 — Estándar de diseño UI/UX de v-note

> **Estado:** implementada y cerrada el 4 de noviembre de 2026 · **Segunda parte de v-note** (la primera es `specs/001-v-note-mvp`).
> **Alcance de este documento:** el QUÉ y el POR QUÉ. No define tecnología, arquitectura ni archivos: eso va en el plan.
> **Referencia visual:** el mockup «Atelier Notes» (24 pantallas en modo claro y oscuro, más su guía de estilos). Es una referencia visual, no una especificación literal (ver decisión D-2).
> **Notación:** los criterios usan EARS en español (*Cuando… el sistema deberá…*, *Mientras…*, *Si… entonces…*, *Donde…*). Las dudas se marcaban con **[NECESITA ACLARACIÓN]** y quedaron resueltas en la sección 9.

---

## 1. Contexto y objetivo

### Contexto
v-note ya cumple su primera parte: es un cuaderno personal, local-first y de un solo usuario, con editor de bloques, bases de datos, tableros, recordatorios, diagramas, exportación y respaldo. Funciona, pero su interfaz se construyó para demostrar funciones, no para transmitir calidad: los componentes se ven y se comportan de forma distinta según la pantalla, los avisos y errores aparecen de maneras diferentes, y no existe una identidad visual.

La constitución del proyecto fija el marco: un solo usuario, sin cuentas ni sincronización, **sin servicios de terceros** y textos en español de México con soporte de inglés. Esta spec debe respetarlo: el diseño no puede apoyarse en recursos que se descarguen de internet ni mostrar funciones que el producto no tiene.

### Objetivo
Definir un **estándar de diseño de interfaz y experiencia** —valores, reglas y comportamientos— y aplicarlo a toda la aplicación para que v-note se vea y se sienta como un producto profesional, coherente y agradable de usar a diario, en claro y en oscuro, en web y en escritorio.

### Por qué
- Una persona escribe y planea en esta herramienta muchas horas al día: la calidad de la lectura, el contraste y la fluidez importan más que el adorno.
- Un estándar único evita decidir de nuevo cada detalle en cada pantalla y hace que lo nuevo nazca consistente.
- Una buena imagen (identidad, estados vacíos, bienvenida) hace que el sistema inspire confianza al guardar información personal.

### Decisiones ya tomadas (con la persona responsable del producto)
| ID | Decisión |
|---|---|
| D-1 | Lo colaborativo que muestra el mockup (Compartir, Invitar miembros, permisos y roles, avatares de otras personas, comentarios, «Actualizaciones») **queda fuera por completo**: no hay controles ni marcadores desactivados. |
| D-2 | El mockup es **referencia visual; manda el estándar**. Se conserva su identidad (calidez, paleta, radios, tipografía) y se corrige cualquier valor que incumpla accesibilidad o buenas prácticas, documentando el ajuste. |
| D-3 | Alcance: **rediseño + ajustes de apariencia + vistas nuevas del mockup** (calendario semanal por horas, crear tarea con horario, tabla de contenidos). |
| D-4 | Tamaños: **escritorio y ventanas estrechas**. Sin diseño para teléfono. |
| D-5 | Identidad: **logotipo, ícono de la aplicación, pantalla de bienvenida y estados vacíos**, sobre el nombre actual; cambiar el nombre no debe romper el diseño. |
| D-6 | Errores y avisos: **sistema unificado por gravedad** (ver RF-11). |
| D-7 | Accesibilidad: **AA en todo + «reducir movimiento» + zoom al 200 %**. |
| D-8 | Entregable del estándar: **guía de estilo escrita + catálogo de componentes consultable**, pensado para quien desarrolla (no es una pantalla para la persona usuaria final). |
| D-9 | Ajustes de apariencia: **globales del dispositivo**; el **ancho completo es por página** y viaja con ella en el respaldo. |

---

## 2. Usuarios

| Usuario | Descripción | Qué necesita del diseño |
|---|---|---|
| **Persona usuaria (única)** | Usa v-note a diario para escribir, organizar y planear, en escritorio o navegador, con teclado y ratón. | Lectura cómoda y prolongada, orientación clara, acciones donde las espera, respuesta inmediata, confianza al borrar o fallar. |
| **Persona con necesidades de accesibilidad** | Usa solo teclado, lector de pantalla, zoom alto o reduce el movimiento. | Contraste suficiente, foco visible, etiquetas, utilizable al 200 % de zoom, sin animaciones forzadas. |
| **Quien desarrolla y mantiene el producto** | Añade pantallas y componentes nuevos. | Un estándar claro, valores únicos y un catálogo para revisar sin adivinar. |

---

## 3. Historias de usuario

- **HU-1.** Como persona usuaria, quiero que la aplicación se vea igual de cuidada en modo claro y oscuro, para trabajar de día o de noche sin fatiga.
- **HU-2.** Como persona usuaria, quiero una barra lateral y una cabecera que no cambien de lugar entre pantallas, para orientarme sin pensar.
- **HU-3.** Como persona usuaria, quiero que escribir una página sea agradable —ancho de lectura, jerarquía tipográfica, bloques bien diferenciados—, para concentrarme en el contenido.
- **HU-4.** Como persona usuaria, quiero ver y gestionar mis bases de datos y tableros con claridad (filtros visibles, tarjetas legibles), para entender mi trabajo de un vistazo.
- **HU-5.** Como persona usuaria, quiero un calendario mensual y uno semanal por horas, y crear una tarea con horario rápido, para planear mi semana.
- **HU-6.** Como persona usuaria, quiero que los errores me expliquen qué pasó y qué hacer, y que borrar siempre pueda deshacerse o confirmarse, para no temer perder información.
- **HU-7.** Como persona usuaria, quiero ajustar la tipografía, la densidad y el ancho de lectura a mi gusto, para que la herramienta se adapte a mí.
- **HU-8.** Como persona con necesidades de accesibilidad, quiero usar todo con teclado, con zoom alto y sin animaciones, para trabajar con la misma comodidad.
- **HU-9.** Como persona usuaria, quiero que, la primera vez que abro la app o una sección vacía, se me oriente con claridad, para saber cómo empezar.
- **HU-10.** Como quien desarrolla, quiero una guía de estilo y un catálogo de componentes, para construir pantallas nuevas sin romper la coherencia.

---

## 4. Requisitos funcionales

### RF-1 — Sistema de diseño (valores fundamentales)
Un conjunto único de valores de diseño gobierna toda la interfaz: color, tipografía, espaciado, radios, elevación, iconografía y movimiento.

- **RF-1.1** El sistema deberá definir una escala de color con nombres semánticos (superficie, texto principal, texto secundario, borde, acento, éxito, advertencia, peligro) con un valor para modo claro y otro para modo oscuro.
- **RF-1.2** El sistema deberá definir una escala tipográfica con niveles nombrados (título de página, encabezado de sección, encabezado de componente, texto de lectura, texto de interfaz, nota y etiqueta) con tamaño, interlineado y peso para cada uno.
- **RF-1.3** El sistema deberá usar una cuadrícula de espaciado de base 4 px y no deberá emplear separaciones fuera de ella.
- **RF-1.4** El sistema deberá definir un conjunto cerrado de radios de borde (ninguno, mínimo, base, medio, grande, circular) y asignar a cada tipo de elemento el que le corresponde.
- **RF-1.5** El sistema deberá expresar la elevación en modo claro con bordes y sombras sutiles y en modo oscuro con escalones de luminosidad de las superficies y microbordes, sin sombras difusas.
- **RF-1.6** El sistema deberá usar un único conjunto de íconos con trazo, tamaño y estilo uniformes.
- **RF-1.7** El sistema deberá definir duraciones y curvas de transición estándar para los cambios de estado (pasar el cursor, abrir y cerrar paneles, cambiar de tema).
- **RF-1.8** Cuando un valor de diseño del mockup incumpla un criterio de accesibilidad de esta spec (RF-14), el estándar deberá sustituirlo por el valor corregido más cercano y documentar el ajuste y su motivo.
- **RF-1.9** El sistema no deberá descargar tipografías, íconos ni imágenes de internet: todo recurso visual deberá estar incluido en la aplicación (constitución, art. 6).

*Por qué:* sin valores únicos cada pantalla decide por su cuenta y la coherencia se pierde.

### RF-2 — Temas claro y oscuro
- **RF-2.1** El sistema deberá ofrecer tres modos de tema: claro, oscuro y seguir al sistema.
- **RF-2.2** El modo claro deberá usar fondos cálidos tipo papel (no blanco puro) y el modo oscuro, superficies carbón de baja luminancia con acentos reconocibles.
- **RF-2.3** Mientras el tema sea «seguir al sistema», cuando el sistema cambie entre claro y oscuro, el sistema deberá cambiar de tema en el momento, sin recargar ni perder el contexto.
- **RF-2.4** Cuando la aplicación se abra, el sistema deberá mostrar el tema correcto desde el primer cuadro, sin un destello del tema contrario.
- **RF-2.5** El sistema deberá ofrecer cada pantalla, componente y estado en los dos temas con el mismo nivel de acabado y de contraste.
- **RF-2.6** Cuando una persona haya aplicado a un texto o fondo un color de bloque (por ejemplo, rojo o amarillo), el sistema deberá mostrarlo con una variante legible en el tema activo, de modo que el texto siga cumpliendo el contraste mínimo en claro y en oscuro.
- **RF-2.7** Cuando una imagen insertada tenga fondo claro en modo oscuro, el sistema no deberá alterarla; deberá presentarla sin deslumbrar (por ejemplo, con un marco o margen neutro).

### RF-3 — Estructura de la ventana
- **RF-3.1** El sistema deberá organizar toda pantalla en una barra lateral izquierda, una cabecera superior y un área de contenido.
- **RF-3.2** El sistema deberá mantener la barra lateral y la cabecera en las mismas posiciones y proporciones en todas las pantallas, de modo que al cambiar de vista solo cambie el contenido.
- **RF-3.3** El sistema deberá permitir mostrar u ocultar la barra lateral con un control visible y con un atajo de teclado, y deberá recordar el estado.
- **RF-3.4** La cabecera deberá mostrar la ruta de la página actual (migas de pan) y el estado de guardado (por ejemplo, «Guardado» o «Guardando…»).
- **RF-3.5** El área de contenido de una página deberá limitar el ancho de las líneas de lectura a un máximo cómodo, salvo que la página esté en ancho completo (RF-10.3).

### RF-4 — Barra lateral y navegación
- **RF-4.1** La barra lateral deberá mostrar, de arriba abajo: el espacio de trabajo activo con su selector, el acceso a búsqueda (con su atajo visible), los favoritos, el árbol de páginas, y los accesos secundarios (captura rápida, grafo, importar, recordatorios, respaldo, ajustes, papelera).
- **RF-4.2** El árbol de páginas deberá distinguir con claridad la página activa, las páginas con hijas (con indicador de plegar y desplegar) y el tipo de página (nota, base de datos, tablero).
- **RF-4.3** Cuando la persona pase el cursor sobre un elemento de la barra lateral, el sistema deberá mostrar sus acciones contextuales (por ejemplo, crear subpágina) sin desplazar el texto.
- **RF-4.4** El sistema deberá mostrar los accesos secundarios agrupados y con una jerarquía visual menor que las páginas, para que el contenido sea lo protagonista.
- **RF-4.5** El sistema no deberá mostrar «Invitar miembros», «Actualizaciones» ni cuentas de otras personas (D-1).

### RF-5 — Página y editor
- **RF-5.1** Una página deberá mostrar, de forma consistente: portada opcional, ícono opcional, título grande editable y, debajo, la fila de datos de la página.
- **RF-5.2** La fila de datos de una página deberá mostrar únicamente información real del producto: fecha de la última edición y etiquetas (RF-5.9). No deberá mostrar propietario ni autoría.
- **RF-5.3** El texto de lectura deberá usar la escala tipográfica definida y un interlineado que favorezca la lectura prolongada.
- **RF-5.4** Cuando la persona escriba `/` en una línea vacía, el sistema deberá abrir el menú de bloques con grupos nombrados, ícono, nombre, descripción corta y atajo de cada bloque, con navegación por teclado y búsqueda por texto.
- **RF-5.5** Cuando la persona seleccione texto, el sistema deberá mostrar una barra de formato flotante con las acciones de formato disponibles (negrita, cursiva, subrayado, tachado, código, enlace, color y resaltado) y un menú para convertir el bloque.
- **RF-5.6** El sistema deberá dar a cada tipo de bloque una presentación coherente con el estándar: citas, avisos destacados (informativo, advertencia, éxito, error), listas de verificación, bloques de código con lenguaje y botón de copiar, tablas, imágenes con pie, desplegables y tarjetas de enlace.
- **RF-5.7** Cuando la persona pase el cursor sobre un bloque, el sistema deberá mostrar su asa de arrastre y su acción de insertar, sin que aparezcan en reposo.
- **RF-5.8** Cuando una página tenga tres o más encabezados, el sistema deberá ofrecer una **tabla de contenidos** que permita ir a cada sección y marque la sección visible. Si la página tiene menos de tres encabezados, no deberá mostrarla.
- **RF-5.9** El sistema deberá permitir asignar **etiquetas** a una página y mostrarlas como chips de color (ver DA-2).

### RF-6 — Bases de datos y tableros
- **RF-6.1** Una base de datos deberá mostrar su título, sus vistas como pestañas (tabla, tablero, lista, galería, calendario, línea de tiempo) y, debajo, la barra de filtros y orden.
- **RF-6.2** La barra de filtros deberá mostrar los filtros, el orden y la agrupación activos como chips legibles que se puedan quitar con un clic, y un campo de búsqueda por palabra clave.
- **RF-6.3** La vista de tabla deberá mantener fijas las cabeceras de columna, distinguir filas por hover y selección, y permitir editar las celdas en su lugar con un editor acorde al tipo.
- **RF-6.4** El tablero deberá mostrar columnas con su nombre, su color de estado y su conteo de tarjetas, y tarjetas con título, fecha límite, indicador de recordatorio y etiquetas.
- **RF-6.5** Mientras una tarjeta se arrastre, el sistema deberá indicar con claridad dónde caerá y deberá mostrar la columna destino resaltada.
- **RF-6.6** El sistema no deberá mostrar puntos de historia, velocidad de sprint, personas asignadas ni resúmenes de capacidad (D-1; no existen en el producto).
- **RF-6.7** Cuando una vista no tenga filas, el sistema deberá mostrar un estado vacío con la acción para crear la primera (RF-12).

### RF-7 — Calendarios y cronograma
- **RF-7.1** El sistema deberá ofrecer la vista **mensual** como rejilla de semanas con el día actual destacado, los eventos de cada día legibles y un indicador cuando haya más eventos de los que caben.
- **RF-7.2** El sistema deberá ofrecer una vista **semanal por franjas horarias** con cabecera de día, el día actual destacado, una línea que marque la hora actual y los eventos colocados según su hora de inicio y duración (ver DA-1).
- **RF-7.3** Cuando dos eventos coincidan en horario, el sistema deberá mostrarlos uno junto al otro sin taparse.
- **RF-7.4** Cuando una tarea tenga fecha pero no hora, el sistema deberá mostrarla en una franja de «Todo el día» en la vista semanal.
- **RF-7.5** El sistema deberá ofrecer la **línea de tiempo** (cronograma) con barras por rango, agrupación jerárquica y un panel lateral de detalle al seleccionar un elemento.
- **RF-7.6** Cuando la persona arrastre un evento a otro día u hora, el sistema deberá actualizar su fecha u hora y mostrar el cambio de inmediato.
- **RF-7.7** El sistema deberá ofrecer navegación entre periodos (anterior, siguiente, hoy) y cambiar entre las vistas de calendario sin perder el periodo mostrado.

### RF-8 — Crear tarea con horario
- **RF-8.1** Cuando la persona elija crear una tarea desde el calendario (por ejemplo, haciendo clic en una franja), el sistema deberá abrir un modal con título, fecha, hora de inicio, hora de fin o duración, recordatorio y repetición, con la fecha y la hora de la franja elegida ya rellenas.
- **RF-8.2** El modal deberá permitir guardar con el teclado (Enter) y cancelar con Escape, y el foco deberá quedar atrapado dentro mientras esté abierto.
- **RF-8.3** Si la hora de fin es anterior a la de inicio, entonces el sistema deberá avisarlo junto al campo y no deberá permitir guardar hasta corregirlo.
- **RF-8.4** Si el recordatorio queda en el pasado, entonces el sistema deberá avisarlo, como ya hace el producto, y ofrecer guardar como vencida o cambiar la hora.
- **RF-8.5** Cuando la tarea se guarde, el sistema deberá mostrarla en el calendario en el acto.

### RF-9 — Búsqueda y paleta de comandos
- **RF-9.1** Cuando la persona abra la paleta, el sistema deberá mostrarla centrada sobre un velo, con el campo de búsqueda enfocado, y listar las páginas recientes y las acciones comunes agrupadas.
- **RF-9.2** Mientras la persona escriba, el sistema deberá mostrar resultados en vivo con la coincidencia resaltada, el tipo de cada resultado y su ubicación, y permitir recorrerlos con las flechas y abrirlos con Enter.
- **RF-9.3** El sistema deberá mostrar los atajos de teclado junto a cada acción que lo tenga.
- **RF-9.4** Si la búsqueda no encuentra nada, entonces el sistema deberá decirlo con un mensaje claro y sugerir crear una página con ese texto.
- **RF-9.5** Cuando la persona cierre la paleta, el sistema deberá devolver el foco al elemento que lo tenía.

### RF-10 — Ajustes de apariencia
- **RF-10.1** El sistema deberá ofrecer, en Ajustes, la elección de **tema** (claro, oscuro, sistema), **familia tipográfica** del contenido (sans, serif, mono) y **densidad** (cómoda o compacta).
- **RF-10.2** Cuando la persona cambie un ajuste, el sistema deberá aplicarlo de inmediato en toda la aplicación y conservarlo al reiniciar. Estos ajustes serán **del dispositivo**: no formarán parte de las páginas ni del respaldo (D-9).
- **RF-10.3** El sistema deberá permitir activar el **ancho completo** en cada página. Este ajuste será **de la página**, se conservará con ella y formará parte de su respaldo y de su restauración (D-9).
- **RF-10.4** La densidad compacta deberá reducir el espaciado vertical de listas, tablas y bloques sin bajar el tamaño del texto por debajo del mínimo de RF-14.
- **RF-10.5** El sistema deberá incluir en Ajustes una vista previa del efecto de la tipografía y la densidad elegidas.
- **RF-10.6** El sistema no deberá ofrecer ajustes de membresías, permisos ni perfil de otras personas (D-1).

### RF-11 — Avisos, errores y confirmaciones (sistema unificado por gravedad)
- **RF-11.1** Cuando una acción termine bien y sea de bajo riesgo (por ejemplo, duplicar o mover una página), el sistema deberá mostrar una confirmación breve y temporal, y deberá ofrecer **Deshacer** cuando la acción pueda revertirse.
- **RF-11.2** Cuando ocurra un error que la persona pueda atender, el sistema deberá mostrarlo de forma **persistente en el lugar donde ocurrió**, con la causa en lenguaje claro y un botón de reintento o una acción de solución. El aviso no deberá desaparecer por sí solo.
- **RF-11.3** Cuando una acción sea destructiva o irreversible (borrado definitivo, vaciar la papelera, eliminar un espacio, reemplazar un espacio al restaurar), el sistema deberá pedir confirmación explícita en un diálogo que nombre lo que se afectará y diga qué sucederá.
- **RF-11.4** Cuando la acción pase a la papelera y pueda restaurarse, el sistema deberá preferir la confirmación temporal con **Deshacer** a un diálogo previo.
- **RF-11.5** Cuando haya varios avisos temporales a la vez, el sistema deberá apilarlos sin taparse ni cubrir controles importantes, y deberá poder cerrar cada uno.
- **RF-11.6** Los avisos deberán ser accesibles: anunciarse a los lectores de pantalla con la urgencia adecuada y poder cerrarse con teclado.
- **RF-11.7** Todo mensaje deberá estar en español de México con soporte de inglés, sin códigos técnicos ni textos en inglés mezclados.
- **RF-11.8** Cuando un error afecte a toda la aplicación (por ejemplo, el espacio no se puede abrir), el sistema deberá mostrar una pantalla de error con la causa y las opciones para recuperarse, y nunca una pantalla en blanco.

### RF-12 — Estados vacíos, de carga y sin conexión
- **RF-12.1** Cuando una lista, vista o sección no tenga contenido, el sistema deberá mostrar un estado vacío con ilustración o ícono de la identidad, una frase que explique qué irá ahí y la acción principal para empezar.
- **RF-12.2** Cuando la primera apertura de la aplicación no encuentre ningún espacio de trabajo, el sistema deberá mostrar una **pantalla de bienvenida** con el logotipo, una frase de presentación y las dos rutas de arranque: crear un espacio o restaurar desde un respaldo.
- **RF-12.3** Mientras una operación tarde más de un instante (cargar una página grande, importar, exportar, respaldar), el sistema deberá mostrar un indicador de progreso coherente con el resto; si se conoce el avance, deberá mostrarlo.
- **RF-12.4** Cuando el contenido de una pantalla se esté cargando, el sistema deberá reservar el espacio con un esqueleto neutro para evitar saltos de diseño.
- **RF-12.5** Mientras no haya conexión a internet, el sistema deberá seguir funcionando con normalidad y no deberá mostrar errores por ello; solo las funciones que la necesiten (respaldo, aviso de versión) deberán indicarlo en su propio contexto.

### RF-13 — Identidad visual
- **RF-13.1** El sistema deberá tener un **logotipo** y un **ícono de aplicación** reconocibles, legibles a tamaños pequeños, que funcionen sobre fondos claros y oscuros.
- **RF-13.2** El logotipo y el ícono deberán componerse a partir del nombre del producto definido en la configuración, de modo que cambiar el nombre no obligue a rediseñar pantallas.
- **RF-13.3** El ícono deberá ofrecerse con los tamaños y formatos que requiere cada plataforma de instalación (escritorio y navegador).
- **RF-13.4** El sistema deberá mostrar el logotipo en la pantalla de bienvenida y en el selector de espacio, y el nombre del producto en el título de la ventana.
- **RF-13.5** Los textos y las ilustraciones de bienvenida y de los estados vacíos deberán mantener el tono cálido y sobrio del estándar.

### RF-14 — Accesibilidad y movimiento
- **RF-14.1** El sistema deberá cumplir contraste de nivel AA en ambos temas: al menos 4,5:1 para texto normal y 3:1 para texto grande, íconos con significado y bordes de controles.
- **RF-14.2** El texto de lectura y de interfaz no deberá ser menor de 12 px; el texto de nota y etiquetas no deberá ser menor de 11 px y solo se usará para información complementaria.
- **RF-14.3** Todo elemento interactivo deberá tener un anillo de foco claramente visible, en ambos temas, que no dependa solo del color.
- **RF-14.4** Todo elemento interactivo deberá ofrecer un objetivo de clic de al menos 24 × 24 px (y 32 px en los controles principales).
- **RF-14.5** Toda la aplicación deberá poder usarse solo con teclado, con un orden de foco lógico y un enlace «Saltar al contenido».
- **RF-14.6** Los diálogos, menús y paneles deberán atrapar y devolver el foco correctamente y cerrarse con Escape.
- **RF-14.7** Todo control, ícono sin texto y región principal deberán tener nombre accesible para lectores de pantalla.
- **RF-14.8** Mientras el sistema operativo indique «reducir movimiento», el sistema deberá sustituir las animaciones de desplazamiento y escala por cambios inmediatos o desvanecimientos mínimos.
- **RF-14.9** El estado de un elemento (activo, error, completado, vencido) no deberá comunicarse únicamente con color: deberá acompañarse de texto, forma o ícono.
- **RF-14.10** Cuando la persona amplíe el zoom de la página o del texto hasta el 200 %, el sistema deberá seguir mostrando y permitiendo usar todas las funciones, sin texto cortado ni controles inalcanzables y sin desplazamiento horizontal en el contenido de lectura.
- **RF-14.11** Mientras el sistema operativo active un modo de contraste forzado, el sistema deberá seguir siendo utilizable, con bordes y foco visibles.

### RF-15 — Adaptación a tamaños de ventana
- **RF-15.1** El sistema deberá funcionar correctamente en ventanas desde un ancho mínimo de 900 px hasta pantallas grandes.
- **RF-15.2** Mientras la ventana sea más estrecha que el punto de plegado definido en el estándar, el sistema deberá plegar la barra lateral automáticamente y ofrecer abrirla como panel superpuesto.
- **RF-15.3** El sistema deberá adaptar las vistas anchas (tabla con muchas columnas, tablero, calendario semanal) con desplazamiento propio, sin deformar el resto de la pantalla.
- **RF-15.4** Cuando la ventana sea más estrecha que el ancho mínimo, el sistema deberá permitir el desplazamiento en lugar de comprimir o romper el diseño.
- **RF-15.5** El sistema no deberá ofrecer un diseño específico para teléfono ni tableta (D-4).

### RF-16 — Coherencia entre web y escritorio
- **RF-16.1** Las versiones web y de escritorio deberán verse y comportarse igual en todo lo que no dependa de la plataforma.
- **RF-16.2** Donde una función exista solo en escritorio (bandeja, atajo global, carpeta de datos), el sistema deberá ocultarla o explicarla en la web en lugar de mostrar controles muertos.
- **RF-16.3** El sistema deberá respetar las convenciones de cada plataforma en lo que sea esperado (por ejemplo, mostrar ⌘ en macOS y Ctrl en el resto, y los controles de ventana propios del sistema).

### RF-17 — Guía de estilo y catálogo de componentes
- **RF-17.1** El proyecto deberá incluir una **guía de estilo escrita** que documente cada valor de RF-1, los criterios de uso de cada componente, los ajustes hechos respecto del mockup (RF-1.8) y los principios de interacción.
- **RF-17.2** El proyecto deberá incluir un **catálogo de componentes consultable** que muestre cada componente en todos sus estados (reposo, hover, foco, activo, deshabilitado, error, carga, vacío) y en ambos temas.
- **RF-17.3** El catálogo deberá estar pensado para quien desarrolla y no deberá formar parte de la experiencia de la persona usuaria final.
- **RF-17.4** Toda pantalla y componente nuevos deberán construirse con los componentes y valores del estándar; cualquier excepción deberá documentarse en la guía.

### RF-18 — Coherencia de contenido y textos
- **RF-18.1** El sistema deberá usar una voz de interfaz uniforme (tono cercano y sobrio, verbos en infinitivo para acciones, mensajes de error que expliquen y orienten) en español de México, con paridad en inglés.
- **RF-18.2** Los componentes deberán tolerar textos más largos en inglés o en español sin romperse (ver CL-3).

---

## 5. Requisitos no funcionales

| ID | Requisito | Criterio medible |
|---|---|---|
| **RNF-1** | **Fluidez** | Las interacciones del estándar (abrir menús, cambiar de tema, plegar la barra lateral, arrastrar) responden en menos de 100 ms y las animaciones mantienen una tasa fluida (sin saltos visibles) en un equipo de gama media. |
| **RNF-2** | **Sin regresión de rendimiento** | Los presupuestos de la spec 001 (apertura de página, escritura, escala, fórmulas) se siguen cumpliendo después del rediseño. |
| **RNF-3** | **Accesibilidad** | Cero infracciones graves o críticas en la auditoría automática de todas las pantallas, en claro y oscuro; los puntos de RF-14 verificados además a mano en las pantallas principales. |
| **RNF-4** | **Consistencia** | Ningún valor de color, tamaño de texto, espaciado o radio fuera del sistema definido; toda pantalla usa los mismos componentes para lo mismo. |
| **RNF-5** | **Privacidad** | El diseño no introduce ninguna conexión externa (fuentes, íconos, imágenes, analítica): la prueba de privacidad de la spec 001 sigue pasando. |
| **RNF-6** | **Idioma** | Todo texto nuevo en español de México con paridad en inglés; ninguna cadena fija en un solo idioma. |
| **RNF-7** | **Mantenibilidad** | Cambiar un valor del sistema (por ejemplo, el color de acento) se hace en un solo lugar y se refleja en toda la aplicación. |
| **RNF-8** | **Funcionamiento sin conexión** | Todo el diseño funciona sin internet. |
| **RNF-9** | **Sin pérdida funcional** | Ninguna función existente de la spec 001 se pierde ni cambia de comportamiento por el rediseño, salvo los cambios que esta spec describe. |
| **RNF-10** | **Portabilidad** | El mismo diseño en Linux, Windows, macOS y navegadores modernos, con diferencias solo donde una plataforma lo exige (RF-16.3). |
| **RNF-11** | **Datos** | Los ajustes del dispositivo no afectan a los datos ni al respaldo; el ancho completo por página es el único dato nuevo del rediseño y debe conservarse en respaldo y restauración, y las copias de seguridad anteriores deberán seguir restaurándose (la página queda en ancho normal). |

---

## 6. Casos límite

| ID | Caso | Comportamiento esperado |
|---|---|---|
| CL-1 | Título de página muy largo (cientos de caracteres) | Se parte en varias líneas en la página y se trunca con puntos suspensivos y descripción completa al pasar el cursor en la barra lateral, migas y pestañas; nunca desborda ni empuja otros elementos. |
| CL-2 | Página o título sin texto | Se muestra «Sin título» con apariencia de marcador (más tenue), sin romper alturas ni alineación. |
| CL-3 | Textos más largos al traducir (inglés/español) | Botones, pestañas, chips y menús crecen o truncan con gracia; ningún texto queda cortado sin forma de leerlo completo. |
| CL-4 | Cambio de tema del sistema mientras se escribe | El tema cambia en el momento sin perder el foco, la selección ni el texto en curso. |
| CL-5 | Texto con color de bloque elegido en un tema y visto en otro | Sigue siendo legible en ambos (RF-2.6). |
| CL-6 | Zoom al 200 % o ventana en el ancho mínimo | Todo sigue siendo utilizable (RF-14.10, RF-15). |
| CL-7 | Árbol con miles de páginas y muchas hijas | La barra lateral sigue fluida, con sangría limitada para que los niveles profundos no se vuelvan inutilizables, y con ruta visible de la página activa. |
| CL-8 | Base de datos con muchas columnas (≥ 30) | La tabla se desplaza horizontalmente con la primera columna fija; las cabeceras siguen legibles. |
| CL-9 | Muchas etiquetas en una página o tarjeta | Se muestran las que caben y un indicador «+N» con acceso al resto. |
| CL-10 | Muchos eventos en un mismo día (mensual) | Se muestran los que caben y «+N más», que abre el listado del día. |
| CL-11 | Eventos que se solapan en horario (semanal) | Se colocan lado a lado sin taparse; si son demasiados, se agrupan con acceso al detalle. |
| CL-12 | Evento que cruza la medianoche o dura varios días | Se muestra continuo entre días en la vista semanal y como barra en la mensual. |
| CL-13 | Tarea sin hora en la vista semanal | Aparece en «Todo el día» (RF-7.4). |
| CL-14 | Cambio de zona horaria o de hora del sistema con el calendario abierto | Las horas se muestran en la hora local vigente y la línea de «ahora» se actualiza. |
| CL-15 | Hora de fin anterior a la de inicio, o duración de cero | No se guarda; el error se indica en el campo (RF-8.3). |
| CL-16 | Varios avisos a la vez (guardado, respaldo, recordatorio) | Se apilan sin tapar controles importantes; los de error persisten, los de éxito se retiran solos. |
| CL-17 | Un error de guardado se repite varias veces seguidas | Se muestra un solo aviso persistente con contador o estado actualizado, no una pila de duplicados. |
| CL-18 | Falla al guardar un ajuste de apariencia | El cambio se aplica en la sesión, se avisa que no se pudo conservar y se ofrece reintentar. |
| CL-19 | Primera apertura sin espacios, o sección sin datos | Pantalla de bienvenida o estado vacío con acción (RF-12). |
| CL-20 | Pérdida de conexión en mitad de un respaldo | El aviso se muestra en el panel de respaldo (no como error global) y el resto de la aplicación sigue igual. |
| CL-21 | Contenido o bloque de un tipo que no se puede mostrar (dañado o no soportado) | Se muestra un marcador neutro y explicativo en su lugar, sin romper la página ni ocultar el resto. |
| CL-22 | Imagen muy ancha, muy alta o con fondo transparente | Se ajusta al ancho disponible sin deformarse y se ve bien sobre ambos temas. |
| CL-23 | Restaurar un respaldo hecho antes de esta spec | La restauración funciona y las páginas quedan en ancho normal (RNF-11). |
| CL-24 | Ancho completo en una página con tabla o base de datos muy ancha | El contenido usa todo el ancho disponible sin generar desplazamiento horizontal de toda la página. |
| CL-25 | Sistema con modo de contraste forzado o reducir movimiento | La interfaz sigue siendo utilizable y respeta la preferencia (RF-14.8, RF-14.11). |
| CL-26 | Cambio de nombre del producto | El nombre y el logotipo derivado se actualizan sin tocar el diseño de las pantallas (RF-13.2). |
| CL-27 | Tipografía elegida no disponible o que no carga | Se usa una alternativa de la misma familia incluida en la aplicación, sin saltos de diseño notorios. |
| CL-28 | Alto o ancho de ventana muy pequeño en un diálogo | El diálogo se adapta y permite desplazarse; los botones de acción siguen alcanzables. |

---

## 7. Fuera de alcance

- Todo lo colaborativo: compartir, invitar, permisos y roles, comentarios, menciones a personas, presencia y avatares de otras personas, historial por persona.
- Notificaciones tipo «Actualizaciones» o bandeja de actividad.
- Métricas de equipo del mockup: puntos de historia, velocidad, sprints, capacidad, asignación de personas, aprobaciones.
- Cuentas, perfiles, membresías y sincronización entre equipos.
- Diseño para teléfono y tableta, y uso táctil como caso principal.
- Cambios en el modelo de datos más allá del ancho completo por página (y lo que se decida en DA-1 y DA-2).
- Nuevas funciones de contenido no relacionadas con el diseño (nuevos tipos de bloque, nuevas fórmulas, etc.).
- Plantillas de página (el mockup las muestra, pero no se incluyen en esta spec; ver DA-2).
- Marca comercial definitiva: el logotipo e ícono son provisionales sobre el nombre actual.
- Temas de color adicionales a claro/oscuro y personalización libre del color de acento.
- Edición en vivo de los valores del sistema por parte de la persona usuaria.
- Ilustración profesional o fotografía de marca: se usan ilustraciones sencillas propias.

---

## 8. Criterios de finalización

La spec se da por terminada cuando se cumplen **todos** estos puntos, con evidencia:

1. **Guía de estilo** escrita y aprobada (RF-17.1), con los ajustes respecto del mockup documentados.
2. **Catálogo de componentes** con todos los componentes en todos sus estados y en ambos temas (RF-17.2).
3. **Todas las pantallas existentes** (espacios, bienvenida, página, editor, bases de datos y todas sus vistas, tablero, calendarios, cronograma, grafo, papelera, recordatorios, importar, exportar, respaldo, restauración, ajustes, paleta, captura rápida y ventana de recordatorio) aplican el estándar en claro y oscuro.
4. **Vistas nuevas** entregadas: calendario semanal por horas, modal de crear tarea con horario, tabla de contenidos y ajustes de apariencia (RF-5.8, RF-7.2, RF-8, RF-10).
5. **Sistema unificado de avisos y errores** aplicado en toda la aplicación (RF-11).
6. **Identidad:** logotipo, ícono en todos los tamaños, pantalla de bienvenida y estados vacíos (RF-12, RF-13).
7. **Accesibilidad:** auditoría automática sin infracciones graves en todas las pantallas y en ambos temas, y verificación manual de teclado, zoom al 200 %, movimiento reducido y contraste forzado (RF-14, RNF-3).
8. **Sin regresión:** todas las pruebas de la spec 001 siguen pasando y los presupuestos de rendimiento se cumplen (RNF-2, RNF-9).
9. **Privacidad:** ninguna conexión externa nueva (RNF-5).
10. **Respaldo:** el ancho completo por página se respalda y restaura, y los respaldos anteriores siguen restaurándose (RNF-11, CL-23).
11. **Revisión visual** por la persona responsable del producto de cada pantalla frente al mockup y al estándar, con los casos límite CL-1 a CL-28 revisados.

**Estado de cierre:** la spec se da por terminada el 4 de noviembre de 2026. La evidencia está registrada en `tasks.md` (U-263 a U-277); `bun run typecheck` y `bun run test` están en verde.

---

## 9. Dudas resueltas

| ID | Duda | Resolución adoptada |
|---|---|---|
| **DA-1** | Hora de inicio y fin de las tareas. | Se **añaden hora de inicio y fin (o duración)** a las tareas como dato nuevo; el calendario semanal y el modal de tarea con horario las usan. Forman parte del modelo, el respaldo y la restauración (plan §16.3). |
| **DA-2** | Etiquetas de página y plantillas. | Se implementan **etiquetas por espacio** (nombre y color), asignables a páginas, buscables y respaldadas; las **plantillas quedan fuera** de esta spec (plan §16.4). |
| **DA-3** | Estado de guardado en la cabecera. | Se usa un **indicador discreto**: «Guardado» / «Guardando…» / «No se guardó · Reintentar»; la última edición se muestra en la fila de datos de la página (plan §10.3). |
| **DA-4** | Tipografías. | Se incluyen en la aplicación **Inter**, **JetBrains Mono** y **Source Serif 4** (subconjunto latino, sin red); el ajuste «serif» usa la serif incluida. |
| **DA-5** | Valores corregidos del mockup. | Se aplican los **valores corregidos** del plan §4.1 conforme a RF-1.8, con el contraste documentado; las excepciones quedan registradas en la guía de estilo. |
| **DA-6** | Punto de plegado y ancho mínimo. | Se adoptan **900 px de mínimo**, plegado de la barra lateral en **1 040 px**, tabla de contenidos desde **1 280 px** y **720 px** de ancho de lectura (plan §10.4). |
| **DA-7** | Ubicación del mockup. | El mockup **permanece fuera del repositorio**; el estándar documentado en esta spec y en la guía de estilo es la referencia oficial. |
| **DA-8** | Ubicación de esta spec. | La spec **permanece en `docs/specs/002-v-note-ui/`**; se acepta como excepción documentada a la convención de la constitución. |
