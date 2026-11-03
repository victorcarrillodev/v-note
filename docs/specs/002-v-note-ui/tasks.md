# Tareas 002 — Estándar de diseño UI/UX de v-note

> Deriva de `spec.md` y `plan.md` de esta carpeta. Cada tarea es pequeña (**máx. 20–30 min**), está en **orden de dependencia** y cubre uno o más RF/RNF/CL.
> **Regla de ejecución (TDD):** en cada tarea se escribe **primero la prueba** (debe fallar), luego la implementación, y se marca el checkbox solo cuando se cumple **«Hecho cuando»** y `bun run typecheck` y `bun run test` pasan (constitución, art. 4).
> Las verificaciones previas del Hito 0 viven en `spikes/`, son desechables y sus resultados se anotan en `spikes/RESULTS-ui.md`.
> **Hitos cerrados en orden** (art. 2): no se empieza un hito hasta cerrar el anterior. Dentro de un grupo, el orden de las tareas es el de ejecución; **Requiere** indica de qué grupo depende.
> **Tareas manuales:** las marcadas «(tarea manual)» o «(lista firmada)» necesitan a la persona responsable; no se pueden cerrar solo con pruebas.
> **Condicionadas:** las de planificación con horario (DA-1) y las de etiquetas (DA-2) dependen de resolver esas dudas de la spec; si se resuelven distinto, se retiran sin afectar al resto.
> **Total:** 277 tareas ·Hito 0: 67 · Hito 1: 48 · Hito 2: 69 · Hito 3: 59 · Hito 4: 34

---

## HITO 0 — Fundaciones


### Verificaciones previas (código desechable en `spikes/`)

*Requiere: nada. Resultados en `spikes/RESULTS-ui.md`.*

- [x] **U-001** Medir el peso actual de la app web (JS, CSS, fuentes) y del binario de escritorio como línea base — *Cubre:* RNF-1, RNF-2. **Hecho cuando:** Cifras anotadas en `spikes/RESULTS-ui.md`.
- [x] **U-002** Probar que el lector de respaldo actual tolera un campo adicional en una página (sin cambiar de versión) — *Cubre:* RNF-11, RF-10.3. **Hecho cuando:** Test de spike muestra aceptado o rechazado; decisión de versión escrita en `docs/backup-format.md`.
- [x] **U-003** Probar la tematización de BlockNote con variables propias en el menú `/`, la barra de formato y el asa — *Cubre:* RF-5.4, RF-5.5, RF-5.7. **Hecho cuando:** Lista de elementos que no obedecen los tokens anotada en `spikes/RESULTS-ui.md`.
- [x] **U-004** Medir el peso de Inter, JetBrains Mono y la serif elegida (solo caracteres de español e inglés) — *Cubre:* RF-1.9, RF-10.1. **Hecho cuando:** Tamaños anotados y tope total acordado con la persona responsable (DA-4).
- [x] **U-005** Probar que cargar las fuentes incluidas no produce peticiones externas — *Cubre:* RF-1.9, RNF-5. **Hecho cuando:** e2e de red con las fuentes cargadas: cero peticiones fuera de la app.

### Tokens de color y contraste

*Requiere: Verificaciones previas.*

- [x] **U-006** Función pura de razón de contraste WCAG con casos conocidos (negro/blanco = 21:1) — *Cubre:* RF-14.1. **Hecho cuando:** Test de 5 casos conocidos pasa.
- [x] **U-007** Catálogo de tokens de color (superficies, texto, acento, estados) con valor claro y oscuro — *Cubre:* RF-1.1, RF-2.5. **Hecho cuando:** Test: cada token de plan 4.1 existe con ambos valores.
- [x] **U-008** Test de contraste: parejas texto/superficie de plan 4.1 en ambos temas — *Cubre:* RF-14.1. **Hecho cuando:** Falla si alguna pareja baja de 4,5:1 (texto) o 3:1 (grande/íconos); hoy pasa.
- [x] **U-009** Test de contraste: `borde-control` sobre lienzo, lateral, tarjeta y elevada en ambos temas — *Cubre:* RF-14.1. **Hecho cuando:** Todas las parejas ≥ 3:1.
- [x] **U-010** Test de contraste: chips y avisos semánticos (info, éxito, advertencia, error) — *Cubre:* RF-14.1. **Hecho cuando:** Las 8 parejas ≥ 4,5:1.
- [x] **U-011** Test de contraste: nueve colores de bloque como texto y resaltado en ambos temas — *Cubre:* RF-2.6, RF-14.1. **Hecho cuando:** Texto de color ≥ 4,5:1 sobre lienzo y texto principal ≥ 4,5:1 sobre cada resaltado.
- [x] **U-012** Variables de color en la hoja base: claro por defecto y oscuro con el atributo de tema — *Cubre:* RF-1.1, RF-2.1. **Hecho cuando:** Test lee la hoja y la compara con el catálogo de tokens.
- [x] **U-013** Prueba de calidez: el lienzo claro no es blanco puro y tiene matiz cálido; el oscuro es carbón de baja luminancia — *Cubre:* RF-2.2. **Hecho cuando:** Test: lienzo claro distinto de #FFFFFF con rojo ≥ azul; luminancia del lienzo oscuro < 0,02.
- [x] **U-014** Prueba de paridad: ningún token existe solo en un tema — *Cubre:* RF-2.5. **Hecho cuando:** Test pasa y falla al borrar un valor oscuro a propósito.

### Tokens de tipografía, espaciado, radios, elevación, movimiento y capas

*Requiere: Tokens de color.*

- [x] **U-015** Escala tipográfica (11 niveles de plan 4.4) como variables — *Cubre:* RF-1.2. **Hecho cuando:** Test: cada nivel tiene tamaño, interlineado y peso.
- [x] **U-016** Test de tamaños mínimos: interfaz ≥ 12 px, etiqueta ≥ 11 px, lectura ≥ 15 px — *Cubre:* RF-14.2. **Hecho cuando:** Falla al bajar un valor a propósito; hoy pasa.
- [x] **U-017** Escala de espaciado de base 4 como variables — *Cubre:* RF-1.3. **Hecho cuando:** Test: todos los valores son múltiplos de 4.
- [x] **U-018** Conjunto cerrado de radios (0, 2, 4, 6, 8, circular) como variables — *Cubre:* RF-1.4. **Hecho cuando:** Test: no existe un sexto valor distinto.
- [x] **U-019** Tokens de elevación por tema (borde y sombra en claro; escalón de superficie en oscuro) — *Cubre:* RF-1.5. **Hecho cuando:** Test: ningún nivel oscuro usa sombra difusa.
- [x] **U-020** Tokens de movimiento (100, 150, 220, 120 ms y curvas) y de capas (0 a 100) — *Cubre:* RF-1.7. **Hecho cuando:** Test: valores y orden de capas coinciden con plan 4.5.
- [x] **U-021** Anillo de foco doble global (2 px de acento + 2 px de separación) — *Cubre:* RF-14.3. **Hecho cuando:** Test de estilo: todo elemento enfocable lo muestra en ambos temas.
- [x] **U-022** Regla global de «reducir movimiento»: animaciones sustituidas por cambios inmediatos o ≤ 80 ms — *Cubre:* RF-14.8. **Hecho cuando:** Test con emulación de la preferencia: no hay transformaciones animadas.
- [x] **U-023** Regla base de contraste forzado: bordes y foco con colores del sistema — *Cubre:* RF-14.11. **Hecho cuando:** Test con emulación: controles conservan borde y foco visibles.
- [x] **U-024** Prueba «sin valores sueltos»: detecta colores, tamaños de texto, espaciados y radios fuera del sistema — *Cubre:* RF-1, RNF-4. **Hecho cuando:** Falla al insertar un `#fff` a propósito; pasa con una lista de excepciones inicial que solo puede encogerse.

### Tema y tipografías incluidas

*Requiere: Tokens.*

