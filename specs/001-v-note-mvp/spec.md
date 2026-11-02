# Spec 001 — MVP de v-note

> Estado: **v3 — spec cerrada, sin dudas abiertas; lista para pasar al plan de implementación.** Esta spec define el **QUÉ** y el **POR QUÉ**. Stack, arquitectura y estructura de archivos se deciden después, en el plan (que parte de esta spec; ver constitución, artículos 1 y 2).
> Notación de criterios: **EARS** en español (`Cuando…`, `Mientras…`, `Si… entonces…`, `Donde…`, o enunciado simple).

---

## 1. Contexto y objetivo

### Contexto
Las herramientas de notas tipo Notion obligan a depender de un servicio en la nube, y las que son locales no ofrecen organización visual: tableros, diagramas y mapas viven en programas aparte. La persona usuaria quiere **un solo lugar** donde escribir, organizar y dibujar sus ideas, con sus datos en su propio equipo y con copias de seguridad que ella controla.

### Objetivo
Entregar una aplicación de notas **personal, de un solo usuario y local-first**, parecida a Notion, que además integre:

1. flujos de trabajo estilo **kanban**,
2. **organizadores gráficos** (mapa mental, organigrama, línea de tiempo y matriz),
3. **diagramas de flujo** creados con arrastrar y soltar,
4. **enlaces entre notas** con vista de grafo,
5. **tareas con fecha y recordatorios**,
6. **captura rápida** de notas desde cualquier lugar del equipo,
7. **respaldo automático** y restaurable a un repositorio privado de GitHub,
8. **bases de datos avanzadas** (fórmulas, relaciones y varias vistas),
9. **importar y exportar** contenido (Markdown/Obsidian/Notion y PDF/HTML),
10. **varios espacios de trabajo** independientes.

### Por qué
- Que las notas, los tableros y los diagramas **vivan juntos** y se enlacen entre sí, sin saltar entre programas.
- Que los datos sean **del usuario**: siempre disponibles sin internet y nunca atados a un servicio ajeno.
- Que **nunca se pierdan**: un respaldo periódico y abierto en GitHub como red de seguridad.

### Principios de producto
Requisitos de fondo que condicionan todas las funciones:

1. **Local-first:** los datos viven en el equipo de la persona usuaria y la aplicación es plenamente útil sin internet.
2. **Instalable y también web:** se instala en Linux, Windows y macOS, y además se puede usar desde el navegador con la misma interfaz.
3. **Los datos son suyos:** nada sale del equipo salvo el respaldo a GitHub; sin telemetría ni servicios de terceros.
4. **Formato abierto:** el contenido se puede leer y recuperar sin la aplicación (texto legible más una copia sin pérdida).
5. **Cero pérdida de datos:** escrituras seguras, papelera antes de borrar y confirmación antes de sobrescribir.
6. **Una sola persona, un solo equipo a la vez:** sin cuentas, servidor ni colaboración por ahora.

### Decisión de alcance y entrega por hitos
El MVP incluye **todas** las funciones listadas arriba (decisión de la persona usuaria). Por su tamaño, el plan de implementación deberá organizar la entrega en **hitos internos**, cada uno usable por sí solo:

| Hito | Contenido |
|---|---|
| 1 | Núcleo: espacios de trabajo, páginas, editor, papelera, búsqueda, sin conexión, instalación, respaldo y restauración (RF-1 a RF-5, RF-14 a RF-21, RF-25) |
| 2 | Kanban, bases de datos avanzadas y recordatorios (RF-8, RF-11, RF-12, RF-22) |
| 3 | Diagramas de flujo y organizadores gráficos (RF-9, RF-10) |
| 4 | Enlaces y grafo, captura rápida, importar y exportar (RF-6, RF-7, RF-13, RF-23, RF-24) |

El MVP **termina cuando se completan los cuatro hitos**.

---

## 2. Usuarios

| Usuario | Descripción | Necesidades |
|---|---|---|
| **Persona usuaria única** | Una sola persona, en uno o varios sistemas (Linux, Windows, macOS) pero **un equipo a la vez** | Escribir y organizar rápido, trabajar sin internet, no perder nada, ver sus ideas de forma gráfica |

Quedan fuera: equipos de trabajo, invitados, administradores, colaboradores (ver sección 8).

---

## 3. Historias de usuario

| ID | Historia | Prioridad |
|---|---|---|
| HU-1 | Como persona usuaria quiero **crear páginas anidadas** y escribirlas con bloques para organizar mis notas como un árbol. | Alta |
| HU-2 | Como persona usuaria quiero **buscar y saltar** a cualquier nota al instante para no perder tiempo navegando. | Alta |
| HU-3 | Como persona usuaria quiero **recuperar lo que borré por error** para no perder trabajo. | Alta |
| HU-4 | Como persona usuaria quiero **enlazar notas** y ver qué notas me enlazan, y verlas en un **grafo**, para descubrir relaciones entre mis ideas. | Media |
| HU-5 | Como persona usuaria quiero **tableros kanban** donde cada tarjeta sea una nota completa para llevar mis flujos de trabajo. | Alta |
| HU-6 | Como persona usuaria quiero **diagramas de flujo con arrastrar y soltar** dentro de mis notas para explicar procesos sin salir de la nota. | Alta |
| HU-7 | Como persona usuaria quiero **mapas mentales, organigramas, líneas de tiempo y matrices** para organizar ideas visualmente. | Media |
| HU-8 | Como persona usuaria quiero ponerle **fecha y recordatorio** a una tarea para que no se me pase. | Alta |
| HU-9 | Como persona usuaria quiero **capturar una idea al vuelo** con un atajo, aunque esté en otra aplicación, para ordenarla después. | Media |
| HU-10 | Como persona usuaria quiero que mis notas se **respalden solas** en GitHub cada cierto tiempo para estar tranquila si falla mi equipo. | Alta |
| HU-11 | Como persona usuaria quiero **restaurar** mis notas desde un respaldo para recuperarme de un desastre. | Alta |
| HU-12 | Como persona usuaria quiero **usar la app sin internet** y que se **instale** en mi sistema para trabajar en cualquier lugar. | Alta |
| HU-13 | Como persona usuaria quiero **bases de datos con propiedades, fórmulas, relaciones y varias vistas** para llevar información estructurada. | Media |
| HU-14 | Como persona usuaria quiero **importar** mis notas de Markdown, Obsidian o Notion para no empezar de cero. | Media |
| HU-15 | Como persona usuaria quiero **exportar** una nota a PDF o HTML para compartirla o imprimirla. | Media |
| HU-16 | Como persona usuaria quiero **varios espacios de trabajo** (por ejemplo Personal y Trabajo) con su propio respaldo para mantener mis contextos separados. | Media |

