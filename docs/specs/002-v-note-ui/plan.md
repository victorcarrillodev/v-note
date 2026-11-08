# Plan 002 — Estándar de diseño UI/UX de v-note

> **Estado:** implementado y cerrado el 4 de noviembre de 2026 · **Implementa:** `docs/specs/002-v-note-ui/spec.md` (RF-1 a RF-18, RNF-1 a RNF-11, CL-1 a CL-28).
> **Marco:** `docs/constitution.md`. Este plan no contiene código; fija el **cómo**: valores del estándar, comportamientos, decisiones técnicas, dependencias justificadas, hitos y pruebas.
> **Nota sobre la ubicación:** el encargo mencionaba `specs/001-v-note-ui/spec.md` y `specs/001-v-note/plan.md`. Esas rutas no existen: las especificaciones viven ahora en `docs/specs/`, la primera parte es `001-v-note-mvp` y esta segunda parte es `002-v-note-ui`. Por eso el plan se guarda junto a su spec. Si prefieres otra ruta, solo hay que moverlo.
> **Cómo leerlo:** cada parte indica entre corchetes los requisitos que cubre, por ejemplo **[RF-2.3]**. Al final (sección 20) hay una matriz que comprueba que no queda ningún RF sin cubrir.

---

## 1. Resumen y principios de diseño

### 1.1 Resumen
El rediseño se apoya en tres decisiones técnicas que lo hacen mantenible:
1. **Una sola fuente de valores de diseño** (los «tokens»): color, tipografía, espaciado, radios, elevación, movimiento y capas. Ninguna pantalla define valores propios. **[RF-1, RNF-4, RNF-7]**
2. **Componentes base propios, construidos sobre primitivas accesibles de Radix** y estilizados con Tailwind, como ya indica el stack. Todas las pantallas se arman con ellos. **[RF-1, RF-17, RF-14]**
3. **Los ajustes de apariencia son preferencias del dispositivo**, salvo el ancho completo, que es un dato de la página. **[RF-10, D-9]**

### 1.2 Principios de diseño (el «por qué» de cada regla)
| # | Principio | Consecuencia en el estándar |
|---|---|---|
| P1 | **El contenido es el protagonista** | El «chrome» (barras, menús) es discreto: baja saturación, jerarquía menor y acciones que aparecen al pasar el cursor. |
| P2 | **Calidez sobria** | Fondos cálidos tipo papel en claro; carbón neutro en oscuro; un solo acento azul; sin degradados decorativos en la interfaz. |
| P3 | **Orientación constante** | Barra lateral y cabecera en el mismo lugar siempre; solo cambia el contenido. |
| P4 | **Nunca temer perder algo** | Deshacer antes que preguntar; confirmar solo lo irreversible; los errores explican y ofrecen salida. |
| P5 | **Accesible por defecto** | AA en ambos temas, foco visible, teclado completo, movimiento reducible. No es una fase final. |
| P6 | **Honestidad** | La interfaz solo muestra lo que el producto realmente hace (sin botones decorativos). **[D-1]** |
| P7 | **Local y privado** | Ningún recurso visual viene de internet. **[RF-1.9, RNF-5]** |

### 1.3 Cumplimiento de la constitución
| Artículo | Cómo lo respeta este plan |
|---|---|
| **1. Stack mínimo** | Se usa solo el stack declarado (React, Vite, Tailwind, Radix, BlockNote, Tauri, PWA, Vitest, Playwright). Las dependencias nuevas están **justificadas una por una en la sección 3**; se evita añadir bibliotecas de calendario, de fechas, de variantes de estilo o un segundo kit de interfaz. |
| **2. La spec manda / hitos** | Este plan nace de la spec 002. Si durante la construcción algo contradice la spec, se corrige primero la spec. La entrega sigue **hitos cerrados en orden** (sección 18). |
| **3. Lógica separada de la interfaz** | Las pantallas solo presentan. Lo que es regla de dominio (acciones inversas para «Deshacer», hora de inicio y fin de una tarea, ancho completo por página, etiquetas, cálculo de contraste de la paleta) va en el núcleo o en pruebas, sin importar React ni el DOM. Lo que depende de la plataforma (ventanas, bandeja, tema del sistema, preferencias) va en la capa adaptador. |
| **4. Tests obligatorios** | Toda regla de datos nueva lleva prueba (sección 17). Además, el estándar se **verifica por pruebas**: contraste, paridad de temas, ausencia de valores sueltos, accesibilidad, privacidad. |
| **5. SQLite única fuente de verdad** | Los dos únicos datos nuevos (ancho completo; y, según DA-1 y DA-2, hora de tarea y etiquetas) se guardan en la base mediante **migraciones versionadas**. Los ajustes del dispositivo no son datos del espacio. Ninguna operación sobrescribe sin confirmación. |
| **6. Respaldo abierto y privado** | El ancho completo (y lo que se decida en DA-1/DA-2) entra en el respaldo de forma **determinista** y compatible hacia atrás. Fuentes, íconos e imágenes se incluyen en la aplicación: **cero conexiones nuevas**. |
| **7. Idioma** | Todo texto nuevo en español de México con paridad en inglés. El nombre del producto sigue en un solo lugar y el logotipo se deriva de él. **[RF-13.2, RF-18]** |

---

## 2. Decisiones de plan

| ID | Decisión | Alternativas descartadas | Cubre |
|---|---|---|---|
| **DP-1** | Los valores de diseño viven en **un único lugar** como variables semánticas (con un valor para claro y otro para oscuro), consumidas por Tailwind. Las pantallas **nunca** escriben colores, tamaños ni radios sueltos. | Valores por componente: la coherencia se pierde. | RF-1, RNF-4, RNF-7 |
| **DP-2** | Componentes propios **al estilo shadcn**: envoltorios finos sobre primitivas Radix, copiados en el proyecto y estilizados con los tokens (no hay biblioteca de componentes externa). | Usar Mantine para toda la aplicación: ya llega con BlockNote, pero mezclar dos kits genera dos sistemas visuales. Se **tematiza** solo donde BlockNote lo exige (sección 11.1). | RF-1, RF-17 |
| **DP-3** | Íconos con **una sola biblioteca de SVG en línea**, optimizable por árbol, con el mismo trazo y tamaño. | Íconos en fuentes o descargados: violan la privacidad y la nitidez; emojis como íconos de interfaz: inconsistentes. | RF-1.6, RF-1.9 |
| **DP-4** | **Tipografías incluidas en la aplicación** (autoalojadas) con una pila de respaldo del sistema. | Fuentes de un CDN (prohibido, art. 6); solo fuentes del sistema (resultado distinto en cada plataforma, DA-4). | RF-1.9, CL-27 |
| **DP-5** | El tema se decide **antes del primer pintado** con un paso mínimo previo a la interfaz que lee la preferencia y el tema del sistema. | Resolverlo tras montar la interfaz: provoca un destello (viola RF-2.4). | RF-2.3, RF-2.4 |
| **DP-6** | Los avisos temporales se gestionan con **una cola única** de la interfaz; los errores accionables viven **en su contexto** como parte de cada pantalla. | Avisos globales para todo: los errores se pierden de su contexto (viola RF-11.2). | RF-11 |
| **DP-7** | «Deshacer» usa **operaciones inversas definidas en el núcleo** (restaurar de la papelera, devolver a su posición anterior), no un historial genérico en la interfaz. | Historial global en la interfaz: duplica lógica de dominio (art. 3) y es frágil. | RF-11.1, RF-11.4 |
| **DP-8** | Las vistas de calendario se construyen **propias** (mensual, semanal, línea de tiempo) sobre los tokens. | Una biblioteca de calendario completa: peso, estilos difíciles de adaptar y dependencia grande (art. 1). | RF-7, RF-8 |
| **DP-9** | El catálogo de componentes es una **entrada de desarrollo** que no se incluye en los instaladores ni en la PWA publicada. | Una pantalla dentro de Ajustes (descartado en D-8). | RF-17.2, RF-17.3 |
| **DP-10** | Los ajustes del dispositivo usan el **almacén de preferencias existente** (capa adaptador); las ventanas secundarias (captura, recordatorio) leen la misma preferencia y reaccionan a sus cambios. | Duplicar la configuración por ventana. | RF-10.2, RF-16 |

---

## 3. Dependencias nuevas (art. 1: justificadas una por una)

Ya presentes y reutilizadas: Tailwind 4, `@radix-ui/react-alert-dialog`, `cmdk` (paleta), `@dnd-kit` (arrastre), `@tanstack/react-virtual` (listas grandes), `zustand` (estado de interfaz), `@xyflow/react` (diagramas y grafo), BlockNote/Mantine (editor), `axe-core` y Vitest (pruebas).