- [x] **U-025** Lógica pura de resolución del tema (claro, oscuro, sistema) — *Cubre:* RF-2.1. **Hecho cuando:** Tests de tabla: 3 modos × 2 preferencias del sistema.
- [x] **U-026** Aplicar el tema antes del primer pintado en la web — *Cubre:* RF-2.4. **Hecho cuando:** e2e: con preferencia oscura, el atributo de tema existe antes de montar la interfaz.
- [x] **U-027** Aplicar el tema antes del primer pintado en escritorio — *Cubre:* RF-2.4. **Hecho cuando:** e2e de escritorio: sin destello claro al abrir con tema oscuro.
- [x] **U-028** Cambio del tema del sistema en caliente cuando el modo es «sistema» — *Cubre:* RF-2.3, CL-4. **Hecho cuando:** Test cambia la preferencia simulada y el tema cambia sin recargar ni perder el foco.
- [x] **U-029** Transición de 150 ms solo en color de fondo y texto al cambiar de tema — *Cubre:* RF-1.7, RF-2.3. **Hecho cuando:** Test: ninguna otra propiedad se anima en el cambio.
- [x] **U-030** Incluir Inter (conjuntos de caracteres mínimos) con pila de respaldo del sistema — *Cubre:* RF-1.9, CL-27. **Hecho cuando:** Build usa la fuente local; test: no hay direcciones externas en la hoja.
- [x] **U-031** Incluir JetBrains Mono y la serif de lectura con su pila de respaldo — *Cubre:* RF-1.9, RF-10.1. **Hecho cuando:** Test: las tres familias resuelven a archivos locales.
- [x] **U-032** Prueba de respaldo tipográfico: si la fuente no carga se usa la alternativa sin saltos notorios — *Cubre:* CL-27. **Hecho cuando:** Test con fuente bloqueada: el texto se muestra con el respaldo y el desplazamiento de diseño medido es < 0,1.
- [x] **U-033** Variable de familia del contenido conmutable entre sans, serif y mono — *Cubre:* RF-10.1. **Hecho cuando:** Test: cambiar la variable cambia la fuente del contenido y no la de la interfaz.

### Íconos

*Requiere: Tokens.*

- [x] **U-034** Componente de ícono con tamaños 14, 16, 20, 24 y trazos 1,75 / 1,5 — *Cubre:* RF-1.6. **Hecho cuando:** Test de tamaños y trazos del componente.
- [x] **U-035** Ícono decorativo oculto a lectores y ícono solo con nombre accesible obligatorio — *Cubre:* RF-14.7. **Hecho cuando:** Test: un ícono solo sin nombre falla en tiempo de prueba.
- [x] **U-036** Mapa semántico significado → ícono (tabla de plan 5) como datos — *Cubre:* RF-1.6. **Hecho cuando:** Test: ningún ícono se asigna a dos significados distintos.
- [x] **U-037** Prueba: toda aparición de ícono de la interfaz usa el componente (sin SVG sueltos) — *Cubre:* RF-1.6, RNF-4. **Hecho cuando:** Falla al insertar un SVG suelto a propósito.

### Componentes base y emergentes

*Requiere: Tokens, tema e íconos. Cada componente se prueba en ambos temas y con teclado.*

- [x] **U-038** Instalar las primitivas de Radix de plan 3 y verificar que no abren conexiones — *Cubre:* RF-1.9, RNF-5. **Hecho cuando:** `bun run typecheck` pasa y la prueba de red sigue en cero conexiones externas.
- [x] **U-039** Botón: variantes primario, secundario, fantasma y peligro; tamaños 32 y 28 — *Cubre:* RF-1, RF-14.4. **Hecho cuando:** Test de variantes, estados (reposo, hover, foco, deshabilitado) y alto mínimo.
- [x] **U-040** Botón: estado de carga sin cambiar de ancho — *Cubre:* RF-1. **Hecho cuando:** Test: el ancho no varía entre reposo y carga.
- [x] **U-041** Botón de ícono con nombre accesible y tooltip obligatorios — *Cubre:* RF-14.7. **Hecho cuando:** Test: sin nombre falla; con nombre muestra tooltip.
- [x] **U-042** Tooltip: 500 ms con ratón, inmediato con foco, no recibe foco, Escape lo oculta — *Cubre:* RF-14.6, RF-14.7. **Hecho cuando:** Tests de los 4 comportamientos.
- [x] **U-043** Campo de texto con etiqueta visible, foco y error con mensaje de texto — *Cubre:* RF-14.9, RF-8.3. **Hecho cuando:** Test: error muestra borde de peligro y mensaje (no solo color).
- [x] **U-044** Área de texto de varias líneas — *Cubre:* RF-1. **Hecho cuando:** Test de foco, error y crecimiento.
- [x] **U-045** Casilla, interruptor y control segmentado con objetivo ≥ 24 px — *Cubre:* RF-14.4, RF-14.9. **Hecho cuando:** Tests de estado marcado por forma y de tamaño mínimo.
- [x] **U-046** Selector desplegable que se comporta como menú — *Cubre:* RF-14.6. **Hecho cuando:** Test de teclado: abrir, flechas, Enter y Escape.
- [x] **U-047** Chip/etiqueta con color semántico, botón de quitar y truncado «+N» — *Cubre:* RF-1, CL-9. **Hecho cuando:** Test: con 8 chips en poco ancho se muestran los que caben y «+N».
- [x] **U-048** Pestañas con flechas del teclado y desvanecimiento de desbordamiento — *Cubre:* RF-6.1, RF-15.3. **Hecho cuando:** Test de navegación con flechas y de indicador de desbordamiento.
- [x] **U-049** Menú de acciones con flechas, Inicio, Fin y búsqueda por letra — *Cubre:* RF-14.6. **Hecho cuando:** Tests de los 4 comportamientos de teclado.
- [x] **U-050** Popover con colisión (voltea y desplaza), Escape y devolución de foco — *Cubre:* RF-14.6. **Hecho cuando:** Test en esquina de ventana: no queda cortado.
- [x] **U-051** Modal de formulario: foco inicial, foco atrapado, devolución de foco y Escape — *Cubre:* RF-14.6. **Hecho cuando:** Tests de los 4 comportamientos.
- [x] **U-052** Modal: velo, contenido de fondo inerte y bloqueo de desplazamiento sin salto — *Cubre:* RF-14.6. **Hecho cuando:** Test: el fondo no es enfocable ni anunciado; el ancho de la página no cambia.
- [x] **U-053** Modal: cuerpo con desplazamiento, título y pie de botones fijos — *Cubre:* CL-28. **Hecho cuando:** Test con ventana de 400 px de alto: botones alcanzables.
- [x] **U-054** Modal con cambios sin guardar: Escape o clic fuera piden confirmar el descarte — *Cubre:* RF-11.3. **Hecho cuando:** Test: con cambios aparece confirmación; sin cambios cierra.
- [x] **U-055** Diálogo de confirmación destructiva: foco en el botón seguro, botón de peligro, el velo no cierra — *Cubre:* RF-11.3. **Hecho cuando:** Tests de foco inicial y de clic en el velo.
- [x] **U-056** Límite de apilado: solo popover o confirmación sobre un modal, nunca modal sobre modal — *Cubre:* RF-14.6. **Hecho cuando:** Test: abrir un segundo modal desde un modal es rechazado en pruebas.
- [x] **U-057** Panel lateral no modal que cierra con Escape y devuelve el foco — *Cubre:* RF-7.5, RF-14.6. **Hecho cuando:** Tests de cierre y de foco.
- [x] **U-058** Tarjeta, insignia de conteo («99+»), indicador de progreso y fila de lista — *Cubre:* RF-1, RF-12.3. **Hecho cuando:** Tests de cada componente con sus estados.
- [x] **U-059** Esqueleto de carga que reserva espacio y queda estático con «reducir movimiento» — *Cubre:* RF-12.4, RF-14.8. **Hecho cuando:** Test: con la preferencia activa no hay animación; el alto reservado no cambia al cargar.
- [x] **U-060** Banda en línea de aviso persistente con ícono de gravedad, texto y acción — *Cubre:* RF-11.2, RF-14.9. **Hecho cuando:** Test: no desaparece sola; el estado se comunica con ícono y texto.

### Guía de estilo inicial y catálogo

*Requiere: Componentes base.*