---

## 4. Requisitos funcionales

### 4.1 Páginas y organización

**RF-1 — Páginas anidadas.**
- Cuando la persona usuaria cree una página, el sistema deberá añadirla al árbol y abrirla lista para escribir.
- Cuando la persona usuaria cree una página dentro de otra, el sistema deberá mostrarla como hija de la primera, sin límite de profundidad.
- Cuando la persona usuaria arrastre una página a otra posición, el sistema deberá moverla con todas sus páginas hijas.
- El sistema deberá permitir asignar un ícono y una portada a cada página.
- El sistema deberá permitir marcar páginas como favoritas y mostrarlas en un acceso rápido.
- El sistema deberá permitir duplicar una página (con o sin sus páginas hijas) y mostrar la ruta de navegación (migas de pan) de la página abierta.
- Si la persona usuaria intenta mover una página dentro de sus propios descendientes, entonces el sistema deberá impedirlo e informar el motivo.

**RF-2 — Papelera.**
- Cuando la persona usuaria elimine una página, el sistema deberá moverla, junto con sus páginas hijas, a la papelera sin borrarla definitivamente.
- Cuando la persona usuaria restaure una página de la papelera, el sistema deberá devolverla a su lugar original, o a la raíz si su padre ya no existe.
- Cuando la persona usuaria vacíe la papelera o borre definitivamente un elemento, el sistema deberá pedir confirmación explícita antes de hacerlo.
- El sistema deberá borrar definitivamente los elementos que lleven **30 días** en la papelera, e indicar en cada elemento cuántos días le quedan.

### 4.2 Editor de bloques

**RF-3 — Edición por bloques.**
- El sistema deberá ofrecer al menos estos bloques: párrafo, encabezados de tres niveles, lista con viñetas, lista numerada, lista de tareas, desplegable, cita, aviso destacado, divisor, bloque de código, imagen, archivo adjunto, tabla simple y enlace web.
- Cuando la persona usuaria escriba `/` al inicio de un bloque, el sistema deberá mostrar un menú filtrable con los tipos de bloque disponibles.
- Cuando la persona usuaria escriba atajos de Markdown (por ejemplo `#`, `-`, `1.`, `[]`, `>`), el sistema deberá convertir el bloque al tipo correspondiente.
- El sistema deberá permitir dar formato al texto seleccionado: negrita, cursiva, subrayado, tachado, código, enlace, color y resaltado.
- El sistema deberá permitir reordenar bloques arrastrándolos y anidarlos con sangría.
- El sistema deberá permitir deshacer y rehacer los cambios de forma consistente, incluso tras cerrar y volver a abrir la página dentro de la misma sesión.
- Si una página supera los 5 000 bloques, entonces el sistema deberá sugerir dividirla en varias páginas, sin impedir seguir editándola.
- El sistema no deberá imponer un límite de tamaño a los archivos adjuntos; cuando la persona usuaria adjunte un archivo mayor al que acepta el repositorio de respaldo, el sistema deberá advertirle que ese archivo no se respaldará.

**RF-4 — Guardado automático.**
- Cuando la persona usuaria modifique una página, el sistema deberá guardar el cambio automáticamente sin acción explícita.
- Si el cierre de la aplicación es inesperado, entonces el sistema deberá conservar el contenido hasta el último cambio guardado y no corromper ninguna página.

### 4.3 Búsqueda y navegación

**RF-5 — Búsqueda y paleta de comandos.**
- Cuando la persona usuaria use el atajo de la paleta de comandos, el sistema deberá mostrar un cuadro para buscar páginas por título y por contenido, y ejecutar acciones comunes.
- Mientras la persona usuaria escribe en el cuadro de búsqueda, el sistema deberá actualizar los resultados y resaltar la coincidencia.
- Si no hay coincidencias, entonces el sistema deberá mostrar un mensaje claro de que no se encontró nada.
- Cuando la paleta de comandos se abra sin texto, el sistema deberá mostrar las páginas visitadas recientemente.
- El sistema deberá permitir acotar la búsqueda por espacio de trabajo, tipo de página (nota, tablero, base de datos) y fecha de modificación.
- El sistema no deberá mostrar páginas de la papelera en los resultados, salvo que la persona usuaria lo pida.

### 4.4 Enlaces y grafo

**RF-6 — Enlaces y retroenlaces.**
- Cuando la persona usuaria mencione otra página desde el texto, el sistema deberá crear un enlace navegable hacia ella.
- El sistema deberá mostrar en cada página la lista de páginas que la enlazan (retroenlaces).
- Cuando se renombre una página, el sistema deberá mantener sus enlaces funcionando y mostrar el nuevo título.
- Si una página enlazada se elimina, entonces el sistema deberá mostrar el enlace como roto y permitir recuperarla desde la papelera.