| Dependencia | Para qué | Por qué es necesaria | Alternativa y por qué no |
|---|---|---|---|
| `@radix-ui/react-dialog` | Modales con formulario y paneles laterales | `alert-dialog` solo sirve para confirmaciones; los modales de tarea, importar y ajustes necesitan foco atrapado, Escape y devolución de foco correctos | Construirlo a mano: riesgo alto de errores de accesibilidad |
| `@radix-ui/react-popover` | Selectores de fecha y hora, filtros, menús flotantes con contenido | Posicionamiento con detección de colisiones y manejo de foco | A mano: posicionamiento frágil |
| `@radix-ui/react-dropdown-menu` | Menús de acciones («…», ordenar, tipo de vista) con navegación por teclado y búsqueda por letra | Patrón de menú accesible ya resuelto | A mano |
| `@radix-ui/react-tooltip` | Descripción de controles que solo tienen ícono | Retardos, foco y lectores de pantalla | A mano |
| `@radix-ui/react-toast` | Avisos temporales apilados con pausa al pasar el cursor | Anuncio accesible, temporizador y cierre con teclado | Cola propia: más código y más errores |
| `@radix-ui/react-tabs` | Vistas de una base de datos | Navegación con flechas y roles correctos | A mano |
| `@radix-ui/react-switch`, `@radix-ui/react-toggle-group` | Interruptor (ancho completo) y controles segmentados (tipografía, densidad, tema) | Estados y roles accesibles | Casillas y radios sueltos con estilos propios |
| `lucide-react` | Conjunto único de íconos | Licencia permisiva, SVG en línea, solo se incluyen los usados, trazo uniforme (DP-3) | Íconos propios: costo de diseño alto y menos cobertura |
| Tipografías autoalojadas (paquetes de fuentes variables con licencia abierta): **Inter**, **JetBrains Mono** y una **serif** de lectura (propuesta: *Source Serif 4*) | Pila tipográfica del estándar | Mismo aspecto en las tres plataformas, sin red (DP-4) | Fuentes del sistema: resultado desigual entre plataformas |

**Se evitan expresamente:** una biblioteca de calendario, una de selector de fechas, una de variantes de clases, una de animación, y un segundo kit de componentes. Cada una se sustituye por piezas propias muy pequeñas sobre los tokens.
**Condición de aceptación de cualquier dependencia:** no abre conexiones externas y no añade más de lo previsto al tamaño de la aplicación (se mide en el hito 0).

---

## 4. Tokens: fundamentos del estándar **[RF-1, RF-2]**

### 4.1 Color: superficies y texto
Los nombres son **semánticos** (describen el uso, no el tono). Valores definitivos tras verificar el contraste **calculado** contra la superficie donde se usan.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `lienzo` | #FCF9F5 | #131313 | Fondo del contenido |
| `lateral` | #F7F6F3 | #1B1C1C | Barra lateral, paneles laterales |
| `tarjeta` | #FFFFFF | #222323 | Tarjetas, modales, menús, paleta |
| `elevada` (hover) | #EFEDE8 | #2A2B2B | Hover y selección suave |
| `borde` (decorativo) | #E9E8E4 | #282828 | Divisores de 1 px |
| `borde-control` | #8A8884 | #807F7B | Bordes de campos y controles (≥ 3:1) |
| `texto` | #37352F | #E3E2DE | Texto principal |
| `texto-suave` | #65635F | #A3A29E | Texto secundario y metadatos |
| `texto-placeholder` | #6E6C68 | #8C8B87 | Texto de ayuda en campos |
| `texto-deshabilitado` | #A8A6A1 | #5F5E5B | Elementos no disponibles (exentos de contraste) |
| `acento` | #0B6BCB | #5CA6D6 | Acciones principales, enlaces, foco |
| `sobre-acento` | #FFFFFF | #0B1B26 | Texto sobre un fondo de acento |
| `exito` | #1B7F6E | #4DAB9A | Completado, guardado |
| `advertencia` | #9A4F08 | #E08A3C | Atención, vencido próximo |
| `peligro` | #C0312F | #EC6A67 | Errores y acciones destructivas |
| `velo` | negro 40 % | negro 60 % | Fondo detrás de modales |

**Contraste verificado (calculado):**
| Pareja | Claro | Oscuro | Requisito |
|---|---|---|---|
| `texto` / `lienzo` | 11,7 : 1 | 14,3 : 1 | ≥ 4,5 |
| `texto-suave` / `lienzo` | 5,7 : 1 | 7,3 : 1 | ≥ 4,5 |
| `texto-suave` / `elevada` | 5,1 : 1 | 5,6 : 1 | ≥ 4,5 |
| `acento` / `lienzo` (texto y enlaces) | 5,0 : 1 | 7,0 : 1 | ≥ 4,5 |
| `sobre-acento` / `acento` (botón principal) | 5,3 : 1 | 6,6 : 1 | ≥ 4,5 |
| `exito`, `advertencia`, `peligro` / `lienzo` | 4,6 / 5,7 / 5,4 : 1 | 6,7 / 7,0 / 6,0 : 1 | ≥ 4,5 |
| `borde-control` / `lienzo` y `tarjeta` | 3,4 / 3,5 : 1 | 4,6 / 3,9 : 1 (3,5 sobre `elevada`) | ≥ 3 |
| `texto-placeholder` / `lienzo` | 5,0 : 1 | 5,5 : 1 | ≥ 4,5 |

**Ajustes respecto del mockup (documentados, RF-1.8):**
| Valor del mockup | Problema (contraste calculado) | Valor del estándar |
|---|---|---|
| Texto secundario #787774 | 4,27 : 1 sobre marfil (< 4,5) | #65635F (5,7 : 1) |
| Acento #2383E2 como texto | 3,69 : 1 | #0B6BCB (5,0 : 1) |
| Advertencia #D9730D como texto | 3,12 : 1 | #9A4F08 (5,7 : 1) en claro; el naranja original se conserva en oscuro, donde sí cumple |
| Peligro #DF5452 como texto | 3,62 : 1 | #C0312F (5,4 : 1) en claro |
| Éxito #4DAB9A como texto | 2,63 : 1 | #1B7F6E (4,6 : 1) en claro |
| Textos de 10 px | Por debajo del mínimo (RF-14.2) | Mínimo 11 px (solo etiquetas), 12 px para el resto |

> **Supuesto del plan sobre DA-5:** estos ajustes se aplican por defecto. Si algún color te resulta intocable, se revisa en el hito 0 antes de fijarlo.

### 4.2 Color: estados, semánticos y de bloque
**Chips y avisos semánticos** (texto sobre su propio fondo, ≥ 4,5 : 1 calculado):
| Tipo | Claro (texto / fondo) | Oscuro (texto / fondo) |
|---|---|---|
| Información | #0B5CAD / #DCEBFA (5,5) | #8EC3E8 / #1D3447 (6,8) |
| Éxito | #145E4F / #DDF1E5 (6,5) | #7BD0AE / #1F3A2B (6,8) |
| Advertencia | #7A3F06 / #FCE8D3 (6,9) | #F0AE72 / #46301B (6,5) |
| Error | #9E2523 / #FBE3E1 (6,3) | #F5A19E / #472624 (6,7) |

**Colores de bloque** (texto de color y resaltado; reglas de **RF-2.6**: cada color tiene una variante por tema que cumple ≥ 4,5 : 1 como texto y deja legible el texto principal sobre su resaltado):
| Nombre | Texto claro | Texto oscuro | Resaltado claro | Resaltado oscuro |
|---|---|---|---|---|
| gris | #6B6A66 | #A3A29E | #EBEAE6 | #2F2F2E |
| marrón | #8A4F2A | #C98B5E | #EFE3DA | #3A2F27 |
| rojo | #C0312F | #EC6A67 | #FBE3E1 | #472624 |
| naranja | #A8540A | #E08A3C | #FCE8D3 | #46301B |
| amarillo | #8A6500 | #D9AE3A | #FBF0C2 | #463A16 |
| verde | #1B7F4E | #5BC08A | #DDF1E5 | #1F3A2B |
| azul | #0B6BCB | #5CA6D6 | #DCEBFA | #1D3447 |
| morado | #7A3FB5 | #B58AE0 | #EBE0F7 | #33283F |
| rosa | #B5307A | #E06BA8 | #F8DFEC | #42263A |

Todos los textos de color superan 4,7 : 1 sobre el lienzo de su tema y el texto principal sobre cada resaltado supera 8,6 : 1.
**Regla para contenido heredado:** el color elegido por la persona se guarda por **nombre** (no por valor); el tema decide el valor a mostrar. Así un texto «rojo» siempre es legible en claro y en oscuro (CL-5).
**Estados de interacción:** reposo → hover (`elevada`) → activo (un escalón más oscuro/claro) → seleccionado (`elevada` + indicador de acento) → deshabilitado (`texto-deshabilitado`, sin hover). Ningún estado depende **solo** del color: se acompaña de forma, texto o ícono **[RF-14.9]**.

### 4.3 Degradados
**Política: los degradados no se usan en la interfaz.** Botones, paneles, texto, bordes y fondos de datos son colores planos (P2). Solo hay **cuatro usos permitidos**, todos decorativos o funcionales:

| Uso | Especificación | Cubre |
|---|---|---|
| **Portadas de página** | Seis degradados suaves de 135° con dos paradas cada uno, un juego por tema (abajo). Nunca llevan texto encima. | RF-5.1, RF-2.5 |
| **Logotipo e ícono de la aplicación** | Degradado vertical sutil del acento a su versión 12 % más oscura, solo dentro del símbolo | RF-13 |
| **Indicador de carga (esqueleto)** | Brillo que se desplaza sobre `elevada`; en «reducir movimiento» queda **estático** | RF-12.4, RF-14.8 |
| **Desvanecimiento de desbordamiento** | De `lienzo`/`tarjeta` a transparente en los bordes de listas, pestañas y tablas que se desplazan, para sugerir más contenido | RF-15.3 |