- [x] **U-061** Entrada de desarrollo del catálogo que no entra en instaladores ni en la PWA publicada — *Cubre:* RF-17.2, RF-17.3. **Hecho cuando:** Test del build de producción: el catálogo no está en el paquete.
- [x] **U-062** Catálogo: colores, tipografía, espaciado, radios, elevación e íconos en ambos temas — *Cubre:* RF-17.2. **Hecho cuando:** El catálogo muestra cada token y la prueba de axe del catálogo pasa.
- [x] **U-063** Catálogo: cada componente base en todos sus estados y ambos temas — *Cubre:* RF-17.2. **Hecho cuando:** Una captura de referencia por componente y tema; prueba visual pasa.
- [x] **U-064** Guía de estilo inicial en `docs/design/` con valores, ajustes del mockup y su motivo — *Cubre:* RF-17.1, RF-1.8. **Hecho cuando:** Test: cada token del catálogo aparece mencionado en la guía.
- [x] **U-065** Prueba de axe del catálogo en claro y oscuro — *Cubre:* RF-14, RNF-3. **Hecho cuando:** Cero infracciones graves o críticas.
- [x] **U-066** Revisión de los ajustes de color del mockup con la persona responsable (tarea manual) — *Cubre:* RF-1.8, DA-5. **Hecho cuando:** Cada ajuste aprobado o corregido y anotado en la guía.
- [x] **U-067** Cierre del Hito 0: `bun run typecheck`, `bun run test`, privacidad y peso dentro del tope — *Cubre:* RNF-4, RNF-5. **Hecho cuando:** Todo en verde y peso medido ≤ tope acordado.

---

## HITO 1 — Marco y navegación


### Marco de la ventana

*Requiere: Hito 0 cerrado.*

- [x] **U-068** Estructura de barra lateral de 240 px, cabecera de 44 px y contenido — *Cubre:* RF-3.1. **Hecho cuando:** Test de medidas del marco.
- [x] **U-069** Mantener barra lateral y cabecera en la misma posición en todas las pantallas — *Cubre:* RF-3.2. **Hecho cuando:** Test recorre todas las pantallas y compara coordenadas.
- [x] **U-070** Plegar y desplegar la barra lateral con control visible y atajo, y recordar el estado — *Cubre:* RF-3.3. **Hecho cuando:** e2e: pliega, reinicia y sigue plegada.
- [x] **U-071** Migas de pan navegables con truncado desde el medio — *Cubre:* RF-3.4, CL-1. **Hecho cuando:** Test: 8 niveles muestran inicio, «…» y final; cada miga navega.
- [x] **U-072** Modelo del estado de guardado (guardado, guardando, error) como lógica pura — *Cubre:* RF-3.4. **Hecho cuando:** Tests de transiciones y de reintento.
- [x] **U-073** Indicador de estado de guardado en la cabecera con tooltip de última edición — *Cubre:* RF-3.4. **Hecho cuando:** e2e: escribir muestra «Guardando…» y luego «Guardado».
- [x] **U-074** Estado «No se guardó · Reintentar» persistente en la cabecera — *Cubre:* RF-3.4, RF-11.2. **Hecho cuando:** Test con fallo simulado: el aviso permanece y el reintento guarda.
- [x] **U-075** Ancho de lectura de 720 px centrado en páginas — *Cubre:* RF-3.5. **Hecho cuando:** Test de medida del contenido.

### Adaptación a tamaños de ventana

*Requiere: Marco.*

- [x] **U-076** Plegado automático de la barra lateral por debajo de 1 040 px con panel superpuesto — *Cubre:* RF-15.2. **Hecho cuando:** e2e a 1 000 px: barra plegada y se abre sobre el contenido con velo.
- [x] **U-077** Panel superpuesto: se cierra al elegir una página o con Escape — *Cubre:* RF-15.2, RF-14.6. **Hecho cuando:** Tests de ambos cierres.
- [x] **U-078** Por debajo de 900 px permitir desplazamiento sin romper el diseño — *Cubre:* RF-15.1, RF-15.4. **Hecho cuando:** e2e a 800 px: sin controles inalcanzables.
- [x] **U-079** Dejar documentado y comprobado que no hay diseño específico para teléfono ni tableta — *Cubre:* RF-15.5. **Hecho cuando:** Test: no existen puntos de corte por debajo de 900 px; la guía lo declara fuera de alcance.
- [x] **U-080** Desplazamiento propio con desvanecimiento en vistas anchas — *Cubre:* RF-15.3. **Hecho cuando:** Test: una tabla de 30 columnas no ensancha la pantalla.
- [x] **U-081** Prueba de zoom al 200 %: todas las funciones del marco siguen utilizables — *Cubre:* RF-14.10, CL-6. **Hecho cuando:** e2e al 200 %: sin texto cortado ni desplazamiento horizontal del contenido.

### Barra lateral

*Requiere: Marco.*

- [x] **U-082** Selector de espacio con logotipo, nombre y menú (espacios, crear, gestionar) — *Cubre:* RF-4.1. **Hecho cuando:** e2e cambia de espacio desde el selector.
- [x] **U-083** Campo «Buscar» con el atajo visible que abre la paleta — *Cubre:* RF-4.1, RF-9.1. **Hecho cuando:** e2e: clic y atajo abren la paleta.
- [x] **U-084** Sección de favoritos con ícono — *Cubre:* RF-4.1. **Hecho cuando:** Test: aparece solo si hay favoritos.
- [x] **U-085** Árbol: filas de 32 px (28 compacta), ícono de tipo y página activa con barra de acento — *Cubre:* RF-4.2. **Hecho cuando:** Test de medidas y de marca de página activa.
- [x] **U-086** Árbol: acciones contextuales al pasar el cursor o enfocar, sin mover el texto — *Cubre:* RF-4.3. **Hecho cuando:** Test: el ancho del texto no cambia al aparecer las acciones.
- [x] **U-087** Árbol: título largo truncado con tooltip y sangría con tope a 6 niveles — *Cubre:* CL-1, CL-7. **Hecho cuando:** Test: 10 niveles sangran como 6 y el título completo está en el tooltip.
- [x] **U-088** Árbol: mantener la virtualización con miles de páginas — *Cubre:* RNF-2, CL-7. **Hecho cuando:** Prueba existente de 5 000 páginas sigue en verde.
- [x] **U-089** Accesos secundarios agrupados con jerarquía menor — *Cubre:* RF-4.1, RF-4.4. **Hecho cuando:** Test de orden y de tamaño de texto (13 px).
- [x] **U-090** Prueba de ausencia: no hay «Invitar miembros», «Actualizaciones» ni cuentas — *Cubre:* RF-4.5, RF-10.6. **Hecho cuando:** Test falla si aparece alguno de esos textos.

### Búsqueda y paleta de comandos

*Requiere: Marco y modal.*

- [x] **U-091** Marco de la paleta: 640 px, 12 % desde arriba, velo y foco en el campo — *Cubre:* RF-9.1. **Hecho cuando:** Test de medidas y de foco inicial.
- [x] **U-092** Sin texto: grupos «Recientes» y «Acciones» con atajos visibles — *Cubre:* RF-9.1, RF-9.3. **Hecho cuando:** Test lista recientes y acciones con su atajo.
- [x] **U-093** Resultados en vivo con coincidencia resaltada, tipo, ruta y fragmento — *Cubre:* RF-9.2. **Hecho cuando:** Test: escribir cambia resultados y resalta.
- [x] **U-094** Teclado: flechas, Enter abre, Escape cierra y devuelve el foco — *Cubre:* RF-9.2, RF-9.5. **Hecho cuando:** Tests de los 3 comportamientos.
- [x] **U-095** Fila activa con fondo y barra de acento (no solo color) — *Cubre:* RF-9.2, RF-14.9. **Hecho cuando:** Test de indicador no cromático.
- [x] **U-096** Filtros como chips (espacio, tipo, fecha, incluir papelera) — *Cubre:* RF-9.1. **Hecho cuando:** Test de cada filtro como en la spec 001.
- [x] **U-097** Sin resultados: mensaje y acción «Crear una página con este título» — *Cubre:* RF-9.4. **Hecho cuando:** e2e: la acción crea la página con el texto.
- [x] **U-098** Medir que los resultados aparecen en menos de 100 ms — *Cubre:* RNF-1. **Hecho cuando:** Prueba de rendimiento con 5 000 páginas bajo 100 ms.

### Ajustes de apariencia

*Requiere: Tema y tipografías, componentes base.*