**RF-7 — Grafo de notas.**
- Cuando la persona usuaria abra la vista de grafo, el sistema deberá mostrar las páginas como nodos y los enlaces como conexiones.
- Cuando la persona usuaria seleccione un nodo, el sistema deberá resaltar sus conexiones y permitir abrir la página.
- El sistema deberá permitir filtrar el grafo (por ejemplo, mostrar solo las páginas enlazadas a la actual).
- Si no existe ningún enlace entre páginas, entonces el sistema deberá mostrar un mensaje que explique cómo crear enlaces.

### 4.5 Tableros kanban

**RF-8 — Tableros.**
- Cuando la persona usuaria cree un tablero, el sistema deberá ofrecer columnas iniciales editables (por ejemplo, Por hacer, En curso, Hecho).
- El sistema deberá permitir crear, renombrar, reordenar y eliminar columnas.
- Cuando la persona usuaria cree una tarjeta, el sistema deberá crear con ella una **página completa**, que se abre con todo el editor de bloques.
- Cuando la persona usuaria arrastre una tarjeta a otra columna o posición, el sistema deberá guardar el nuevo estado y orden.
- Si la persona usuaria elimina una columna que contiene tarjetas, entonces el sistema deberá pedir confirmación y ofrecer moverlas a otra columna antes de eliminarla.
- El sistema deberá mostrar en cada tarjeta, como mínimo, su título, su fecha límite y su recordatorio si los tiene.

### 4.6 Diagramas y organizadores gráficos

**RF-9 — Diagramas de flujo.**
- Cuando la persona usuaria inserte un diagrama, el sistema deberá agregar a la nota un bloque de lienzo editable.
- El sistema deberá ofrecer formas básicas de diagrama de flujo (inicio/fin, proceso, decisión, entrada/salida, nota).
- Cuando la persona usuaria arrastre una forma a la paleta o al lienzo, el sistema deberá colocarla en la posición soltada.
- Cuando la persona usuaria conecte dos formas, el sistema deberá dibujar un conector con flecha que siga a las formas al moverlas.
- El sistema deberá permitir editar el texto de cada forma y de cada conector, moverlas, redimensionarlas, cambiarles el color, eliminarlas, acercar y alejar la vista y desplazarse por el lienzo.
- Si la persona usuaria elimina una forma con conectores, entonces el sistema deberá eliminar o dejar sin extremo esos conectores de forma explícita, sin dejar elementos huérfanos invisibles.

**RF-10 — Organizadores gráficos.**
- El sistema deberá ofrecer como bloque insertable en una nota: **mapa mental**, **organigrama / árbol jerárquico**, **línea de tiempo** y **matriz comparativa (incluida la 2×2)**.
- Cuando la persona usuaria agregue un elemento a un organizador, el sistema deberá posicionarlo según las reglas del tipo (rama nueva, nivel hijo, evento en el eje, celda).
- En el mapa mental y el organigrama, cuando la persona usuaria colapse un nodo, el sistema deberá ocultar sus descendientes y recordar el estado al reabrir la nota.
- En la línea de tiempo, cuando se agreguen eventos, el sistema deberá ordenarlos cronológicamente.
- Cuando la persona usuaria arrastre un elemento dentro de un organizador, el sistema deberá guardar la nueva posición o relación.

### 4.7 Tareas, fechas y recordatorios

**RF-11 — Fechas y recordatorios.**
- Se entiende por **tarea** cualquier casilla de una lista de tareas dentro de una nota, cualquier tarjeta de tablero y cualquier fila de una base de datos.
- El sistema deberá permitir asignar a una tarea una fecha límite y, opcionalmente, un recordatorio con fecha y hora.
- Cuando llegue la hora de un recordatorio y la aplicación esté disponible en segundo plano o abierta, el sistema deberá mostrar una notificación del sistema con el título de la tarea y permitir abrirla.
- Si la aplicación no estaba disponible a la hora del recordatorio, entonces el sistema deberá mostrarlo como **vencido** en el siguiente inicio.
- Si el sistema operativo no permite mostrar notificaciones (permiso denegado o modo No molestar), entonces el sistema deberá informarlo una vez, con instrucciones para activarlas, y mostrar los recordatorios como vencidos al abrir la aplicación para que ninguno se pierda.
- Cuando la persona usuaria marque una tarea como hecha, el sistema deberá cancelar sus recordatorios pendientes.
- Cuando la persona usuaria cambie o elimine una fecha de recordatorio, el sistema deberá cancelar el aviso anterior y programar el nuevo, si existe.
- El sistema deberá permitir que un recordatorio se repita a diario, semanalmente, mensualmente o anualmente.
- Cuando la persona usuaria complete una tarea recurrente, el sistema deberá programar la siguiente repetición.
- Cuando se muestre un recordatorio, el sistema deberá permitir **posponerlo** (10 minutos, 1 hora o hasta mañana) directamente desde la notificación.
- Si una tarea recurrente acumuló varias repeticiones sin atender mientras la aplicación estuvo cerrada, entonces el sistema deberá mostrar una sola entrada vencida (la más reciente) en lugar de una por repetición.

**RF-12 — Agenda y pendientes.**
- Cuando la persona usuaria abra la aplicación, el sistema deberá mostrar un resumen único con los recordatorios vencidos y las tareas de hoy de **todos** los espacios de trabajo, indicando a qué espacio pertenece cada uno, antes de cualquier otra acción.
- El sistema deberá mantener una agenda independiente por cada espacio de trabajo.
- El sistema deberá ofrecer una vista de agenda con las tareas (casillas, tarjetas y filas) ordenadas por fecha.
- Cuando la persona usuaria marque como hecho, posponga o descarte un recordatorio vencido, el sistema deberá reflejarlo de inmediato en la agenda y en la tarjeta.