**Portadas (claro → oscuro):** Arena #F3E7D3→#E9D4B5 / #4A3D2A→#33291C · Salvia #DCE8DA→#BFD6C2 / #2E4033→#22302A · Cielo #DCEBFA→#B9D6F2 / #243C52→#1A2B3B · Lavanda #E7DDF5→#D2C3EC / #3A2F4F→#2A223B · Rosa #F6DDE6→#EDBFD1 / #4D2E3C→#37212B · Grafito #E4E3DF→#C9C7C0 / #3A3A39→#2A2A29. Las portadas existentes de un solo color se conservan y se muestran con el mismo criterio por tema.

### 4.4 Tipografía **[RF-1.2, RF-5.3, RF-14.2]**
Familias: **Interfaz y contenido «sans»** = Inter; **«mono»** = JetBrains Mono (código, atajos, fechas técnicas); **«serif»** = una serif de lectura (solo cuando la persona lo elige, RF-10.1). Pila de respaldo del sistema para todas (CL-27). Se cargan solo los conjuntos de caracteres que necesita el español y el inglés.

| Nivel | Tamaño / interlineado | Peso | Uso |
|---|---|---|---|
| Título de página | 36 / 44 | 700 | Título editable de la página |
| Encabezado 1 (bloque) | 28 / 36 | 700 | |
| Encabezado 2 (bloque) | 22 / 30 | 600 | |
| Encabezado 3 (bloque) | 18 / 26 | 600 | |
| Lectura | 16 / 26 | 400 | Texto del contenido (cómodo) |
| Título de modal / sección de interfaz | 18 / 24 | 600 | |
| Componente (encabezados de tabla, columnas, tarjetas) | 14 / 20 | 600 | |
| Interfaz | 14 / 20 | 400–500 | Botones, listas, menús, campos |
| Interfaz pequeña | 13 / 18 | 500 | Navegación lateral, chips |
| Nota | 12 / 16 | 500 | Metadatos, atajos, contadores |
| Etiqueta | 11 / 14 | 600, mayúsculas | Solo rótulos de agrupación, nunca información esencial |

Reglas: el cuerpo de lectura **no baja de 15 px** en densidad compacta (15 / 22); la interfaz no baja de 12 px; línea de lectura de **60 a 80 caracteres** como máximo por el ancho de lectura (4.7); se usa **numeración tabular** en tablas, fechas y contadores para que no «bailen».

### 4.5 Espaciado, radios, elevación, movimiento y capas
**Espaciado (base 4 px) [RF-1.3]:** 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48. No existen otros valores. Uso: 4 (entre ícono y texto), 8 (relleno de elementos de lista), 12 (filas de tabla), 16 (relleno de tarjeta), 20 (cabecera), 24 (contenedores y modales), 32 (margen lateral del documento).
**Densidad:** *Cómoda* usa la escala completa; *Compacta* reduce 4 px el relleno vertical de listas, filas y bloques, sin tocar tamaños de texto salvo la lectura (16→15) **[RF-10.4]**.

**Radios [RF-1.4]:** ninguno (cuadrículas de calendario, paneles acoplados) · 2 px (etiquetas pequeñas) · **4 px base** (botones, campos, elementos de lista, celdas) · 6 px (tarjetas de tablero, menús) · 8 px (modales, paleta, paneles laterales) · circular (indicadores y botones redondos). No se admiten otros valores.

**Elevación [RF-1.5]:**
| Nivel | Claro | Oscuro | Uso |
|---|---|---|---|
| 0 | Plano | Plano | Contenido |
| 1 | Borde `borde` + sombra muy suave | Superficie `lateral` | Barra lateral, paneles |
| 2 | Borde + sombra suave (4 px de desenfoque) | Superficie `tarjeta` + microborde | Tarjetas, menús |
| 3 | Sombra media (16 px de desenfoque) | `elevada` + microborde | Popovers, paleta |
| 4 | Sombra marcada (32 px de desenfoque) + velo | `elevada` + microborde + velo | Modales |
En oscuro **no se usan sombras difusas**: la profundidad es el escalón de luminosidad.

**Movimiento [RF-1.7, RF-14.8]:**
| Token | Duración | Curva | Uso |
|---|---|---|---|
| instantáneo | 0 ms | — | Cambios que no deben animarse |
| rápido | 100 ms | salida suave | Hover, color, foco |
| base | 150 ms | salida suave | Abrir/cerrar menús y popovers, resaltado |
| lento | 220 ms | salida suave | Modales, paneles laterales, plegar la barra lateral |
| salida | 120 ms | entrada suave | Cierre de elementos |
| **cambio de tema** | 150 ms | lineal | Solo color de fondo y texto |
Con «reducir movimiento»: se eliminan desplazamientos y escalas; quedan **desvanecimientos de ≤ 80 ms** o cambios inmediatos; el esqueleto de carga no se anima.

**Capas (de abajo hacia arriba):** contenido (0) · cabeceras fijas (10) · barra lateral superpuesta y su velo (30) · menús y popovers (40) · tooltips (50) · velo de modal (55) · modales, paleta y paneles (60) · avisos temporales (70) · enlace «Saltar al contenido» (100). Un solo orden en toda la aplicación: nadie define capas propias.

**Foco [RF-14.3]:** anillo **doble**: 2 px de `acento` más 2 px de separación con el color de la superficie, visible en ambos temas (≥ 3 : 1 con lo que rodea). En modo de contraste forzado se usa el contorno del sistema.
**Objetivos de clic [RF-14.4]:** mínimo 24 × 24 px; controles principales 32 px; en densidad compacta se conserva el mínimo de 24 px.

---

## 5. Iconografía **[RF-1.6, RF-13, RF-14.7]**
- **Un solo conjunto** de íconos de trazo, con extremos redondeados. Tamaños: **14** (en chips y texto), **16** (base de interfaz), **20** (botones grandes, menús), **24** (cabeceras), **40 y 48** (estados vacíos). Trazo de 1,75 hasta 20 px y 1,5 desde 24 px.
- El ícono **hereda el color del texto** (no tiene color propio), salvo los semánticos de estado (éxito, advertencia, peligro).
- **Decorativos:** ocultos a los lectores de pantalla. **Solos (sin texto):** siempre con nombre accesible **y** tooltip; nunca un ícono sin nombre.
- **Un significado = un ícono** en toda la aplicación (tabla). Si un ícono cambia de significado, es un defecto.

| Significado | Ícono | Significado | Ícono |
|---|---|---|---|
| Crear / añadir | Más | Eliminar / papelera | Cubo |
| Buscar | Lupa | Restaurar | Flecha circular |
| Ajustes | Engranaje | Editar / renombrar | Lápiz |
| Favorito | Estrella | Duplicar | Dos hojas |
| Nota | Hoja | Exportar / importar | Flecha sobre bandeja / hacia ella |
| Base de datos | Tabla | Respaldo | Nube con flecha |
| Tablero | Columnas | Recordatorio | Campana |
| Calendario | Calendario | Tarea / hecha | Casilla / casilla marcada |
| Grafo | Nodos | Plegar / desplegar | Chevron |
| Más acciones | Tres puntos | Advertencia / error / éxito / info | Triángulo / círculo con signo / círculo con visto / círculo con «i» |

- **Íconos de página:** son emojis o caracteres elegidos por la persona (no son del conjunto de la interfaz) y se muestran con el mismo tamaño y alineación.
- **Íconos de la aplicación e identidad:** sección 13.

---

## 6. Componentes base y sus estados **[RF-1, RF-14, RF-17]**
Cada componente existe una sola vez y cubre sus estados: **reposo, hover, foco, activo, deshabilitado, error, carga, vacío** (cuando aplique), en ambos temas.

| Componente | Variantes y reglas |
|---|---|
| **Botón** | Primario (fondo `acento`, texto `sobre-acento`): **uno solo por vista/modal**. Secundario (contorno `borde-control`). Fantasma (sin borde, para acciones terciarias). Peligro (texto/fondo `peligro`, solo para destructivos). Ícono (cuadrado 32 px). Altura 32 (principal) y 28 (secundario/densidad compacta); radio 4. Estado de carga: ícono girando + texto, deshabilitado, sin cambiar de ancho. |
| **Campo de texto y área** | Borde `borde-control`, radio 4, altura 32; foco con anillo doble; error con borde `peligro` **y** mensaje de texto bajo el campo (no solo color). Etiqueta siempre visible (no solo placeholder). |
| **Selector (lista desplegable)** | Mismo aspecto que el campo; la lista se comporta como menú (sección 8). |
| **Casilla, interruptor, control segmentado** | Mínimo 24 px; estado marcado con forma, no solo color; los segmentados llevan el valor activo con fondo y texto reforzado. |
| **Etiqueta / chip** | Radio 2–4, 12–13 px; colores semánticos (4.2); con «×» cuando se puede quitar; truncado con «+N» (CL-9). |
| **Pestañas** | Subrayado de acento en la activa + texto de peso mayor; flechas del teclado para moverse; desvanecimiento de desbordamiento si no caben. |
| **Tooltip** | Solo para controles de ícono y atajos; aparece a los 500 ms o al foco por teclado; no contiene información esencial. |
| **Lista y árbol** | Filas de 32 px (28 compacta); hover `elevada`; selección con fondo y barra de acento; sangría con tope (CL-7). |
| **Tabla** | Cabecera fija, números tabulares, hover de fila, edición en celda; primera columna fija en tablas anchas (CL-8). |
| **Tarjeta** | Fondo `tarjeta`, radio 6, relleno 16, elevación 2; clic abre; arrastre con asa visible al hover. |
| **Insignia de conteo** | Número en cápsula con `elevada`; no mayor a «99+». |
| **Indicador de progreso** | Barra (conocido) o círculo (desconocido); con texto accesible del avance. |