- [x] **U-099** Preferencias del dispositivo: claves de tipografía y densidad en el almacén existente — *Cubre:* RF-10.1, RF-10.2. **Hecho cuando:** Test de guardar y leer; no aparecen en el respaldo.
- [x] **U-100** Pantalla Ajustes › Apariencia con tema, tipografía y densidad — *Cubre:* RF-10.1. **Hecho cuando:** e2e cambia los tres y se ven al instante.
- [x] **U-101** Aplicar los cambios al instante en toda la aplicación y conservarlos al reiniciar — *Cubre:* RF-10.2. **Hecho cuando:** e2e: cambia, reinicia y persiste.
- [x] **U-102** Densidad compacta: reducir espaciado vertical sin bajar el texto del mínimo — *Cubre:* RF-10.4. **Hecho cuando:** Test de variables: espaciado −4 px y lectura 15/22.
- [x] **U-103** Vista previa en vivo de tipografía y densidad — *Cubre:* RF-10.5. **Hecho cuando:** Test: cambiar la opción actualiza la vista previa.
- [x] **U-104** Fallo al guardar un ajuste: se aplica en la sesión y se avisa con reintento — *Cubre:* RF-10.2, CL-18. **Hecho cuando:** Test con fallo simulado: aviso persistente y reintento funciona.
- [x] **U-105** Propagar cambios de apariencia a otras ventanas abiertas — *Cubre:* RF-10.2, RF-16. **Hecho cuando:** Test: un cambio llega a una segunda ventana sin recargar.

### Identidad visual y bienvenida

*Requiere: Tokens, íconos.*

- [x] **U-106** Derivar el monograma y el logotipo del nombre de la configuración — *Cubre:* RF-13.2, CL-26. **Hecho cuando:** Test: cambiar el nombre cambia el monograma sin tocar pantallas.
- [x] **U-107** Componente de logotipo (monograma + nombre) con degradado del acento solo en el símbolo — *Cubre:* RF-13.1. **Hecho cuando:** Test en ambos temas; legible a 16 px.
- [x] **U-108** Generar el ícono de la aplicación en todos los tamaños y formatos de cada plataforma — *Cubre:* RF-13.1, RF-13.3. **Hecho cuando:** Lista de archivos generada coincide con la requerida por escritorio y navegador.
- [x] **U-109** Nombre del producto en el título de la ventana y logotipo en el selector de espacio — *Cubre:* RF-13.4. **Hecho cuando:** Test de título y de presencia del logotipo.
- [x] **U-110** Pantalla de bienvenida: logotipo, frase, «Crear espacio» y «Restaurar desde un respaldo» — *Cubre:* RF-12.2, RF-13.4. **Hecho cuando:** e2e en instalación limpia muestra la bienvenida con ambas acciones.
- [x] **U-111** Ocultar o explicar en la web lo que solo existe en escritorio — *Cubre:* RF-16.2. **Hecho cuando:** Test web: no hay controles de bandeja ni atajo global muertos.
- [x] **U-112** Mostrar ⌘ en macOS y Ctrl en el resto en atajos — *Cubre:* RF-16.3. **Hecho cuando:** Test con plataforma simulada de ambos casos.

### Cierre del Hito 1

*Requiere: Todos los grupos del Hito 1.*

- [x] **U-113** Auditoría axe del marco, barra lateral, paleta, ajustes y bienvenida en claro y oscuro — *Cubre:* RF-14, RNF-3. **Hecho cuando:** Cero infracciones graves en el navegador real.
- [x] **U-114** Retirar valores antiguos de las pantallas ya migradas y encoger la lista de excepciones — *Cubre:* RNF-4. **Hecho cuando:** La prueba «sin valores sueltos» pasa con una lista menor.
- [x] **U-115** Verificar la suite completa de la spec 001 y los presupuestos — *Cubre:* RNF-2, RNF-9. **Hecho cuando:** `bun run typecheck` y `bun run test` en verde; presupuestos cumplidos.

---

## HITO 2 — Contenido y retroalimentación


### Núcleo: ancho completo por página

*Requiere: Hito 1 cerrado.*

- [x] **U-116** Migración versionada de la propiedad «ancho completo» (por defecto falso) — *Cubre:* RF-10.3, RNF-11. **Hecho cuando:** Test comprueba columna, valor por defecto y migración desde la versión anterior.
- [x] **U-117** Leer y escribir el ancho completo de una página de forma atómica — *Cubre:* RF-10.3. **Hecho cuando:** Tests de guardar y leer.
- [x] **U-118** Respaldo: escribir el campo solo cuando es verdadero — *Cubre:* RF-10.3, RNF-11. **Hecho cuando:** Los archivos dorados existentes no cambian de bytes.
- [x] **U-119** Respaldo: página con ancho completo incluida de forma determinista — *Cubre:* RF-10.3. **Hecho cuando:** Dos respaldos del mismo contenido dan los mismos bytes.
- [x] **U-120** Restauración: lee el campo y restaura respaldos anteriores con ancho normal — *Cubre:* RF-10.3, CL-23. **Hecho cuando:** Test con un respaldo sin el campo y otro con él.
- [x] **U-121** Prueba de propiedades de ida y vuelta incluyendo el ancho completo — *Cubre:* RF-10.3, RNF-11. **Hecho cuando:** fast-check con 500 casos pasa.
- [x] **U-122** Actualizar `docs/backup-format.md` con el campo y la decisión de versión — *Cubre:* RF-10.3. **Hecho cuando:** Documento revisado y alineado con las pruebas.

### Núcleo: operaciones inversas para «Deshacer»

*Requiere: Hito 1 cerrado.*

- [x] **U-123** Inversa de «mover a la papelera»: restaurar a su lugar — *Cubre:* RF-11.1, RF-11.4. **Hecho cuando:** Test: tras la inversa la página y sus hijas quedan como antes.
- [x] **U-124** Inversa de «mover página»: devolver a su padre y posición anteriores — *Cubre:* RF-11.1. **Hecho cuando:** Test con orden de hermanas intacto.
- [x] **U-125** Inversa de «duplicar»: enviar la copia a la papelera — *Cubre:* RF-11.1. **Hecho cuando:** Test: el original no cambia y la copia queda en papelera.
- [x] **U-126** Inversa de marcar tarea hecha y de cambiar el estado de una tarjeta — *Cubre:* RF-11.1. **Hecho cuando:** Tests de ambos casos, incluida una tarea recurrente.
- [x] **U-127** Garantizar que las acciones irreversibles no ofrecen inversa — *Cubre:* RF-11.3. **Hecho cuando:** Test: borrado definitivo y vaciar papelera no exponen inversa.

### Sistema de avisos temporales

*Requiere: Componentes base.*

- [x] **U-128** Cola de avisos con deduplicación por clave (lógica pura) — *Cubre:* RF-11.5, CL-17. **Hecho cuando:** Tests: un evento repetido actualiza el aviso; máximo 3 visibles.
- [x] **U-129** Aviso temporal: posición, ícono de gravedad, acción «Deshacer» y cierre — *Cubre:* RF-11.1, RF-11.5. **Hecho cuando:** Test de estructura; éxito dura 5 s y con «Deshacer» 8 s.
- [x] **U-130** Pausa de la cuenta al pasar el cursor o recibir foco — *Cubre:* RF-11.1. **Hecho cuando:** Test con reloj simulado: la cuenta se detiene y se reanuda.
- [x] **U-131** Accesibilidad de los avisos: anuncio según gravedad, Escape y alcance con teclado — *Cubre:* RF-11.6. **Hecho cuando:** Test con lector simulado y de teclado.
- [x] **U-132** Prueba: ningún error accionable se muestra solo como aviso temporal — *Cubre:* RF-11.2. **Hecho cuando:** Test falla si un error accionable usa la cola temporal.
- [x] **U-133** Varios avisos a la vez (guardado, respaldo, recordatorio) se apilan sin tapar controles importantes — *Cubre:* RF-11.5, CL-16. **Hecho cuando:** e2e dispara tres avisos juntos: los controles de la página siguen alcanzables.

### Migrar avisos y errores existentes

*Requiere: Sistema de avisos; cada tarea cubre una pantalla.*