### 4.8 Captura rápida

**RF-13 — Notas rápidas y bandeja de entrada.**
- Cuando la persona usuaria use el atajo global de captura, el sistema deberá mostrar una ventana mínima para escribir, aunque la aplicación esté en segundo plano.
- El sistema deberá permitir marcar un espacio de trabajo como **predeterminado para captura rápida**.
- Cuando la persona usuaria confirme la nota rápida, el sistema deberá guardarla en la página **Bandeja de entrada** del espacio predeterminado, sin importar qué espacio esté abierto, y cerrar la ventana sin abrir el espacio de trabajo completo.
- El sistema deberá permitir mover o convertir cualquier nota de la bandeja a una página o tarjeta del árbol.
- Si la persona usuaria cancela o cierra la ventana de captura con texto escrito, entonces el sistema deberá conservar el borrador, mostrarlo la próxima vez que se abra la captura y permitir descartarlo con un botón.
- Si el sistema operativo no permite registrar el atajo global, entonces el sistema deberá avisarlo, explicar cómo asignar un atajo en la configuración del sistema y seguir permitiendo la captura rápida desde el ícono de la bandeja del sistema y desde dentro de la aplicación.

### 4.9 Respaldo a GitHub

**RF-14 — Configuración del respaldo.**
- El sistema deberá permitir conectar una cuenta de GitHub y elegir, **para cada espacio de trabajo**, el repositorio privado de destino y su frecuencia.
- Si la persona usuaria elige un repositorio público, entonces el sistema deberá advertirlo y exigir confirmación explícita antes de usarlo.
- El sistema deberá permitir elegir la frecuencia del respaldo entre **1 día y 1 semana**, con un valor inicial de 1 día.
- El sistema deberá guardar las credenciales de GitHub de forma que no queden expuestas en las notas, en el repositorio de respaldo ni en registros.

**RF-15 — Ejecución del respaldo.**
- Cuando se cumpla el plazo configurado, el sistema deberá crear un respaldo con **todo** el contenido (páginas, tableros, diagramas, organizadores, enlaces, recordatorios y archivos adjuntos) y subirlo al repositorio.
- El sistema deberá generar el respaldo en un formato abierto: texto legible para las notas y una copia sin pérdida que permita restaurar todo.
- Si no hubo cambios desde el último respaldo, entonces el sistema no deberá crear un nuevo registro en el repositorio.
- El sistema deberá incluir en el respaldo el contenido de la papelera, marcado como eliminado; cuando un elemento se borre definitivamente, deberá desaparecer del respaldo más reciente, conservándose solo en el historial del repositorio.
- Cuando la persona usuaria pulse **Respaldar ahora**, el sistema deberá ejecutar el respaldo de inmediato.
- Cuando la persona usuaria abra la aplicación y haya vencido el plazo del respaldo, el sistema deberá ejecutarlo de inmediato.
- El sistema deberá mostrar el estado del respaldo: último exitoso, próximo programado, y el historial de ejecuciones con su resultado.

**RF-16 — Fallos del respaldo.**
- Si el respaldo falla (sin conexión, credenciales vencidas, repositorio inexistente o sin permisos), entonces el sistema deberá reintentar con espacios crecientes entre intentos.
- Si el respaldo sigue fallando tras los reintentos, entonces el sistema deberá mostrar un aviso visible con la causa y un botón para reintentar.
- Si el respaldo falla, entonces el sistema no deberá modificar ni borrar ninguna nota local.
- Si un archivo adjunto supera el límite que acepta el repositorio, entonces el sistema deberá avisar cuál es, omitirlo del respaldo y respaldar el resto.
- Si GitHub rechaza el respaldo porque el repositorio alcanzó su límite de tamaño o porque se superó un límite de uso, entonces el sistema deberá detener ese respaldo, mostrar qué límite se alcanzó con sugerencias para resolverlo (usar otro repositorio, quitar adjuntos pesados), reintentar en el siguiente plazo y no modificar ninguna nota local.

**RF-17 — Restauración.**
- Cuando la persona usuaria elija restaurar, el sistema deberá permitirle seleccionar un respaldo (por fecha) del repositorio.
- El sistema deberá permitir restaurar como un **espacio de trabajo nuevo**, sin tocar el actual.
- Si la persona usuaria elige restaurar sobre el espacio de trabajo existente, entonces el sistema deberá advertir qué se reemplazará y exigir confirmación explícita antes de continuar.
- Si el respaldo seleccionado está dañado o es de una versión no soportada, entonces el sistema deberá avisar sin modificar nada de lo existente.
- Cuando se restaure un respaldo, el sistema deberá recuperar páginas, jerarquía, tableros, bases de datos, diagramas, organizadores, enlaces, fechas y recordatorios, y archivos adjuntos.
- Cuando la persona usuaria use la aplicación en un equipo nuevo, el sistema deberá permitirle conectar GitHub y restaurar un respaldo manualmente. No existe sincronización continua: tras restaurar, cada equipo es independiente.

### 4.10 Disponibilidad y uso general

**RF-18 — Sin conexión.**
- El sistema deberá permitir crear, editar, buscar y organizar todo el contenido sin conexión a internet.
- Mientras no haya conexión, el sistema deberá seguir funcionando con normalidad y limitar el aviso a las funciones que sí la necesitan (solo el respaldo y la restauración).