---

## 7. Modales y diálogos **[RF-8, RF-11.3, RF-14.6, RF-15]**
### 7.1 Tipología y cuándo usar cada uno
| Tipo | Se usa para | Foco y cierre | Tamaño |
|---|---|---|---|
| **Confirmación destructiva** (diálogo de alerta) | Borrado definitivo, vaciar papelera, eliminar o reemplazar un espacio, descartar cambios | Foco inicial en el botón **seguro** (Cancelar); Escape cancela; clic en el velo **no** cierra | S · 400 px |
| **Modal de formulario** | Crear tarea con horario, importar, asistente de restauración, exportar | Foco inicial en el primer campo; Escape cierra (con confirmación si hay cambios sin guardar); clic en el velo **no** cierra si hay cambios | M · 520 px (L · 720 px para asistentes) |
| **Paleta de comandos** | Búsqueda y acciones | Foco en el campo; Escape cierra; clic en el velo cierra | 640 px |
| **Panel lateral** (inspector, detalle de elemento) | Detalle de un elemento del cronograma o de una fila | No modal: no atrapa el foco, pero Escape lo cierra y el foco vuelve al elemento que lo abrió | 380 px desde la derecha |
| **Popover** | Selector de fecha/hora, filtros, formato | Cierra con Escape o clic fuera; devuelve el foco | Según contenido, máx. 360 px |
| **Menú** | Acciones de una fila, «Más acciones» | Flechas, Inicio/Fin, búsqueda por letra; Escape cierra | Según contenido |

### 7.2 Reglas comunes de comportamiento
1. **Foco:** al abrir, el foco entra al elemento definido; mientras está abierto, el foco **queda atrapado** (Tab y Mayús+Tab ciclan); al cerrar, **vuelve** al elemento que lo abrió. **[RF-14.6]**
2. **Escape** siempre cierra el nivel más alto (nunca varios a la vez). **Enter** ejecuta la acción principal salvo en áreas de texto de varias líneas. **[RF-8.2]**
3. **Velo:** `velo` sobre el contenido; el contenido de fondo queda inerte (no se puede enfocar ni leer por lectores de pantalla). El desplazamiento de la página se bloquea sin que la barra de desplazamiento «salte».
4. **Apilado:** máximo **dos niveles**; solo se permite un popover o una confirmación **sobre** un modal, nunca un modal sobre otro modal.
5. **Botones:** acción principal a la **derecha**, secundaria a su izquierda; el botón destructivo es de peligro y nunca es el predeterminado. Etiquetas con verbo concreto («Eliminar definitivamente», no «Aceptar»).
6. **Contenido largo:** el cuerpo del modal se desplaza y el **pie con botones queda fijo**; el título siempre visible (CL-28).
7. **Posición:** centrado horizontalmente; a un tercio de la altura (la paleta, a 12 % desde arriba); con margen mínimo de 24 px a los bordes de la ventana.
8. **Animación:** entrada 220 ms (desvanecer + deslizar 8 px), salida 120 ms; con «reducir movimiento», solo desvanecimiento breve. **[RF-14.8]**
9. **Validación:** los errores se muestran junto a cada campo y en un resumen accesible; el botón de guardar solo se deshabilita para errores bloqueantes conocidos, con la razón visible. **[RF-8.3]**

### 7.3 Modal «Crear tarea con horario» **[RF-8]**
Campos en este orden: título, fecha, hora de inicio, hora de fin (o duración), recordatorio, repetición. Si se abre desde una franja del calendario, fecha y hora vienen **rellenas**. Los selectores de fecha y hora son popovers propios, con entrada por teclado. Errores (fin anterior al inicio, recordatorio pasado) como en 7.2 punto 9 y como ya hace el producto para recordatorios vencidos **[RF-8.3, RF-8.4]**. Al guardar, el calendario muestra la tarea en el acto **[RF-8.5]**.
> **Condicionado a DA-1:** la hora de inicio y fin (o duración) requiere un **dato nuevo** de la tarea. Supuesto del plan: se añade (ver 16.3). Si se rechaza, el modal queda con fecha y hora de recordatorio solamente.

---

## 8. Ventanas emergentes **[RF-11.1, RF-11.5, RF-14, RF-16]**
### 8.1 Popovers, menús y tooltips
- **Posición:** se abren debajo del disparador, alineados a su inicio; si no caben, se voltean o desplazan; nunca quedan cortados por la ventana ni ocultan al disparador. Separación de 4 px.
- **Cierre:** Escape, clic fuera, o elegir una opción (menús). Un menú abierto cierra al abrir otro.
- **Teclado:** el disparador abre con Enter, Espacio o flecha abajo; dentro, flechas, Inicio, Fin y búsqueda por letra.
- **Tooltip:** aparece a los 500 ms de hover o de inmediato con foco por teclado; desaparece con Escape o al salir; no recibe el foco.
- **Capas:** menús 40, tooltips 50 (4.5).

### 8.2 Avisos temporales (toasts) **[RF-11.1, RF-11.5, RF-11.6]**
- **Posición:** abajo y al **centro del área de contenido** (no sobre la barra lateral), con 24 px de margen; apilados hacia arriba, **máximo 3 visibles**; los siguientes esperan en cola.
- **Duración:** éxito 5 s; **con «Deshacer», 8 s**; la cuenta **se pausa** al pasar el cursor y al recibir foco.
- **Contenido:** ícono de gravedad + frase breve + (opcional) acción «Deshacer» + botón de cerrar. Tamaño máximo 420 px.
- **Accesibilidad:** se anuncian con `status` (éxito) o con urgencia mayor (error); se cierran con Escape o su botón; la acción «Deshacer» es alcanzable con teclado.
- **Reglas:** solo **confirmaciones y resultados**; **nunca** errores accionables (esos son persistentes y contextuales, sección 9). Un mismo aviso no se duplica (CL-17).

### 8.3 Ventanas nativas secundarias (escritorio) **[RF-16, RF-12, RF-13]**
| Ventana | Cuándo | Reglas visuales y de foco |
|---|---|---|
| **Captura rápida** | Atajo global, bandeja, o dentro de la app | 520 × 380 px, centrada, siempre encima; toma el foco (el usuario la pidió); mismo tema y tokens; **Enter con Cmd/Ctrl guarda**, Escape cancela y conserva el borrador. |
| **Recordatorio** | Al vencer un recordatorio | 380 × 150 px, esquina inferior derecha, siempre encima, **sin robar el foco**; muestra título y hora, con **Abrir**, **Hecho** y **Posponer**; se cierra tras actuar o con Escape. En Wayland nativo se limita a la notificación del sistema (limitación conocida de la spec 001). |
- Ambas **leen la misma preferencia de tema y tipografía** y reaccionan a sus cambios (DP-10). Sin controles de ventana propios: usan los del sistema **[RF-16.3]**.

---

## 9. Sistema de avisos, errores y confirmaciones **[RF-11, RF-12.5, CL-16, CL-17, CL-20]**

### 9.1 Matriz por gravedad
| Nivel | Cuándo | Componente | Persistencia | Ejemplo |
|---|---|---|---|---|
| **1. Confirmación** | Acción de bajo riesgo terminada | Aviso temporal (8.2) | 5 s; con Deshacer, 8 s | «Página movida a Proyectos · Deshacer» |
| **2. Información contextual** | Estado útil que no es error | Banda en línea, en el lugar que corresponde | Hasta que se resuelva o se cierre | «Este espacio está abierto en otra ventana: solo lectura» |
| **3. Error accionable** | Falló algo que la persona puede atender | **Aviso en línea persistente** en el contexto donde ocurrió (por ejemplo, en el panel de respaldo), con causa y botón de reintento/solución | Hasta resolver o cerrar **manualmente** | «No se pudo respaldar: token inválido · Actualizar token» |
| **4. Confirmación destructiva** | Acción irreversible | Diálogo de alerta (7.1) | Hasta decidir | «¿Eliminar definitivamente “Plan”?» |
| **5. Error global** | La aplicación o el espacio no pueden continuar | **Pantalla de error** con causa y opciones de recuperación (reintentar, elegir otra ubicación, restaurar) | Hasta resolver | Espacio no disponible en disco externo |

**Regla de oro:** un error accionable **nunca desaparece solo** y **nunca** se muestra solo como aviso temporal **[RF-11.2]**. Una pantalla nunca queda en blanco **[RF-11.8]**.