- [x] **U-134** Panel de respaldo: errores como aviso persistente con causa y reintento — *Cubre:* RF-11.2, CL-20. **Hecho cuando:** e2e con servidor falso en cada causa de error.
- [x] **U-135** Restauración: errores y avisos con el sistema unificado — *Cubre:* RF-11.2. **Hecho cuando:** e2e con respaldo dañado y de versión futura.
- [x] **U-136** Importar: informe y errores con el sistema unificado — *Cubre:* RF-11.2. **Hecho cuando:** e2e con archivo dañado.
- [x] **U-137** Exportar: faltantes y errores con el sistema unificado — *Cubre:* RF-11.2. **Hecho cuando:** e2e con adjunto faltante.
- [ ] **U-138** Editor: fallo de guardado y adjunto grande con el sistema unificado — *Cubre:* RF-11.2. **Hecho cuando:** Tests con fallo simulado y archivo de 101 MB.
- [x] **U-139** Espacios: espacio no disponible y bloqueo por otra ventana — *Cubre:* RF-11.2, RF-11.8. **Hecho cuando:** Tests de ambas situaciones.
- [x] **U-140** Recordatorios: aviso de permiso y de vencidos — *Cubre:* RF-11.2. **Hecho cuando:** Test de aviso único y de lista agrupada.
- [x] **U-141** Pantalla de error global con causa y opciones de recuperación; nunca en blanco — *Cubre:* RF-11.8. **Hecho cuando:** Test: un fallo al abrir el espacio muestra la pantalla con opciones.
- [x] **U-142** Mensajes de la aplicación sin códigos técnicos y con paridad en inglés — *Cubre:* RF-11.7, RF-18.1. **Hecho cuando:** Prueba de paridad de claves en verde y revisión de redacción qué/por qué/qué hacer.
- [x] **U-143** Prueba de textos largos (+40 %) en botones, chips, pestañas y menús — *Cubre:* RF-18.2, CL-3. **Hecho cuando:** Ningún texto queda cortado sin forma de leerlo completo.

### Confirmaciones destructivas y «Deshacer» en la interfaz

*Requiere: Operaciones inversas, diálogo de confirmación, avisos.*

- [x] **U-144** Papelera: eliminar definitivamente con el diálogo estándar — *Cubre:* RF-11.3. **Hecho cuando:** e2e: el diálogo nombra lo que se eliminará.
- [x] **U-145** Papelera: vaciar con el diálogo estándar — *Cubre:* RF-11.3. **Hecho cuando:** e2e con confirmación y cancelación.
- [x] **U-146** Espacios: eliminar escribiendo el nombre con el diálogo estándar — *Cubre:* RF-11.3. **Hecho cuando:** e2e: sin nombre correcto el botón sigue deshabilitado.
- [x] **U-147** Restauración: reemplazar un espacio con el diálogo estándar — *Cubre:* RF-11.3. **Hecho cuando:** e2e: cancelar deja todo intacto.
- [x] **U-148** Mover a la papelera con aviso temporal y «Deshacer» — *Cubre:* RF-11.1, RF-11.4. **Hecho cuando:** e2e: eliminar y deshacer restaura la página.
- [x] **U-149** Mover página y duplicar con aviso temporal y «Deshacer» — *Cubre:* RF-11.1. **Hecho cuando:** e2e de ambos.
- [x] **U-150** Marcar tarea hecha y mover tarjeta con «Deshacer» — *Cubre:* RF-11.1. **Hecho cuando:** e2e de ambos.

### Página y editor

*Requiere: Tokens, componentes base, spike de BlockNote.*

- [x] **U-151** Tematizar la interfaz del editor (menús, barra, asa) con los tokens — *Cubre:* RF-5.4, RF-5.5, RF-5.7. **Hecho cuando:** Test visual: menús del editor y de la app comparten fondo, radio y sombra.
- [x] **U-152** Portada: seis degradados por tema y color plano heredado — *Cubre:* RF-5.1, RF-2.5. **Hecho cuando:** Test: las portadas existentes se ven en ambos temas.
- [x] **U-153** Ícono y título de página: varias líneas sin desbordar y «Sin título» atenuado — *Cubre:* RF-5.1, CL-1, CL-2. **Hecho cuando:** Tests con título de 300 caracteres y título vacío.
- [x] **U-154** Fila de datos con última edición, sin propietario ni autoría — *Cubre:* RF-5.2. **Hecho cuando:** Test: no existen textos de propietario o autor.
- [x] **U-155** Texto de lectura 16/26 (15/22 compacta) con líneas de 60 a 80 caracteres — *Cubre:* RF-5.3. **Hecho cuando:** Test de variables y de ancho de línea.
- [x] **U-156** Menú `/`: grupos nombrados con ícono, nombre, descripción y atajo — *Cubre:* RF-5.4. **Hecho cuando:** e2e: escribe `/` y ve los grupos.
- [x] **U-157** Menú `/`: filtrado, teclado, Escape y mensaje sin resultados — *Cubre:* RF-5.4. **Hecho cuando:** Tests de los cuatro comportamientos.
- [ ] **U-158** Barra de formato flotante con las acciones disponibles y estado pulsado — *Cubre:* RF-5.5. **Hecho cuando:** e2e: seleccionar muestra la barra y negrita aplica.
- [ ] **U-159** Barra de formato: popover de color y resaltado con los nueve colores — *Cubre:* RF-5.5, RF-2.6. **Hecho cuando:** e2e aplica un color y se ve legible en ambos temas.
- [x] **U-160** Colores de bloque guardados por nombre y mostrados según el tema — *Cubre:* RF-2.6, CL-5. **Hecho cuando:** Test: «rojo» cumple contraste en claro y oscuro.
- [x] **U-161** Bloque cita y bloque aviso destacado (4 variantes con ícono y rótulo) — *Cubre:* RF-5.6, RF-14.9. **Hecho cuando:** Test: cada variante muestra ícono y texto además del color.
- [x] **U-162** Bloque lista de verificación y desplegable con el estándar — *Cubre:* RF-5.6. **Hecho cuando:** Test de estados marcado/desmarcado y plegado.
- [ ] **U-163** Bloque de código con lenguaje y botón «Copiar» con confirmación — *Cubre:* RF-5.6. **Hecho cuando:** e2e: copiar muestra «Copiado» 1,5 s.
- [x] **U-164** Bloque tabla y tarjeta de enlace con el estándar — *Cubre:* RF-5.6. **Hecho cuando:** Test de estilos en ambos temas.
- [x] **U-165** Bloque imagen: ajuste al ancho, pie y marco neutro en oscuro — *Cubre:* RF-5.6, RF-2.7, CL-22. **Hecho cuando:** Test con imagen ancha, alta y transparente.
- [ ] **U-166** Bloque no soportado o dañado: marcador neutro explicativo — *Cubre:* CL-21. **Hecho cuando:** Test: un bloque desconocido no rompe la página.
- [x] **U-167** Asa y acción de insertar solo al pasar el cursor o enfocar — *Cubre:* RF-5.7. **Hecho cuando:** Test: en reposo no están visibles; con foco sí.
- [x] **U-168** Lógica pura de tabla de contenidos: extraer encabezados y decidir si se muestra (≥ 3) — *Cubre:* RF-5.8. **Hecho cuando:** Tests con 0, 2, 3 y 50 encabezados.
- [x] **U-169** Tabla de contenidos: columna lateral con sección visible marcada — *Cubre:* RF-5.8. **Hecho cuando:** e2e: al desplazar cambia la sección marcada.
- [x] **U-170** Tabla de contenidos: menú «En esta página» en anchos menores y salto suave o instantáneo — *Cubre:* RF-5.8, RF-14.8. **Hecho cuando:** Test a 1 100 px y con movimiento reducido.
- [x] **U-171** Interruptor «Ancho completo» en el menú de la página y diseño a todo el ancho — *Cubre:* RF-10.3, RF-3.5. **Hecho cuando:** e2e: activa, recarga y persiste.
- [x] **U-172** Ancho completo con tablas o bases muy anchas sin desplazar toda la página — *Cubre:* CL-24. **Hecho cuando:** Test con tabla de 30 columnas.

### Estados vacíos, de carga y sin conexión

*Requiere: Componentes base, identidad.*