**RF-19 — Instalación y acceso.**
- El sistema deberá poder instalarse como aplicación de escritorio en Linux y Windows (y, cuando sea posible, macOS).
- El sistema deberá poder usarse también desde un navegador web moderno, con la misma interfaz.
- Cuando se use en el navegador, el sistema deberá informar a la persona usuaria que los respaldos programados solo se ejecutan mientras la aplicación esté abierta.
- El sistema deberá tratar la versión de escritorio y la del navegador como instalaciones independientes que no comparten datos; para pasar contenido de una a otra se usa la restauración desde el respaldo (RF-17), y la aplicación deberá indicarlo claramente.
- Cuando la aplicación de escritorio tenga una actualización disponible, el sistema deberá informarlo y ofrecer abrir la página de descarga (actualización manual informada; ver plan, P-2).

**RF-20 — Apariencia e idioma.**
- El sistema deberá ofrecer tema claro, oscuro y seguir el del sistema.
- El sistema deberá mostrar la interfaz en español de México y permitir cambiarla a inglés.
- El sistema deberá ofrecer atajos de teclado por defecto para las acciones más frecuentes (crear página, buscar, captura rápida, deshacer, rehacer) y permitir reasignarlos.
- Si la persona usuaria asigna a una acción un atajo que ya usa otra, entonces el sistema deberá avisar del conflicto y pedir elegir cuál conserva el atajo.

### 4.11 Espacios de trabajo, bases de datos, importación y exportación

**RF-21 — Espacios de trabajo.**
- El sistema deberá permitir crear, renombrar, cambiar entre y eliminar varios espacios de trabajo.
- El sistema deberá mantener en cada espacio de trabajo su propio árbol de páginas, papelera, bandeja de entrada, configuración de respaldo y recordatorios.
- La búsqueda, los enlaces y el grafo no deberán cruzar entre espacios de trabajo distintos.
- Cuando la persona usuaria elimine un espacio de trabajo, el sistema deberá exigir confirmación explícita escribiendo su nombre, e informar la fecha de su último respaldo exitoso.
- Si el espacio de trabajo a eliminar no tiene ningún respaldo exitoso, entonces el sistema deberá advertirlo de forma destacada antes de confirmar.

**RF-22 — Bases de datos avanzadas.**
- El sistema deberá permitir crear bases de datos (colecciones de páginas con propiedades) dentro de una nota o como página completa.
- El sistema deberá ofrecer propiedades de tipo: texto, número, selección, selección múltiple, fecha, casilla, enlace web, correo, teléfono, archivos, estado, fecha de creación y de edición, **relación**, **rollup** y **fórmula**.
- El sistema deberá ofrecer las vistas: tabla, lista, tablero (kanban), galería, calendario y línea de tiempo tipo Gantt.
- El tablero de RF-8 deberá comportarse como una vista más de una base de datos, de modo que las mismas tarjetas puedan verse también en las demás vistas.
- El sistema deberá permitir que una misma página pertenezca a varias bases de datos o tableros a la vez, con un estado y propiedades propios en cada uno, y que una base de datos se muestre mediante vistas enlazadas en otras páginas.
- Cuando la persona usuaria elimine una página que pertenece a varias bases, el sistema deberá advertirlo y mandarla a la papelera, de modo que desaparezca de todas.
- El sistema deberá permitir filtrar, ordenar y agrupar, y guardar varias vistas por base de datos.
- Cuando la persona usuaria cree una propiedad de relación, el sistema deberá permitir vincular filas de dos bases de datos y mostrar el vínculo en ambas.
- Cuando la persona usuaria defina un rollup, el sistema deberá calcular sobre las filas relacionadas (contar, sumar, promediar, mínimo, máximo) y actualizar el resultado al cambiar los datos.
- Cuando la persona usuaria escriba una fórmula, el sistema deberá calcular su resultado con funciones de texto, números, fechas y lógica, y recalcularlo cuando cambien los datos de los que depende.
- Si una fórmula produce un error (por ejemplo división entre cero, tipo inválido o referencia circular), entonces el sistema deberá mostrar el error en esa celda con una explicación, sin afectar al resto de la tabla.
- Si la persona usuaria elimina una fila relacionada, entonces el sistema deberá quitar el vínculo en el otro lado y recalcular los rollups afectados.

**RF-23 — Importar.**
- El sistema deberá permitir importar archivos y carpetas de **Markdown** (incluidas carpetas de Obsidian, convirtiendo sus enlaces internos en enlaces de la aplicación) y el **ZIP de exportación de Notion** (páginas, jerarquía, imágenes y bases de datos).
- Cuando la persona usuaria importe contenido, el sistema deberá colocarlo en una página contenedora nueva, sin sobrescribir ninguna página existente.
- Cuando termine la importación, el sistema deberá mostrar un informe con lo importado y lo que no se pudo convertir.
- El sistema deberá garantizar, al importar desde Notion, como mínimo: páginas, jerarquía, texto con formato, listas, imágenes y bases de datos básicas.
- Si un elemento no tiene equivalente en la aplicación (por ejemplo, fórmulas, relaciones o vistas de Notion que no se puedan convertir), entonces el sistema deberá conservar su contenido de la forma más cercana posible e indicarlo en el informe.
- Si un archivo está dañado o no es de un formato soportado, entonces el sistema deberá omitirlo, importar el resto e indicarlo en el informe.
- Mientras dura una importación, el sistema deberá mostrar el avance y permitir cancelarla sin dejar contenido a medias.

**RF-24 — Exportar.**
- El sistema deberá permitir exportar una página, con o sin sus páginas hijas, a **PDF** y a **HTML**.
- El sistema deberá incluir en la exportación el texto, los bloques, las imágenes, las tablas, los diagramas y los organizadores gráficos de la página, con una apariencia equivalente a la que se ve en pantalla.
- Si un archivo adjunto o imagen no está disponible al exportar, entonces el sistema deberá avisar y completar la exportación con el resto.
- Cuando la persona usuaria exporte una base de datos, el sistema deberá incluir la vista elegida.