### 9.2 «Deshacer» **[RF-11.1, RF-11.4, DP-7]**
Qué acciones lo ofrecen y con qué operación inversa (definida en el núcleo y probada):
| Acción | Inversa |
|---|---|
| Mover a la papelera | Restaurar a su lugar (o raíz si el padre ya no existe) |
| Mover una página | Devolver a su padre y posición anteriores |
| Duplicar | Enviar la copia a la papelera |
| Marcar tarea hecha / cambiar estado de tarjeta | Volver al estado anterior |
| Quitar etiqueta o filtro (si aplica) | Reponerlo |
Lo irreversible (borrado definitivo, vaciar papelera, reemplazar espacio) **no** ofrece Deshacer: pide confirmación previa.

### 9.3 Mensajes y voz **[RF-11.7, RF-18]**
- **Tono:** cercano y sobrio, en español de México; sin jerga técnica ni códigos; verbos en infinitivo para acciones («Eliminar», «Restaurar»); mensajes de error con la estructura **qué pasó → por qué (si se sabe) → qué hacer**.
- **Paridad en inglés** de cada cadena; ninguna cadena fija en un solo idioma.
- Longitud: los componentes toleran hasta **+40 %** de texto (inglés/español) sin cortarse (CL-3).
- Catálogo de mensajes único (en el catálogo de componentes, 17.2) para que errores iguales se redacten igual.

### 9.4 Duplicados y ráfagas **[CL-16, CL-17]**
Los avisos temporales se **agrupan por clave**: un mismo evento repetido actualiza el aviso existente en lugar de apilar otro. Si hay más de 3, los demás esperan en cola.

---

## 10. Estructura de la ventana y barra de navegación **[RF-3, RF-4, RF-15]**

### 10.1 Marco
| Elemento | Especificación |
|---|---|
| **Barra lateral** | **240 px** fijos, fondo `lateral`, borde derecho `borde`. Mismo lugar y proporciones en **todas** las pantallas **[RF-3.2]**. |
| **Cabecera** | **44 px** de alto, fondo `lienzo`, borde inferior `borde`; mismo lugar siempre. |
| **Contenido** | Resto del ancho; desplazamiento propio. En páginas, ancho de lectura **720 px** centrado (ancho completo: todo el ancho con 32 px de margen) **[RF-3.5]**. |
| **Plegado** | Control visible (ícono) en la cabecera y atajo de teclado; el estado se recuerda **[RF-3.3]**. |

### 10.2 Contenido de la barra lateral **[RF-4]**
De arriba abajo, con separación de 16 px entre grupos:
1. **Espacio de trabajo activo:** logotipo, nombre y selector (menú con los espacios, «Crear espacio» y «Gestionar espacios»).
2. **Acceso a búsqueda:** campo falso con la etiqueta «Buscar» y el atajo visible; abre la paleta (sección 11).
3. **Favoritos** (si existen): lista corta con ícono.
4. **Páginas:** el árbol (nota/base/tablero con su ícono), con el botón de **Nueva página** en el encabezado del grupo.
5. **Accesos secundarios** (jerarquía visual menor: texto suave, 13 px): Captura rápida, Grafo, Importar, Recordatorios, Respaldo, Ajustes, Papelera.
No aparecen «Invitar miembros», «Actualizaciones» ni otras cuentas **[RF-4.5, D-1]**.

**Árbol de páginas [RF-4.2, RF-4.3, CL-7]:** fila de 32 px (28 compacta); ícono + título (truncado con «…» y título completo en tooltip, CL-1); indicador de plegar a la izquierda; **página activa** con fondo `elevada` y barra de acento; **acciones contextuales al hover/foco** (nueva subpágina, más acciones) a la derecha **sin mover el texto**; sangría de 16 px por nivel con **tope visual a 6 niveles** (más niveles no sangran más, y el ancestro aparece como ruta en la cabecera); virtualización para miles de páginas (ya existente).

### 10.3 Cabecera **[RF-3.4, DA-3]**
De izquierda a derecha: control de plegar barra · **migas de pan** (ruta de ancestros; cada una navegable; truncan desde el medio con «…») · espacio flexible · **estado de guardado** · acciones de la página (favorito, exportar, más acciones).
**Estado de guardado (supuesto del plan sobre DA-3):** indicador discreto con ícono y texto: «Guardado» (éxito, tenue), «Guardando…» (neutro), «No se guardó · Reintentar» (peligro, persistente). La fecha/hora de la última edición («Editado hace 2 min») va en la fila de datos de la página y como tooltip del indicador.

### 10.4 Adaptación al tamaño **[RF-15, CL-6, CL-25]**
| Ancho de ventana | Comportamiento |
|---|---|
| **≥ 1 280 px** | Barra lateral 240 px + contenido; panel lateral de detalle posible a la derecha. |
| **1 040 – 1 279 px** | Igual, pero los paneles de detalle se superponen al contenido en lugar de empujarlo. |
| **900 – 1 039 px** | La barra lateral se **pliega sola** y se abre como **panel superpuesto** con velo (se cierra al elegir una página o con Escape). |
| **< 900 px** | Se **permite el desplazamiento** en lugar de comprimir; no hay diseño de teléfono. |
Los valores 900 y 1 040 son propuestas a validar con tu uso real (DA-6). Vistas anchas (tablas, tablero, calendario semanal) **se desplazan por sí mismas** con desvanecimiento en el borde, sin deformar la pantalla. Con zoom al 200 % la aplicación se comporta como en el ancho estrecho: todo sigue siendo utilizable, sin desplazamiento horizontal en el texto de lectura **[RF-14.10]**.

---

## 11. Búsqueda y paleta de comandos **[RF-9]**
- **Entrada:** el atajo configurado (por defecto Ctrl/Cmd+K) o el campo «Buscar» de la barra lateral.
- **Marco:** modal centrado a 12 % desde arriba, **640 px** de ancho, alto máximo 70 % de la ventana, radio 8, elevación 3–4 con velo **[RF-9.1]**. Foco en el campo de búsqueda.
- **Estructura:** campo de búsqueda (con ícono y botón de limpiar) · fila de **filtros** como chips (espacio, tipo, fecha, «incluir papelera») · lista de resultados agrupada.
- **Sin texto:** grupos **«Recientes»** (últimas páginas) y **«Acciones»** (crear página, cambiar tema, ir a ajustes…), cada acción con su **atajo** a la derecha **[RF-9.1, RF-9.3]**.
- **Con texto:** resultados en vivo; cada fila muestra ícono del tipo, **título con la coincidencia resaltada**, ruta (espacio › padres) en texto suave y fragmento del contenido; recorrido con flechas, **Enter** abre, **Ctrl/Cmd+Enter** abre en segundo plano si aplica; **Escape** cierra **[RF-9.2]**.
- **Fila:** 36 px (32 compacta); el elemento activo tiene fondo `elevada` y barra de acento (no solo color).
- **Sin resultados:** mensaje «No hay coincidencias para “texto”» con la acción **«Crear una página con este título»** **[RF-9.4]**.
- **Cierre:** el foco vuelve al elemento que lo tenía **[RF-9.5]**.
- **Rendimiento:** resultados visibles en < 100 ms tras escribir (con debounce corto) **[RNF-1]**.
- **Búsqueda no cruza espacios** (regla de la spec 001 se mantiene).

---

## 12. Página y editor **[RF-5, RF-2.6, RF-2.7]**

### 12.1 Integración con el editor
El editor (BlockNote) trae su propia interfaz (menús, barras) basada en Mantine. El plan **no** añade otro kit: **tematiza** la interfaz del editor con los tokens (colores, radios, fuentes, sombras, foco) mediante el mecanismo de temas del propio editor, de modo que los menús del editor y los de la aplicación sean indistinguibles. Riesgo y mitigación en la sección 19.

### 12.2 Presentación de la página
| Parte | Especificación | Cubre |
|---|---|---|
| **Portada** | Franja de 160 px (degradado o color, 4.3); controles «Cambiar/Quitar portada» al hover | RF-5.1 |
| **Ícono** | Emoji 44 px sobre la portada o junto al título | RF-5.1 |
| **Título** | «Título de página» (4.4), editable, parte en varias líneas sin desbordar (CL-1); sin título = «Sin título» en tono atenuado (CL-2) | RF-5.1 |
| **Fila de datos** | **Última edición** y **etiquetas**; **sin propietario ni autoría** | RF-5.2 |
| **Contenido** | Lectura 16/26 (compacta 15/22); ancho 720 px o completo; bloques separados por 4–8 px verticales | RF-5.3, RF-3.5 |
| **Pie** | Retroenlaces (ya existentes) con el estilo de lista del estándar | — |

### 12.3 Menú de bloques con `/` **[RF-5.4]**
Panel de 320 px, radio 8, elevación 3, altura máxima 360 px con desplazamiento. **Grupos nombrados** (Texto, Listas, Medios, Avanzado, Más bloques) con rótulo de 11 px; cada fila de 40 px: **ícono en cuadro de 32 px**, nombre (14 px), descripción corta (12 px, suave) y **atajo** a la derecha. Filtrado por texto al escribir; flechas y Enter; Escape cierra y deja `/` como texto. Sin resultados: «Sin bloques para “texto”».