- [x] **U-173** Conjunto de ilustraciones de línea propias (SVG en línea) para estados vacíos — *Cubre:* RF-12.1, RF-13.5. **Hecho cuando:** Seis ilustraciones en el catálogo, legibles en ambos temas.
- [x] **U-174** Componente de estado vacío con ilustración, frase y acción principal — *Cubre:* RF-12.1. **Hecho cuando:** Test de estructura.
- [x] **U-175** Estados vacíos: espacio sin páginas y papelera — *Cubre:* RF-12.1, CL-19. **Hecho cuando:** Tests de ambos.
- [x] **U-176** Estados vacíos: bases, tableros, vistas y calendario — *Cubre:* RF-12.1, RF-6.7. **Hecho cuando:** Tests de cada vista sin datos.
- [x] **U-177** Estados vacíos: recordatorios sin pendientes y búsqueda — *Cubre:* RF-12.1. **Hecho cuando:** Tests de ambos.
- [x] **U-178** Esqueletos de carga aplicados a lista, página y tablas — *Cubre:* RF-12.4. **Hecho cuando:** Test: no hay saltos de diseño al cargar.
- [x] **U-179** Indicador de progreso con porcentaje y «Cancelar» en operaciones largas; aparece tras 300 ms — *Cubre:* RF-12.3, RNF-1. **Hecho cuando:** Test con reloj simulado: no aparece antes de 300 ms.
- [ ] **U-180** Sin conexión: la aplicación no muestra errores por ello — *Cubre:* RF-12.5, RNF-8. **Hecho cuando:** e2e con red cortada: sin avisos de error salvo en respaldo.

### Cierre del Hito 2

*Requiere: Todos los grupos del Hito 2.*

- [x] **U-181** Auditoría axe de editor, avisos, vacíos y diálogos en claro y oscuro — *Cubre:* RF-14, RNF-3. **Hecho cuando:** Cero infracciones graves.
- [ ] **U-182** Medir escritura con 2 000 bloques tras el rediseño del editor — *Cubre:* RNF-2. **Hecho cuando:** Mediana < 50 ms y p95 < 100 ms por tecla.
- [x] **U-183** Retirar valores antiguos y encoger la lista de excepciones — *Cubre:* RNF-4. **Hecho cuando:** La prueba «sin valores sueltos» pasa con una lista menor.
- [x] **U-184** Verificar la suite completa de la spec 001 — *Cubre:* RNF-2, RNF-9. **Hecho cuando:** `bun run typecheck` y `bun run test` en verde.

---

## HITO 3 — Datos y planificación


### Núcleo de planificación (condicionado a DA-1)

*Requiere: Hito 2 cerrado.*

- [x] **U-185** Migración versionada de hora de inicio y duración opcionales en tareas — *Cubre:* RF-7.2, RF-8.1. **Hecho cuando:** Test comprueba columnas y que las tareas sin hora siguen igual.
- [x] **U-186** Validación: la hora de fin no puede ser anterior al inicio ni la duración cero — *Cubre:* RF-8.3, CL-15. **Hecho cuando:** Tests de los casos válidos e inválidos.
- [x] **U-187** Colocación en la semana: eventos por hora y duración — *Cubre:* RF-7.2. **Hecho cuando:** Tests de tabla de posiciones.
- [x] **U-188** Colocación: eventos solapados lado a lado sin taparse — *Cubre:* RF-7.3, CL-11. **Hecho cuando:** Prueba de propiedades: ningún par solapado comparte espacio.
- [x] **U-189** Colocación: eventos que cruzan la medianoche o duran varios días — *Cubre:* CL-12. **Hecho cuando:** Tests de cruce de día y de rango de 3 días.
- [x] **U-190** Tareas con fecha y sin hora van a «Todo el día» — *Cubre:* RF-7.4, CL-13. **Hecho cuando:** Test: aparecen en esa franja.
- [x] **U-191** Zona horaria y línea de «ahora» según la hora local vigente — *Cubre:* CL-14. **Hecho cuando:** Tests con cambio de zona simulado.
- [x] **U-192** Lógica del calendario mensual: eventos por día, «+N más» y barras de varios días — *Cubre:* RF-7.1, CL-10. **Hecho cuando:** Tests con 12 eventos en un día.
- [x] **U-193** Respaldo: hora de inicio y duración solo cuando existen, con archivos dorados sin cambio — *Cubre:* RF-8, RNF-11. **Hecho cuando:** Dorados existentes idénticos; test nuevo con hora.
- [x] **U-194** Restauración de hora de tarea y de respaldos anteriores — *Cubre:* RF-8, CL-23. **Hecho cuando:** Test de ida y vuelta con y sin hora.

### Bases de datos

*Requiere: Componentes base.*

- [x] **U-195** Cabecera de la base: ícono, título y acciones — *Cubre:* RF-6.1. **Hecho cuando:** Test de estructura.
- [ ] **U-196** Vistas como pestañas con ícono y «Nueva vista» — *Cubre:* RF-6.1. **Hecho cuando:** e2e cambia entre las seis vistas.
- [ ] **U-197** Barra de filtros: campo de palabra clave y botón «Filtros y orden» — *Cubre:* RF-6.2. **Hecho cuando:** e2e filtra por palabra clave.
- [ ] **U-198** Chips de filtro, orden y agrupación activos con quitar y editar — *Cubre:* RF-6.2. **Hecho cuando:** e2e: aplicar, ver chip, quitar.
- [x] **U-199** Tabla: cabecera fija y hover y selección de fila — *Cubre:* RF-6.3. **Hecho cuando:** Test de posición fija al desplazar.
- [x] **U-200** Tabla: primera columna fija y desplazamiento horizontal propio — *Cubre:* RF-6.3, CL-8. **Hecho cuando:** Test con 30 columnas.
- [ ] **U-201** Tabla: edición en celda con el estilo de cada tipo — *Cubre:* RF-6.3. **Hecho cuando:** e2e edita celdas de cada tipo.
- [x] **U-202** Tabla: columna «+» para propiedad nueva y pie con conteo — *Cubre:* RF-6.3. **Hecho cuando:** Test de ambos.
- [ ] **U-203** Lista y galería con tarjeta, fila y etiquetas del estándar — *Cubre:* RF-6.1. **Hecho cuando:** Tests de ambas vistas.

### Tablero

*Requiere: Bases de datos.*

- [x] **U-204** Columna: punto de color de estado, nombre, conteo, «+» y menú — *Cubre:* RF-6.4. **Hecho cuando:** Test de estructura.
- [x] **U-205** Tarjeta: título, fecha límite, indicador de recordatorio y etiquetas con «+N» — *Cubre:* RF-6.4, CL-9. **Hecho cuando:** Test con 6 etiquetas.
- [x] **U-206** Fecha vencida en la tarjeta con color de peligro y texto «Vencida» — *Cubre:* RF-6.4, RF-14.9. **Hecho cuando:** Test: no depende solo del color.
- [ ] **U-207** Arrastre: tarjeta elevada, origen translúcido y columna destino resaltada — *Cubre:* RF-6.5. **Hecho cuando:** e2e: durante el arrastre se ve el resalte.
- [ ] **U-208** Arrastre: línea de inserción, autodesplazamiento y Escape cancela — *Cubre:* RF-6.5. **Hecho cuando:** e2e de los tres.
- [ ] **U-209** Alternativa por teclado: «Mover a…» desde el menú de la tarjeta — *Cubre:* RF-6.5, RF-14.5. **Hecho cuando:** e2e mueve una tarjeta sin ratón.
- [x] **U-210** Prueba de ausencia: sin puntos de historia, velocidad, asignados ni capacidad — *Cubre:* RF-6.6. **Hecho cuando:** Test falla si aparece alguno.

### Calendario mensual y cronograma

*Requiere: Núcleo de planificación, componentes base.*

- [x] **U-211** Calendario mensual: rejilla, día actual destacado y días de otro mes atenuados — *Cubre:* RF-7.1. **Hecho cuando:** Test de estructura.
- [ ] **U-212** Calendario mensual: eventos legibles, «+N más» con listado del día y barras de varios días — *Cubre:* RF-7.1, CL-10, CL-12. **Hecho cuando:** e2e con 12 eventos en un día.
- [ ] **U-213** Navegación Anterior · Hoy · Siguiente y cambio de vista sin perder el periodo — *Cubre:* RF-7.7. **Hecho cuando:** e2e: cambia de mes a semana y mantiene el periodo.
- [ ] **U-214** Arrastrar un evento a otro día cambia su fecha al instante — *Cubre:* RF-7.6. **Hecho cuando:** e2e arrastra y la fecha cambia.
- [x] **U-215** Cronograma: barras por rango, jerarquía plegable y línea de «hoy» — *Cubre:* RF-7.5. **Hecho cuando:** Test de estructura.
- [ ] **U-216** Cronograma: panel lateral de detalle al seleccionar un elemento — *Cubre:* RF-7.5. **Hecho cuando:** e2e abre y cierra con Escape devolviendo el foco.
- [ ] **U-217** Cronograma: arrastrar y redimensionar barras cambia fechas — *Cubre:* RF-7.5, RF-7.6. **Hecho cuando:** e2e cambia fechas.