**RF-25 — Ubicación de los datos.**
- El sistema deberá guardar por defecto los datos de la aplicación de escritorio en una ubicación estándar propia del sistema.
- El sistema deberá permitir elegir otra carpeta para cada espacio de trabajo, al crearlo o después, y mostrar en la configuración la ubicación actual con un botón para abrirla.
- Cuando la persona usuaria cambie la ubicación de un espacio de trabajo existente, el sistema deberá moverlo completo, verificar que no falte nada y solo entonces dejar de usar la ubicación anterior.
- Si la carpeta elegida no existe, no se puede escribir en ella o no tiene espacio suficiente, entonces el sistema deberá avisarlo antes de mover nada y conservar la ubicación actual.
- Si una carpeta de datos deja de estar disponible (disco desmontado, carpeta borrada), entonces el sistema deberá avisarlo al abrir el espacio de trabajo y no crear uno vacío en su lugar.

---

## 5. Requisitos no funcionales

| ID | Requisito | Criterio medible |
|---|---|---|
| RNF-1 | **Rendimiento de apertura** | Abrir una página existente toma menos de 100 ms (sin contar archivos grandes) |
| RNF-2 | **Escritura fluida** | Escribir no muestra latencia perceptible (mediana por tecla < 50 ms y p95 < 100 ms) en páginas de hasta **2 000 bloques**; hasta 5 000 sigue siendo utilizable (p95 ≈ 100 ms) |
| RNF-3 | **Diagramas grandes** | Un diagrama de 500 elementos se mueve y se amplía sin pausas notorias |
| RNF-4 | **Fiabilidad de datos** | Un cierre inesperado nunca corrompe páginas; se pierde como máximo el último cambio en curso |
| RNF-5 | **Privacidad** | Ningún dato sale del equipo, salvo el respaldo a GitHub; sin telemetría ni servicios de terceros |
| RNF-6 | **Seguridad de credenciales** | El token de GitHub nunca aparece en notas, respaldos ni registros |
| RNF-7 | **Determinismo del respaldo** | Dos respaldos del mismo contenido producen el mismo resultado; solo los cambios reales generan diferencias |
| RNF-8 | **Portabilidad** | Mismo comportamiento en Linux, Windows y navegadores modernos |
| RNF-9 | **Accesibilidad** | Navegación completa por teclado, contraste suficiente (nivel AA) y etiquetas para lectores de pantalla en los controles principales |
| RNF-10 | **Idioma** | Todos los textos visibles en español de México, con soporte de inglés |
| RNF-11 | **Escala** | Funciona con al menos 5 000 páginas y 50 000 tarjetas/filas sin degradación notoria |
| RNF-12 | **Operaciones largas** | Importar, exportar, respaldar y restaurar no bloquean la interfaz, muestran avance y se pueden cancelar sin dejar datos a medias |
| RNF-13 | **Fórmulas** | Recalcular una base de 10 000 filas tras un cambio no congela la interfaz |

---

## 6. Casos límite