### 12.4 Barra de formato flotante **[RF-5.5]**
Aparece sobre la selección tras 150 ms; fondo `tarjeta`, elevación 3, radio 6, 36 px de alto; botones de ícono de 28 px con tooltip y atajo: negrita, cursiva, subrayado, tachado, código, enlace, **color** y **resaltado** (popover con los nueve colores de 4.2 y «Sin color») y **«Convertir en…»** (menú). El botón activo muestra estado pulsado (fondo `elevada` + forma). Se oculta al perder la selección.

### 12.5 Bloques **[RF-5.6]**
| Bloque | Presentación |
|---|---|
| Cita | Barra de 3 px `borde-control` a la izquierda, texto suave y sangría 16 px |
| Aviso destacado | Fondo y texto semánticos de 4.2 (info, éxito, advertencia, error), ícono de gravedad, radio 6; **el ícono y el rótulo acompañan al color** (RF-14.9) |
| Lista de verificación | Casilla de 18 px con marca; texto tachado y suave al completarse |
| Código | Fondo `elevada`, mono 13/20, radio 6, cabecera con **lenguaje** y botón **«Copiar»** (confirma con «Copiado» 1,5 s) |
| Tabla | Cabecera `elevada`, bordes `borde`, celdas con relleno 8 × 12 |
| Imagen | Ajuste al ancho disponible sin deformarse; pie centrado 13 px; **marco neutro** en oscuro para fondos claros (RF-2.7, CL-22) |
| Desplegable | Chevron que rota (rápido), contenido con sangría |
| Tarjeta de enlace | Fondo `tarjeta`, borde `borde`, radio 6, dominio en texto suave |
| Bloque no soportado/dañado | Marcador neutro con texto explicativo (CL-21) |
**Asa y acción de insertar:** aparecen **solo** al pasar el cursor o enfocar el bloque, a la izquierda, sin desplazar el texto **[RF-5.7]**.

### 12.6 Tabla de contenidos **[RF-5.8]**
Aparece **solo** con tres o más encabezados, como columna de 200 px a la derecha del contenido (≥ 1 280 px) o como menú «En esta página» en la cabecera (anchos menores). Marca la **sección visible**; clic/Enter navega con desplazamiento suave (instantáneo con movimiento reducido).

### 12.7 Etiquetas **[RF-5.9, DA-2]**
Chips con color semántico de 4.2 en la fila de datos; «+» abre un popover para elegir o crear etiquetas del espacio. Supuesto del plan: **etiquetas del espacio de trabajo** (nombre + color), asignables a páginas, buscables y respaldadas (16.4). Si DA-2 se resuelve de otra forma, esta parte se ajusta.

### 12.8 Ancho completo y ajustes de página **[RF-10.3, RF-3.5]**
El interruptor «Ancho completo» vive en el menú «Más acciones» de la cabecera de la página; el cambio es inmediato y se conserva con la página y su respaldo (16.2).

---

## 13. Estados vacíos, de carga, sin conexión e identidad **[RF-12, RF-13]**

### 13.1 Estados vacíos y bienvenida **[RF-12.1, RF-12.2, RF-13.5]**
| Situación | Contenido |
|---|---|
| **Primera apertura (sin espacios)** | **Pantalla de bienvenida:** logotipo grande, frase de presentación, y dos acciones: **«Crear espacio»** (principal) y **«Restaurar desde un respaldo»** (secundaria) |
| Espacio sin páginas | Ilustración + «Aún no hay páginas» + botón «Crear la primera» |
| Papelera vacía | Ilustración + «La papelera está vacía» + nota «Aquí se conserva lo eliminado 30 días» |
| Base/tablero/vista sin filas | Ilustración + frase + «Nueva fila/tarjeta» |
| Búsqueda sin resultados | 11 |
| Calendario sin eventos | Mensaje breve + «Crear tarea» |
| Recordatorios sin pendientes | «No tienes recordatorios vencidos ni tareas para hoy» |
**Ilustraciones:** conjunto propio de dibujos de línea sencillos (SVG en línea, 120 px), monocromos con acento, que funcionan en ambos temas; tono cálido y sobrio.

### 13.2 Carga y operaciones largas **[RF-12.3, RF-12.4]**
- **Esqueletos** neutros que reservan el espacio (sin saltos de diseño) para listas, página y tablas.
- **Operaciones largas** (importar, exportar, respaldar, restaurar): indicador de progreso con porcentaje cuando se conoce y botón **Cancelar**; el resto de la aplicación sigue utilizable.
- Una acción con respuesta inmediata no muestra indicador; a partir de **300 ms** aparece un indicador discreto, para no parpadear.

### 13.3 Sin conexión **[RF-12.5, CL-20]**
La aplicación **no muestra errores** por no tener internet. Solo las funciones que lo requieren (respaldo, aviso de versión) lo indican **en su propio contexto** con el nivel 2 o 3 de 9.1, y el resto sigue igual.

### 13.4 Identidad visual **[RF-13]**
- **Logotipo:** marca de composición = **monograma + nombre**. El monograma es la **inicial del nombre del producto** en un cuadrado de radio generoso con el degradado del acento (4.3); el nombre se compone en Inter 600. Todo se **deriva del nombre configurado**, de modo que cambiarlo regenera el logotipo y el ícono **sin rediseñar pantallas** **[RF-13.2, CL-26]**.
- **Ícono de la aplicación:** el monograma sobre cuadrado redondeado, legible a 16 px; versiones para fondos claros y oscuros; generado en **todos los tamaños y formatos** que requiere cada plataforma de instalación (escritorio: Windows, macOS, Linux; navegador: instalable) **[RF-13.1, RF-13.3]**.
- **Dónde aparece:** pantalla de bienvenida, selector de espacio, y nombre del producto en el título de la ventana **[RF-13.4]**.
- **Alcance:** identidad **provisional** sobre el nombre actual (fuera de alcance: marca comercial definitiva).

---

## 14. Bases de datos, tableros, calendarios y cronograma **[RF-6, RF-7, RF-8]**

### 14.1 Bases de datos **[RF-6.1 – 6.3, 6.7]**
- **Cabecera:** ícono, título y acciones (propiedades, exportar).
- **Vistas como pestañas** (tabla, tablero, lista, galería, calendario, línea de tiempo) con ícono y botón «Nueva vista».
- **Barra de filtros:** campo de búsqueda por palabra clave; **chips** de filtro, orden y agrupación activos, cada uno con «×» y clic para editar (popover); botón «Filtros y orden». Un chip muestra «Propiedad: operador valor» y trunca con «…».
- **Tabla:** cabecera fija, **primera columna fija** con desplazamiento horizontal propio (CL-8), hover y selección de fila, edición en celda con el editor del tipo, columna final «+» para nueva propiedad, pie con conteo.
- **Vacío:** ilustración + «Nueva fila» **[RF-6.7]**.

### 14.2 Tablero **[RF-6.4, RF-6.5, RF-6.6]**
- **Columna:** 280 px, fondo `lateral`, radio 6; encabezado con **punto de color de estado + nombre + conteo + «+» + menú**; «+ Nueva tarjeta» al pie.
- **Tarjeta:** `tarjeta`, radio 6, elevación 2, relleno 12; título (14 px, 600), **fecha límite** (con ícono; en `peligro` y con texto «Vencida» si pasó), **indicador de recordatorio**, etiquetas (con «+N»). **Sin** puntos de historia, avatares ni capacidad.
- **Arrastre:** al tomar, la tarjeta se eleva (nivel 3) y queda translúcida en su origen; la columna destino se **resalta** con borde de acento y se muestra una **línea de inserción** donde caerá; autodesplazamiento al borde; Escape cancela el arrastre. Con teclado: **«Mover a…»** desde el menú de la tarjeta (alternativa accesible).

### 14.3 Calendario mensual **[RF-7.1, RF-7.6, RF-7.7, CL-10, CL-12]**
Rejilla de semanas (sin radios), **día actual** con círculo de acento, días de otro mes atenuados; cada día lista hasta N eventos y **«+N más»** que abre la lista del día; los eventos de varios días se dibujan como **barra continua**; arrastrar un evento a otro día cambia su fecha al instante. Navegación **Anterior · Hoy · Siguiente** y cambio de vista sin perder el periodo.

### 14.4 Calendario semanal por horas **[RF-7.2 – 7.4, CL-11 – CL-14]**
- Siete columnas con **cabecera de día** (el actual resaltado), eje horario a la izquierda y franja **«Todo el día»** para tareas con fecha y sin hora **[RF-7.4]**.
- **Línea de «ahora»** de acento sobre el día actual, que se actualiza cada minuto y respeta la hora local vigente.
- Eventos colocados por **hora de inicio y duración**; los que coinciden se reparten **lado a lado** sin taparse; si son demasiados, se agrupan con acceso al detalle **[RF-7.3]**.
- **Clic en una franja** abre el modal de 7.3 con la fecha y la hora de esa franja; **arrastrar** cambia día y hora; los bordes inferior/superior permiten **redimensionar** la duración. Un evento que cruza la medianoche se muestra continuo entre días.
- Teclado: flechas para moverse entre franjas, Enter para crear, Mayús+flechas para mover un evento seleccionado.
> **Condicionado a DA-1** (hora de inicio y fin como dato).