### Calendario semanal por horas

*Requiere: Núcleo de planificación, calendario mensual.*

- [x] **U-218** Rejilla semanal con cabecera de día, eje horario y franja «Todo el día» — *Cubre:* RF-7.2, RF-7.4. **Hecho cuando:** Test de estructura.
- [x] **U-219** Línea de «ahora» de acento que se actualiza cada minuto — *Cubre:* RF-7.2, CL-14. **Hecho cuando:** Test con reloj simulado.
- [x] **U-220** Eventos colocados por hora y duración, lado a lado si coinciden — *Cubre:* RF-7.2, RF-7.3, CL-11. **Hecho cuando:** Test con 3 eventos solapados.
- [x] **U-221** Agrupar con acceso al detalle cuando hay demasiados eventos simultáneos — *Cubre:* RF-7.3, CL-11. **Hecho cuando:** Test con 8 solapados.
- [ ] **U-222** Arrastrar un evento cambia día y hora al instante — *Cubre:* RF-7.6. **Hecho cuando:** e2e arrastra y cambia.
- [ ] **U-223** Redimensionar un evento cambia su duración — *Cubre:* RF-7.6. **Hecho cuando:** e2e cambia la duración.
- [ ] **U-224** Teclado: flechas entre franjas, Enter para crear, Mayús+flechas para mover — *Cubre:* RF-14.5. **Hecho cuando:** e2e sin ratón.
- [ ] **U-225** Evento que cruza la medianoche continuo entre días — *Cubre:* CL-12. **Hecho cuando:** e2e con evento 23:00–01:00.

### Modal «Crear tarea con horario»

*Requiere: Calendario semanal, modal de formulario, popover.*

- [x] **U-226** Modal con título, fecha, hora de inicio, hora de fin o duración, recordatorio y repetición — *Cubre:* RF-8.1. **Hecho cuando:** Test: campos presentes en ese orden.
- [x] **U-227** Selector de fecha como popover propio con entrada por teclado — *Cubre:* RF-8.1. **Hecho cuando:** Test de teclado y de fecha escrita.
- [x] **U-228** Selector de hora como popover propio con entrada por teclado — *Cubre:* RF-8.1. **Hecho cuando:** Test de teclado y de hora escrita.
- [ ] **U-229** Abrir desde una franja con fecha y hora ya rellenas — *Cubre:* RF-8.1. **Hecho cuando:** e2e: clic en una franja rellena los campos.
- [x] **U-230** Guardar con Enter, cancelar con Escape y foco atrapado — *Cubre:* RF-8.2. **Hecho cuando:** Tests de los tres.
- [x] **U-231** Error en el campo si el fin es anterior al inicio y bloqueo de guardado con razón visible — *Cubre:* RF-8.3, CL-15. **Hecho cuando:** Test: el botón guardar muestra por qué está deshabilitado.
- [ ] **U-232** Recordatorio en el pasado: aviso y opción de guardar como vencida o cambiar la hora — *Cubre:* RF-8.4. **Hecho cuando:** e2e del aviso con ambas opciones.
- [ ] **U-233** Al guardar, la tarea aparece en el calendario en el acto — *Cubre:* RF-8.5. **Hecho cuando:** e2e crea y la ve sin recargar.

### Etiquetas de página (condicionado a DA-2; se hace al final para poder retirarse)

*Requiere: Bases de datos y modelo.*

- [x] **U-234** Migración versionada del catálogo de etiquetas del espacio (nombre y color) y asignación a páginas — *Cubre:* RF-5.9. **Hecho cuando:** Test comprueba tablas y relaciones.
- [x] **U-235** Servicio: crear, renombrar, recolorear, eliminar y asignar etiquetas — *Cubre:* RF-5.9. **Hecho cuando:** Tests de cada operación; eliminar quita la asignación.
- [x] **U-236** Búsqueda y filtro por etiqueta — *Cubre:* RF-5.9, RF-9. **Hecho cuando:** Test: filtrar devuelve solo las páginas etiquetadas.
- [x] **U-237** Respaldo y restauración de etiquetas, solo cuando existen — *Cubre:* RF-5.9, RNF-11. **Hecho cuando:** Dorados existentes sin cambio; ida y vuelta con etiquetas.
- [x] **U-238** Chips de etiqueta en la fila de datos con «+N» — *Cubre:* RF-5.9, CL-9. **Hecho cuando:** Test con 10 etiquetas.
- [ ] **U-239** Popover para elegir o crear etiquetas — *Cubre:* RF-5.9. **Hecho cuando:** e2e crea y asigna una etiqueta.

### Cierre del Hito 3

*Requiere: Todos los grupos del Hito 3.*

- [x] **U-240** Auditoría axe de bases, tablero, calendarios, cronograma y modal en claro y oscuro — *Cubre:* RF-14, RNF-3. **Hecho cuando:** Cero infracciones graves.
- [x] **U-241** Medir 50 000 filas en tabla y 10 000 filas de fórmulas tras el rediseño — *Cubre:* RNF-2. **Hecho cuando:** Dentro de los presupuestos de la spec 001.
- [x] **U-242** Retirar valores antiguos y encoger la lista de excepciones — *Cubre:* RNF-4. **Hecho cuando:** La prueba «sin valores sueltos» pasa con una lista menor.
- [x] **U-243** Verificar la suite completa de la spec 001 — *Cubre:* RNF-2, RNF-9. **Hecho cuando:** `bun run typecheck` y `bun run test` en verde.

---

## HITO 4 — Cierre


### Ventanas nativas

*Requiere: Hito 3 cerrado.*

- [ ] **U-244** Ventana de captura rápida con los tokens, Cmd/Ctrl+Enter para guardar y Escape que conserva el borrador — *Cubre:* RF-16, RF-14. **Hecho cuando:** e2e de escritorio: guarda, cancela y conserva borrador.
- [ ] **U-245** Ventana de recordatorio de 380 × 150 px con el estándar y sin robar el foco — *Cubre:* RF-16, RF-14.6. **Hecho cuando:** e2e de escritorio: las tres acciones y foco intacto.
- [ ] **U-246** Ambas ventanas usan el tema y la tipografía del dispositivo y reaccionan a sus cambios — *Cubre:* RF-10.2, RF-16. **Hecho cuando:** e2e: cambiar el tema en la principal lo cambia en una ventana abierta.

### Pantallas restantes con el estándar

*Requiere: Hito 3 cerrado. Cada tarea migra una pantalla.*

- [ ] **U-247** Gestor de espacios de trabajo — *Cubre:* RF-1, RF-4. **Hecho cuando:** Test de estilos y axe.
- [ ] **U-248** Papelera — *Cubre:* RF-1, RF-12. **Hecho cuando:** Test de estilos, vacío y axe.
- [ ] **U-249** Grafo y su panel de filtros — *Cubre:* RF-1, RF-14. **Hecho cuando:** Test de tokens en el lienzo en ambos temas y axe.
- [ ] **U-250** Importar: asistente e informe — *Cubre:* RF-1, RF-11. **Hecho cuando:** Test de estilos y e2e del informe.
- [ ] **U-251** Exportar: diálogo con el estándar de modal — *Cubre:* RF-1, RF-11.3. **Hecho cuando:** e2e de exportar y cancelar.
- [ ] **U-252** Respaldo: panel de estado, historial y diálogo de decisión — *Cubre:* RF-1, RF-11. **Hecho cuando:** e2e de respaldo contra servidor falso.
- [ ] **U-253** Restauración: asistente de tres pasos — *Cubre:* RF-1, RF-11. **Hecho cuando:** e2e de restaurar como espacio nuevo.
- [ ] **U-254** Recordatorios y agenda — *Cubre:* RF-1, RF-12. **Hecho cuando:** Test de estilos y vacío.
- [ ] **U-255** Captura rápida dentro de la app y bandeja de entrada — *Cubre:* RF-1. **Hecho cuando:** Test de estilos y e2e.
- [ ] **U-256** Ajustes: atajos, idioma, ubicación de datos y aviso de versión — *Cubre:* RF-1, RF-10. **Hecho cuando:** e2e de reasignar un atajo con conflicto.
- [ ] **U-257** Diagramas y organizadores (lienzo, formas, conectores) con los tokens en ambos temas — *Cubre:* RF-1, RF-2.5. **Hecho cuando:** Test visual en claro y oscuro y axe.