| # | Caso | Comportamiento esperado |
|---|---|---|
| CL-1 | Dos páginas con el mismo título | Se permiten; se distinguen por su ruta y por un identificador interno |
| CL-2 | Título vacío | Se muestra como "Sin título"; no se bloquea el guardado |
| CL-3 | Página sin contenido ni título | Se conserva; se puede eliminar desde el árbol |
| CL-4 | Mover una página dentro de sí misma o de sus hijas | Se impide (RF-1) |
| CL-5 | Eliminar una página que otras enlazan | Los enlaces quedan rotos, visibles y recuperables desde la papelera (RF-6) |
| CL-6 | Enlaces circulares entre páginas | Permitidos; el grafo no entra en bucle ni se bloquea |
| CL-7 | Tarjeta kanban cuya página se elimina desde fuera del tablero | La tarjeta desaparece del tablero y queda en la papelera; al restaurar vuelve a su columna |
| CL-8 | Diagrama vacío o con elementos fuera de la vista | Se muestra con un botón "ajustar a pantalla" |
| CL-9 | Conector entre dos formas que se encuentran en lugares muy lejanos | Se dibuja sin cortar la vista; se puede centrar en cualquiera de los extremos |
| CL-10 | Línea de tiempo con dos eventos en la misma fecha | Ambos se muestran sin superponerse, con orden estable |
| CL-11 | Recordatorio con fecha en el pasado | Se avisa al crearlo y se ofrece guardarlo como vencido o cambiar la fecha |
| CL-12 | Equipo apagado o aplicación cerrada a la hora del recordatorio | Se muestra como vencido al siguiente inicio (RF-11, RF-12) |
| CL-13 | Cambio de zona horaria o de hora del sistema | Los recordatorios conservan la hora local prevista por la persona usuaria |
| CL-14 | Muchos recordatorios vencidos al mismo tiempo | Se agrupan en una sola lista; no se lanza una avalancha de notificaciones |
| CL-15 | El atajo global de captura ya lo usa otro programa o el sistema no permite atajos globales | Se avisa, se explica cómo asignar uno en el sistema y la captura sigue disponible desde la bandeja y dentro de la app (RF-13) |
| CL-16 | Bandeja de entrada eliminada o movida por la persona usuaria | Se recrea automáticamente en la siguiente captura rápida |
| CL-17 | Se apaga el equipo en pleno respaldo | El respaldo se considera fallido, no queda a medias y se repite en el siguiente plazo o inicio |
| CL-18 | El repositorio de respaldo cambió por fuera (alguien más escribió en él) | Se avisa y se pide decisión antes de sobrescribir; no se pierde ninguna versión |
| CL-19 | El plazo de respaldo vence varias veces mientras la app estuvo cerrada | Se hace **un solo** respaldo al abrir, no uno por cada plazo vencido |
| CL-20 | Disco lleno al guardar | Se avisa de inmediato y no se pierde lo ya guardado |
| CL-21 | Archivos adjuntos de cualquier tamaño o con nombres repetidos | Se aceptan sin límite y sin sobrescribirse entre sí; al adjuntar se advierte de los que excedan el límite del repositorio y se omiten del respaldo con aviso (RF-3, RF-16) |
| CL-22 | Abrir el mismo espacio de trabajo en dos ventanas o pestañas a la vez | Solo una instancia puede editar; la otra avisa y queda en modo lectura para evitar conflictos |
| CL-23 | Restaurar un respaldo hecho con una versión futura de la aplicación | Se rechaza con un mensaje claro (RF-17) |
| CL-24 | Contenido pegado desde otra fuente con formato o código no seguro | Se limpia; nunca se ejecuta código del contenido pegado |
| CL-25 | Recordatorio mensual programado el día 29, 30 o 31 | En los meses más cortos se programa el último día del mes |
| CL-26 | Fórmulas o rollups que se refieren entre sí en círculo | Se detecta, se rechaza la definición y se explica el ciclo (RF-22) |
| CL-27 | Importar contenido cuyos enlaces apuntan a páginas que no vienen en la importación | Los enlaces quedan visibles como rotos y se listan en el informe (RF-23) |
| CL-28 | Importar dos veces el mismo contenido | Se crean dos contenedores separados; nunca se sobrescribe ni se fusiona |
| CL-29 | Eliminar un espacio de trabajo con respaldo fallido o sin respaldo | Advertencia destacada antes de confirmar (RF-21) |
| CL-30 | Captura rápida cuando hay varios espacios de trabajo, o cuando el espacio predeterminado se elimina | Va al espacio predeterminado; si fue eliminado, se pide elegir otro en la siguiente captura (RF-13) |
| CL-31 | Exportar una página con miles de bloques o un diagrama muy grande | Se muestra avance, se puede cancelar y no se bloquea la interfaz (RNF-12) |
| CL-32 | Tarea recurrente completada antes de su fecha | Se programa la siguiente repetición a partir de la fecha original, no de la fecha de cierre |
| CL-33 | Elemento en la papelera que cumple 30 días mientras la aplicación estaba cerrada | Se borra definitivamente en el siguiente inicio, no antes; si el borrado definitivo ocurre entre dos respaldos, desaparece del siguiente (RF-2, RF-15) |
| CL-34 | Página que está en varios tableros y se mueve de columna en uno | Solo cambia su estado en ese tablero; los demás no se alteran (RF-22) |
| CL-35 | Carpeta de datos en un disco externo desmontado | Se avisa al abrir y no se crea un espacio vacío en su lugar (RF-25) |
| CL-36 | Mover la carpeta de datos y se interrumpe a la mitad | La ubicación anterior sigue siendo la válida; no se pierde ni duplica nada (RF-25) |

---

## 7. Decisiones tomadas y dudas abiertas

### 7.1 Resueltas
| ID | Tema | Decisión |
|---|---|---|
| D-1 | Alcance y orden de entrega | El MVP incluye todo; la entrega se organiza en **cuatro hitos internos** usables por sí solos (ver sección 1) |
| D-2 | Bases de datos avanzadas, importar y exportar | **Entran al MVP** las tres (RF-22, RF-23, RF-24) |
| D-3 | Recordatorios | Con **repetición** (diaria, semanal, mensual, anual) y **posponer** (RF-11) |
| D-4 | Segundo equipo | **Solo restauración manual** desde el respaldo; sin sincronización (RF-17) |
| D-5 | Espacios de trabajo | **Varios**, cada uno con su repositorio y frecuencia de respaldo (RF-21) |
| D-6 | Bloqueo propio | **No**; basta la sesión del sistema operativo |
| D-7 | Atajo global no disponible | **Degradar y avisar**: captura desde la bandeja y dentro de la app (RF-13) |
| D-8 | Tamaño de adjuntos | **Sin límite en la app**; se advierte y omite del respaldo lo que exceda el límite del repositorio (RF-3, RF-16) |
| D-9 | Nombre | **v-note** |
| D-10 | Captura y agenda con varios espacios | Captura al **espacio predeterminado**; agenda **por espacio** más un **resumen global** de vencidos al abrir (RF-12, RF-13) |
| D-11 | Fidelidad de importar Notion | **Básico garantizado + informe** de lo no convertible (RF-23) |
| D-12 | Qué es una tarea | **Casillas de notas, tarjetas y filas** de bases de datos (RF-11) |
| D-13 | Retención de la papelera | **30 días** y luego se vacía sola (RF-2) |
| D-14 | Web frente a escritorio | **Instalaciones independientes**; se pasa contenido con el respaldo (RF-19) |
| D-15 | Notificaciones bloqueadas | **Avisar una vez** y mostrar vencidos al abrir (RF-11) |
| D-16 | Página en varias bases | **Sí**, con estado propio en cada una y vistas enlazadas (RF-22) |
| D-17 | Ubicación de los datos | **Carpeta estándar por defecto**, configurable por espacio de trabajo (RF-25) |
| D-18 | Respaldo y papelera | **La papelera se respalda**; el borrado definitivo la quita del último respaldo, no del historial (RF-15) |
| D-19 | Atajos de teclado | **Configurables** con valores por defecto y aviso de conflictos (RF-20) |
| D-20 | Borrador de captura rápida | **Se conserva** y se recupera la próxima vez, con opción de descartarlo (RF-13) |
| D-21 | Límite de tamaño del repositorio | **Avisar con la causa y sugerir acciones**, sin tocar las notas (RF-16) |