### 14.5 Cronograma (línea de tiempo) **[RF-7.5]**
Barras por rango sobre un eje de tiempo, **agrupación jerárquica** con encabezados plegables, línea de «hoy», y **panel lateral de detalle** (7.1) al seleccionar un elemento (título, fechas, estado), cerrable con Escape. Arrastrar y redimensionar barras cambia fechas.

### 14.6 Otras vistas
Lista y galería usan los componentes de 6 (tarjeta, fila, etiquetas) con el mismo comportamiento de hover, selección y vacío. **[RF-6.1]**

---

## 15. Accesibilidad, movimiento y coherencia entre plataformas **[RF-14, RF-16, RNF-3]**

### 15.1 Accesibilidad **[RF-14]**
| Requisito | Cómo se cumple |
|---|---|
| **Contraste AA [14.1]** | Paleta de 4.1–4.2 con contraste calculado; **prueba automática** que recalcula cada pareja de tokens y falla si baja del umbral (17.1) |
| **Tamaños mínimos [14.2]** | Escala de 4.4 (lectura ≥ 15, interfaz ≥ 12, etiqueta ≥ 11 solo para rótulos) |
| **Foco visible [14.3]** | Anillo doble de 4.5 en todos los elementos interactivos y en ambos temas |
| **Objetivos de clic [14.4]** | 24 px mínimo, 32 px principales |
| **Teclado completo y orden lógico [14.5]** | Enlace «Saltar al contenido» (ya existe) y orden de foco = orden visual; atajos documentados en Ajustes |
| **Diálogos y menús [14.6]** | Reglas de 7.2 y 8.1 |
| **Nombres accesibles [14.7]** | Regla de iconografía (5) y verificación axe en cada pantalla |
| **Reducir movimiento [14.8]** | Tabla de movimiento (4.5); el esqueleto no se anima; el desplazamiento suave a secciones pasa a instantáneo |
| **No solo color [14.9]** | Estados con ícono/texto/forma (4.2, 12.5, 14.2) |
| **Zoom al 200 % [14.10]** | Comportamiento de ancho estrecho (10.4); pruebas a 200 % |
| **Contraste forzado [14.11]** | Bordes y foco con colores del sistema en ese modo; nada esencial depende de fondos o sombras |

### 15.2 Coherencia web / escritorio **[RF-16]**
- Mismo diseño en ambas; lo que existe solo en escritorio (bandeja, atajo global, carpeta de datos, ventanas de recordatorio y captura, aviso de versión) **se oculta o se explica** en la web, nunca se muestra como control muerto **[RF-16.2]**.
- Convenciones: **⌘** en macOS y **Ctrl** en el resto en atajos; controles de ventana del sistema **[RF-16.3]**.
- Misma tipografía en ambas gracias a las fuentes incluidas (DP-4).

---

## 16. Ajustes de apariencia y datos nuevos **[RF-10, RNF-11]**

### 16.1 Ajustes del dispositivo **[RF-10.1, RF-10.2, RF-10.5, RF-10.6]**
Pantalla **Ajustes › Apariencia**, con **vista previa** en vivo de un fragmento de página:
| Ajuste | Opciones | Alcance |
|---|---|---|
| Tema | Claro · Oscuro · Sistema | Dispositivo |
| Tipografía del contenido | Sans · Serif · Mono | Dispositivo |
| Densidad | Cómoda · Compacta | Dispositivo |
Se aplican **al instante** en toda la aplicación y se conservan al reiniciar; **no viajan en el respaldo** (D-9). Se guardan en el almacén de preferencias existente (capa adaptador). Si no se puede guardar, el cambio se aplica en la sesión y se avisa con nivel 3 y «Reintentar» **[CL-18]**. No hay ajustes de membresías ni permisos **[RF-10.6]**. El resto de Ajustes (idioma, atajos, ubicación de datos, aviso de versión) adopta los componentes del estándar.

### 16.2 Ancho completo por página (dato nuevo) **[RF-10.3, RNF-11, CL-23, CL-24]**
- **Modelo:** una propiedad de la página (verdadero/falso, por defecto **falso**). Se añade con **migración versionada** y se lee y escribe de forma atómica con el resto de la página (art. 5).
- **Respaldo y restauración:** se escribe en el respaldo **solo cuando es verdadero**, para que las páginas existentes den **exactamente los mismos bytes** que antes (determinismo, RNF-7 de la spec 001) y no aparezcan commits nuevos por este motivo. Al restaurar un respaldo **anterior** a esta spec, las páginas quedan en ancho normal **[CL-23]**.
- **Compatibilidad del formato:** se mantiene la versión del formato de respaldo si el lector actual tolera campos adicionales; **se verifica en el hito 0**. Si no los tolera, se sube la versión del formato y el lector acepta la anterior y la nueva (art. 6: debe poder restaurarse por completo). La decisión y su prueba quedan documentadas en `docs/backup-format.md`.
- **Pruebas:** guardar/leer, migración, ida y vuelta de respaldo (propiedad de identidad ya existente), respaldo antiguo sin el campo.

### 16.3 Hora de inicio y fin de una tarea (dato nuevo, **condicionado a DA-1**)
Supuesto del plan: la tarea gana **hora de inicio y duración** (o fin), opcionales; las tareas sin hora siguen funcionando igual y aparecen en «Todo el día». Mismo tratamiento que 16.2: migración versionada, inclusión en el respaldo solo cuando existe, restauración de respaldos antiguos, y pruebas de ida y vuelta. La lógica de colocación en el calendario (solapamientos, cruce de medianoche, zona horaria) es **núcleo puro con pruebas** (art. 3 y 4).

### 16.4 Etiquetas (dato nuevo, **condicionado a DA-2**)
Supuesto del plan: catálogo de etiquetas por espacio (nombre y color de la paleta 4.2) y asignación a páginas; incluidas en búsqueda/filtros, respaldo y restauración con las mismas garantías. Se implementa **al final del hito 3** para poder retirarse sin afectar el resto si DA-2 lo decide.

---

## 17. Guía de estilo, catálogo y pruebas del estándar **[RF-17, RNF-3, RNF-4, RNF-5]**

### 17.1 Guía de estilo escrita **[RF-17.1, RF-17.4]**
Documento en `docs/design/` con: principios (1.2), cada valor de la sección 4 con su uso y contraste, los ajustes respecto del mockup y su motivo, la regla de cada componente (6), de modales (7), emergentes (8), avisos (9), navegación (10), búsqueda (11), iconografía (5), voz (9.3), accesibilidad (15) y el **procedimiento para añadir una excepción** (toda excepción se documenta). Se versiona con el código.

### 17.2 Catálogo de componentes **[RF-17.2, RF-17.3, DP-9]**
Entrada de desarrollo (no incluida en instaladores ni en la PWA publicada) que muestra **cada componente en todos sus estados y en ambos temas**, más el catálogo de mensajes, la paleta, la escala tipográfica, los íconos y las ilustraciones. Sirve además de **base de las pruebas visuales y de accesibilidad**.

### 17.3 Estrategia de pruebas **[art. 4]**
| Prueba | Qué comprueba | Cubre |
|---|---|---|
| **Contraste de tokens** | Recalcula cada pareja texto/fondo y control/superficie en ambos temas y falla bajo el umbral | RF-14.1, RNF-3 |
| **Paridad de temas** | Todo token tiene valor claro **y** oscuro | RF-2.5 |
| **Sin valores sueltos** | Falla si aparece un color, tamaño de texto, espaciado o radio fuera del sistema (como la prueba existente que impide escribir el nombre del producto fuera de la configuración) | RF-1, RNF-4 |
| **Auditoría de accesibilidad** | axe en **todas las pantallas** en claro y oscuro, en el navegador real; revisión manual de teclado, zoom 200 %, movimiento reducido y contraste forzado | RF-14, RNF-3 |
| **Privacidad** | La prueba de red existente confirma **cero conexiones nuevas** (sin fuentes ni recursos externos) | RF-1.9, RNF-5 |
| **Componentes** | Estados, teclado, foco atrapado y devuelto, Escape, cola de avisos y deduplicación | RF-7.2, RF-11, RF-14.6 |
| **Núcleo** | Operaciones inversas, ancho completo, hora de tarea, etiquetas, colocación en el calendario, migraciones y respaldo | RF-8, RF-10.3, RF-11.1 |
| **Regresión** | Toda la suite de la spec 001 y sus presupuestos de rendimiento | RNF-2, RNF-9 |
| **Rendimiento de interfaz** | Medición de apertura de menús, cambio de tema y arrastre (< 100 ms) y de la paleta | RNF-1 |
| **Idioma** | Paridad de claves es/en y prueba de textos largos | RNF-6, CL-3 |
| **Visuales** | Capturas de referencia del catálogo en ambos temas para detectar cambios no intencionados | RF-17.2 |
`bun run typecheck` y `bun run test` pasan antes de cerrar cada tarea (art. 4).

---

## 18. Hitos de entrega **[art. 2]**
No se inicia un hito hasta cerrar el anterior. Cada hito es utilizable por sí mismo.