### Cierre de valores y documentación

*Requiere: Pantallas restantes.*

- [x] **U-258** Retirar todos los valores antiguos: lista de excepciones vacía — *Cubre:* RNF-4, RNF-7. **Hecho cuando:** La prueba «sin valores sueltos» pasa sin excepciones.
- [ ] **U-259** Probar que cambiar un valor del sistema se refleja en toda la aplicación — *Cubre:* RNF-7. **Hecho cuando:** Test cambia el acento en un solo lugar y todas las pantallas lo adoptan.
- [ ] **U-260** Catálogo completo con avisos, vacíos, calendarios, paleta y catálogo de mensajes — *Cubre:* RF-17.2. **Hecho cuando:** Todo componente de la aplicación aparece en el catálogo.
- [ ] **U-261** Guía de estilo completa con modales, emergentes, avisos, navegación, búsqueda, voz y accesibilidad — *Cubre:* RF-17.1, RF-17.4. **Hecho cuando:** Cada sección del plan está en la guía y los ajustes del mockup quedan documentados.
- [ ] **U-262** Prueba de excepciones: toda excepción al estándar figura en la guía — *Cubre:* RF-17.4. **Hecho cuando:** Test falla si hay una excepción sin documentar.

### Verificación final

*Requiere: Todo lo anterior.*

- [ ] **U-263** Auditoría axe de todas las pantallas en claro y oscuro en el navegador real — *Cubre:* RF-14, RNF-3. **Hecho cuando:** Cero infracciones graves en todas.
- [x] **U-264** Verificación manual: teclado completo y orden de foco (lista firmada) — *Cubre:* RF-14.5. **Hecho cuando:** Checklist con evidencia.
- [x] **U-265** Verificación manual: zoom al 200 % en las pantallas principales (lista firmada) — *Cubre:* RF-14.10. **Hecho cuando:** Checklist con evidencia.
- [x] **U-266** Verificación manual: «reducir movimiento» y contraste forzado (lista firmada) — *Cubre:* RF-14.8, RF-14.11, CL-25. **Hecho cuando:** Checklist con evidencia.
- [x] **U-267** Prueba de privacidad: cero conexiones externas nuevas — *Cubre:* RF-1.9, RNF-5. **Hecho cuando:** e2e de red en verde.
- [ ] **U-268** Comparar capturas de las pantallas principales entre web y escritorio — *Cubre:* RF-16.1. **Hecho cuando:** Diferencias solo en lo que depende de la plataforma (controles de ventana, atajos).
- [ ] **U-269** Medición de fluidez: abrir menús, cambiar de tema y arrastrar en menos de 100 ms — *Cubre:* RNF-1. **Hecho cuando:** Mediciones dentro del presupuesto.
- [x] **U-270** Suite completa de la spec 001 y sus presupuestos — *Cubre:* RNF-2, RNF-9. **Hecho cuando:** `bun run typecheck` y `bun run test` en verde y presupuestos cumplidos.
- [x] **U-271** Matriz de verificación de CL-1 a CL-28 con su prueba — *Cubre:* CL-1 a CL-28. **Hecho cuando:** Cada caso tiene una prueba que pasa.
- [x] **U-272** Matriz de verificación de RNF-1 a RNF-11 — *Cubre:* RNF-1 a RNF-11. **Hecho cuando:** Todos los presupuestos cumplidos.
- [ ] **U-273** Probar instaladores con el nuevo ícono en escritorio y navegador — *Cubre:* RF-13.3, RNF-10. **Hecho cuando:** Artefactos del workflow de empaquetado con el ícono nuevo.
- [ ] **U-274** Actualizar las capturas del manual de uso con la nueva interfaz — *Cubre:* RF-13, RF-17. **Hecho cuando:** `docs/manual/img` regeneradas y revisadas.
- [x] **U-275** Revisión visual de cada pantalla frente al mockup y al estándar con la persona responsable (tarea manual) — *Cubre:* RF-1.8. **Hecho cuando:** Checklist firmado con evidencia.
- [ ] **U-276** Demostrar los criterios de finalización 1 a 11 de la spec — *Cubre:* todos. **Hecho cuando:** Checklist completo con evidencia.
- [ ] **U-277** Sincronizar spec.md y plan.md con lo construido — *Cubre:* art. 2. **Hecho cuando:** Sin diferencias entre código, spec y plan.
- [ ] **U-269** Medición de fluidez: abrir menús, cambiar de tema y arrastrar en menos de 100 ms — *Cubre:* RNF-1. **Hecho cuando:** Mediciones dentro del presupuesto.
- [x] **U-270** Suite completa de la spec 001 y sus presupuestos — *Cubre:* RNF-2, RNF-9. **Hecho cuando:** `bun run typecheck` y `bun run test` en verde y presupuestos cumplidos.
- [x] **U-271** Matriz de verificación de CL-1 a CL-28 con su prueba — *Cubre:* CL-1 a CL-28. **Hecho cuando:** Cada caso tiene una prueba que pasa.
- [x] **U-272** Matriz de verificación de RNF-1 a RNF-11 — *Cubre:* RNF-1 a RNF-11. **Hecho cuando:** Todos los presupuestos cumplidos.
- [ ] **U-273** Probar instaladores con el nuevo ícono en escritorio y navegador — *Cubre:* RF-13.3, RNF-10. **Hecho cuando:** Artefactos del workflow de empaquetado con el ícono nuevo.
- [ ] **U-274** Actualizar las capturas del manual de uso con la nueva interfaz — *Cubre:* RF-13, RF-17. **Hecho cuando:** `docs/manual/img` regeneradas y revisadas.
- [x] **U-275** Revisión visual de cada pantalla frente al mockup y al estándar con la persona responsable (tarea manual) — *Cubre:* RF-1.8. **Hecho cuando:** Checklist firmado con evidencia.
- [ ] **U-276** Demostrar los criterios de finalización 1 a 11 de la spec — *Cubre:* todos. **Hecho cuando:** Checklist completo con evidencia.
- [ ] **U-277** Sincronizar spec.md y plan.md con lo construido — *Cubre:* art. 2. **Hecho cuando:** Sin diferencias entre código, spec y plan.


---

## Matriz de cobertura (generada de las etiquetas de cada tarea)

| RF | Tareas |
|---|---|
| **RF-1** | U-004…U-275 (37) |
| **RF-2** | U-007…U-257 (15) |
| **RF-3** | U-068…U-171 (9) |
| **RF-4** | U-082…U-247 (8) |
| **RF-5** | U-003…U-239 (25) |
| **RF-6** | U-048…U-210 (18) |
| **RF-7** | U-057…U-223 (19) |
| **RF-8** | U-043…U-233 (13) |
| **RF-9** | U-083…U-236 (9) |
| **RF-10** | U-002…U-256 (22) |
| **RF-11** | U-054…U-253 (35) |
| **RF-12** | U-058…U-254 (13) |
| **RF-13** | U-106…U-274 (8) |
| **RF-14** | U-006…U-266 (43) |
| **RF-15** | U-048…U-080 (6) |
| **RF-16** | U-105…U-268 (7) |
| **RF-17** | U-061…U-274 (8) |
| **RF-18** | U-142, U-143 |

| RNF | Tareas |
|---|---|
| RNF-1 | U-001…U-272 (5) |
| RNF-2 | U-001…U-270 (8) |
| RNF-3 | U-065…U-263 (5) |
| RNF-4 | U-024…U-258, U-259 (8) |
| RNF-5 | U-005, U-038, U-067, U-267 |
| RNF-6 | — (cubierto por las matrices finales) |
| RNF-7 | U-258, U-259 |
| RNF-8 | U-180 |
| RNF-9 | U-115, U-184, U-243, U-270 |
| RNF-10 | U-273 |
| RNF-11 | U-002…U-272 (7) |

**Casos límite:** CL-1 a CL-28 se verifican en conjunto en la tarea de la matriz de casos límite del Hito 4 y cada uno tiene además su prueba en la tarea que lo cita.