### 7.2 Abiertas
Ninguna.

### 7.3 Riesgos del producto
| Riesgo | Impacto | Cómo se maneja |
|---|---|---|
| El alcance del MVP es muy grande | Alto | Entrega por **hitos**; cada uno probado y usable antes de empezar el siguiente |
| El respaldo programado depende de que la aplicación esté abierta (en el navegador) | Medio | Se informa a la persona usuaria (RF-19); el respaldo inmediato al abrir cubre los plazos vencidos (RF-15) |
| El sistema operativo puede impedir atajos globales o notificaciones | Medio | Degradación con aviso y alternativas (RF-11, RF-13) |
| Pérdida de datos por cierre inesperado, disco lleno o carpeta desmontada | Alto | Guardado automático, escrituras seguras, papelera y avisos (RF-4, RF-25, CL-17, CL-20, CL-35) |
| Fuga de las credenciales de GitHub | Alto | Credenciales fuera de notas, respaldos y registros (RF-14, RNF-6) |
| Bases de datos o diagramas muy grandes se vuelven lentos | Medio | Metas medibles de rendimiento (RNF-2, RNF-3, RNF-11, RNF-13) |
| La importación de Notion no cubre todo lo que Notion permite | Medio | Mínimo garantizado e informe de lo no convertido (RF-23) |
| El repositorio de respaldo alcanza límites de GitHub | Medio | Aviso con causa y sugerencias, sin tocar las notas (RF-16) |

---

## 8. Fuera de alcance

- **Aplicación móvil** (Android / iOS).
- **Colaboración**: varias personas, cuentas, roles, permisos, comentarios, edición en tiempo real y compartir por enlace.
- **Sincronización entre equipos** (el respaldo en GitHub es solo copia de seguridad, no un mecanismo de sincronización).
- **Inteligencia artificial** (resumir, redactar, preguntar al contenido).
- **Cifrado del contenido del respaldo** (se confía en el repositorio privado).
- **Servidor, cuentas y servicios en la nube** propios del producto.
- **Plantillas, automatizaciones, API pública, webhooks y plugins.**
- **Bloques adicionales** previstos para después del MVP: ecuaciones, diagramas de texto, contenido incrustado de otros sitios, columnas, índice de la página y bloques sincronizados entre páginas.
- **Web clipper** (guardar páginas web desde el navegador).
- **Temas visuales personalizados**, más allá de claro, oscuro y seguir al sistema.
- **Historial de versiones por página** con comparación de diferencias (el respaldo en GitHub cubre el historial global).
- **Bloqueo propio con contraseña o PIN** de la aplicación o de los espacios de trabajo.
- **Sincronización continua entre equipos** (solo hay restauración manual).

---

## 9. Criterios de finalización

El MVP se considera terminado cuando **todos** los puntos siguientes se cumplen y se pueden demostrar:

1. **Páginas y editor:** se crean páginas anidadas, se escribe con todos los bloques de RF-3, se mueve, se borra a la papelera y se restaura (RF-1 a RF-4).
2. **Búsqueda y enlaces:** la paleta encuentra por título y contenido; los retroenlaces y el grafo funcionan (RF-5 a RF-7).
3. **Kanban:** se crea un tablero, se arrastran tarjetas entre columnas y cada tarjeta se abre como página completa (RF-8).
4. **Diagramas y organizadores:** se crea un diagrama de flujo con arrastrar y soltar y los cuatro organizadores gráficos dentro de una nota (RF-9, RF-10).
5. **Fechas y recordatorios:** un recordatorio genera notificación a su hora; si no pudo, aparece como vencido al abrir; la agenda lo refleja (RF-11, RF-12).
6. **Captura rápida:** el atajo global guarda una nota en la bandeja de entrada, y esta se puede mover al árbol (RF-13).
7. **Respaldo:** se configura la conexión por espacio de trabajo, se ejecuta de forma programada y manual, se reintenta ante fallos con aviso visible y no genera registros sin cambios (RF-14 a RF-16).
8. **Restauración:** un respaldo se restaura como espacio nuevo y recupera todo el contenido sin diferencias (RF-17).
9. **Sin conexión e instalación:** toda la edición funciona sin internet; la app se instala en Linux y Windows y también corre en navegador (RF-18, RF-19).
10. **Apariencia e idioma:** temas claro/oscuro y español/inglés funcionan (RF-20).
11. **Espacios de trabajo:** se crean varios, cada uno con su contenido, respaldo y ubicación de datos independientes (RF-21, RF-25).
12. **Bases de datos:** se crean propiedades de todos los tipos, incluidas fórmulas, relaciones y rollups, y las seis vistas (RF-22).
13. **Importar y exportar:** se importa Markdown/Obsidian y un ZIP de Notion con informe, y se exporta una página a PDF y a HTML (RF-23, RF-24).
14. **Hitos:** los cuatro hitos están completos y cada uno fue demostrado como usable por sí solo.
15. **Requisitos no funcionales:** RNF-1 a RNF-13 cumplidos y verificados.
16. **Casos límite:** CL-1 a CL-36 verificados con pruebas.
17. **Calidad:** las pruebas automatizadas de todas las reglas de datos pasan y el verificador de tipos no reporta errores (constitución, artículo 4).
18. **Plan:** existe un plan de implementación que cubre los cuatro hitos y que no contradice esta spec (constitución, artículo 2).