| Hito | Contenido | Cubre | Hecho cuando |
|---|---|---|---|
| **H0 — Fundaciones** | Tokens (4), temas con pre-pintado y cambio en caliente, fuentes e íconos incluidos, primitivas y componentes base (6), estructura de modales/emergentes (7–8), guía de estilo inicial y catálogo esqueleto, pruebas de contraste/paridad/sin valores sueltos/privacidad. **Verificar** compatibilidad del respaldo (16.2) y peso de la aplicación. | RF-1, RF-2, RF-14 (base), RF-17, RNF-4, RNF-5, RNF-7 | Catálogo con todos los componentes base en ambos temas; pruebas del estándar en verde; ninguna conexión externa. |
| **H1 — Marco y navegación** | Barra lateral, cabecera, plegado y adaptación (10), estado de guardado, búsqueda y paleta (11), ajustes de apariencia (16.1), identidad y bienvenida básica (13.4) | RF-3, RF-4, RF-9, RF-10 (salvo ancho completo), RF-13, RF-15, RF-16 | Toda la aplicación usa el nuevo marco en claro/oscuro; auditoría de accesibilidad de estas pantallas; ajustes persistentes. |
| **H2 — Contenido y retroalimentación** | Página y editor (12) incluida la tabla de contenidos y el **ancho completo** con migración y respaldo (16.2); sistema de avisos, errores y confirmaciones y **Deshacer** (9); estados vacíos, carga y sin conexión (13.1–13.3) | RF-5 (salvo 5.9), RF-10.3, RF-11, RF-12, RF-18 | Editor y bloques con el estándar; errores/avisos unificados; ancho completo restaura desde respaldos antiguos y nuevos. |
| **H3 — Datos y planificación** | Bases de datos y vistas (14.1), tablero (14.2), calendarios y cronograma (14.3–14.6), modal de tarea con horario (7.3, 16.3), etiquetas (12.7, 16.4) | RF-5.9, RF-6, RF-7, RF-8 | Todas las vistas con el estándar; calendario semanal y modal funcionando; modelo y respaldo de hora de tarea y etiquetas con pruebas. |
| **H4 — Cierre** | Ventanas nativas (captura y recordatorio, 8.3), pantallas restantes (grafo, papelera, importar, exportar, respaldo, restauración, ajustes), catálogo y guía completos, auditoría completa y revisión visual contra el mockup | RF-14, RF-16, RF-17, RNF-1 – RNF-11, CL-1 – CL-28 | Criterios de finalización de la spec (sección 8) cumplidos con evidencia. |

**Regla de migración visual:** durante los hitos, las pantallas aún no migradas siguen funcionando con los valores anteriores; al cerrar H4 se **retiran** los valores antiguos (RNF-4). Nunca conviven dos sistemas de valores a la vez en una misma pantalla.

---

## 19. Riesgos y mitigaciones
| Riesgo | Impacto | Mitigación |
|---|---|---|
| El editor (BlockNote/Mantine) resiste la tematización completa | Menús del editor distintos a los de la app | Tematizar con su mecanismo oficial y complementar con estilos acotados; verificar en H0 con el menú `/` y la barra de formato; si hay elementos rebeldes, documentarlos como excepción en la guía. |
| Las fuentes incluidas aumentan el peso | Aplicación y PWA más pesadas | Conjuntos de caracteres mínimos, formatos modernos, y **medición en H0** con un tope acordado; fuente serif solo si DA-4 la confirma. |
| Dos sistemas visuales conviven durante la migración | Incoherencia temporal | Hitos por pantalla completa y retirada de valores antiguos en H4 (sección 18). |
| Los datos nuevos (ancho completo, hora de tarea, etiquetas) alteran el respaldo | Commits inesperados o restauraciones rotas | Escritura **solo cuando hay valor**, pruebas de ida y vuelta, respaldos antiguos, verificación de compatibilidad en H0. |
| Calendario semanal propio es complejo (solapamientos, zonas horarias) | Errores sutiles | Lógica de colocación como **núcleo puro con pruebas de propiedades** antes de la interfaz. |
| Ajustar valores del mockup disgusta a quien lo diseñó | Fricción | Cada ajuste documentado con su contraste; revisión en H0 (DA-5). |
| Rendimiento con temas y densidad en árboles grandes | Pérdida de fluidez | Cambios por variables (sin recalcular estilos por componente) y medición contra RNF-1/RNF-2. |

---

## 20. Matriz de trazabilidad (todos los RF cubiertos)

| RF | Descripción corta | Dónde se cubre en este plan | Hito |
|---|---|---|---|
| **RF-1** | Sistema de diseño | 1, 2 (DP-1, 3, 4), 3, **4**, 5, 6, 17 | H0 |
| **RF-2** | Temas claro/oscuro | 2 (DP-5), **4.1–4.3**, 4.5, 16.1, 12.5 (imágenes) | H0 |
| **RF-3** | Estructura de la ventana | **10.1**, 10.3, 12.2 | H1 |
| **RF-4** | Barra lateral y navegación | **10.2**, 8.1, 6 (lista y árbol) | H1 |
| **RF-5** | Página y editor | **12**, 4.2 (colores de bloque), 4.4 | H2 (5.9 en H3) |
| **RF-6** | Bases de datos y tableros | **14.1, 14.2, 14.6**, 6 | H3 |
| **RF-7** | Calendarios y cronograma | **14.3–14.5**, 16.3 | H3 |
| **RF-8** | Crear tarea con horario | **7.3**, 7.2, 16.3 | H3 |
| **RF-9** | Búsqueda y paleta | **11**, 7.1 | H1 |
| **RF-10** | Ajustes de apariencia | **16.1, 16.2**, 12.8 | H1 (10.3 en H2) |
| **RF-11** | Avisos, errores y confirmaciones | **9**, 7.1, 8.2 | H2 |
| **RF-12** | Vacíos, carga y sin conexión | **13.1–13.3**, 9.1 | H2 |
| **RF-13** | Identidad visual | **13.4**, 4.3 | H1 |
| **RF-14** | Accesibilidad y movimiento | **15.1**, 4.4, 4.5, 5, 7.2, 17.3 | H0→H4 |
| **RF-15** | Adaptación a tamaños | **10.4**, 14.1 (desplazamiento propio) | H1 |
| **RF-16** | Coherencia web/escritorio | **15.2**, 8.3 | H1, H4 |
| **RF-17** | Guía y catálogo | **17.1, 17.2**, 2 (DP-9) | H0→H4 |
| **RF-18** | Contenido y textos | **9.3**, 1.3 (art. 7) | H2 |

**Requisitos no funcionales:** RNF-1 (fluidez: 11, 17.3) · RNF-2 y RNF-9 (sin regresión: 17.3, 18) · RNF-3 (accesibilidad: 15.1, 17.3) · RNF-4 y RNF-7 (consistencia y un solo lugar: DP-1, 4, 17.3) · RNF-5 y RNF-8 (privacidad y sin conexión: DP-3, DP-4, 3, 13.3) · RNF-6 (idioma: 9.3) · RNF-10 (portabilidad: 15.2) · RNF-11 (datos: 16).
**Casos límite:** CL-1/CL-2 (10.2, 12.2) · CL-3 (9.3, 6) · CL-4 (DP-5, 4.5) · CL-5 (4.2) · CL-6 y CL-25 (10.4, 15.1) · CL-7 (10.2) · CL-8 (14.1) · CL-9 (6, 12.7, 14.2) · CL-10 a CL-14 (14.3, 14.4) · CL-15 (7.2, 7.3) · CL-16 y CL-17 (8.2, 9.4) · CL-18 (16.1) · CL-19 (13.1) · CL-20 (13.3, 9.1) · CL-21 y CL-22 (12.5) · CL-23 y CL-24 (16.2, 12.8) · CL-26 (13.4) · CL-27 (4.4, 3) · CL-28 (7.2).

---

## 21. Decisiones sobre las dudas de la spec
| ID | Duda de la spec | Decisión adoptada | Alternativa descartada |
|---|---|---|---|
| **DA-1** | Hora de inicio/fin de tareas | Se añade como dato nuevo (16.3) | El calendario semanal usa solo la hora de recordatorio; se retira el campo del modal. |
| **DA-2** | Etiquetas y plantillas | Etiquetas por espacio (16.4); plantillas fuera | Se retira la fila de etiquetas o se resuelven con propiedades de bases de datos. |
| **DA-3** | Estado de guardado | Indicador discreto con «Guardado / Guardando… / No se guardó» (10.3) | Se ajusta la cabecera. |
| **DA-4** | Tipografías | Inter + JetBrains Mono + serif de lectura, incluidas en la app (3) | Si se prefieren fuentes del sistema, se retira el paquete de fuentes y se acepta variación entre plataformas. |
| **DA-5** | Valores corregidos del mockup | Se aplican los de 4.1 (revisables en H0) | Se ajusta el valor concreto. |
| **DA-6** | Puntos de plegado y anchos | 900 / 1 040 / 1 280 px y lectura 720 px (10.4) | Se recalibran con tu tamaño de ventana habitual. |
| **DA-7** | Ubicación del mockup | Se recomienda guardar una copia versionada en el proyecto como referencia oficial | Se mantiene fuera del repositorio. |
| **DA-8** | Ubicación de la spec | `docs/specs/002-v-note-ui/` (donde está hoy) | — |
