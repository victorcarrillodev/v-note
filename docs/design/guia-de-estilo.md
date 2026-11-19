# Guía de estilo de v-note

> Generada por `packages/ui/src/design/build-guide.ts` a partir del catálogo de valores (`tokens.ts`) y comprobada por pruebas. Implementa la spec 002 (`docs/specs/002-v-note-ui`). **No edites las tablas a mano**: cambia `tokens.ts` y regenera.

## Principios

1. **El contenido es el protagonista**: barras y menús discretos, acciones que aparecen al pasar el cursor.
2. **Calidez sobria**: papel cálido en claro, carbón neutro en oscuro, un solo acento azul, sin degradados en la interfaz.
3. **Orientación constante**: barra lateral y cabecera siempre en el mismo lugar.
4. **Nunca temer perder algo**: deshacer antes que preguntar; confirmar solo lo irreversible.
5. **Accesible por defecto**: AA en ambos temas, foco visible, teclado completo, movimiento reducible.
6. **Honestidad**: la interfaz solo muestra lo que el producto realmente hace.
7. **Local y privado**: ningún recurso visual viene de internet.

## Color

Los nombres son semánticos (uso, no tono). Cada valor tiene variante clara y oscura. Los valores se verificaron contra el contraste exigido (prueba `tokens.test.ts`).

| Token | Claro | Oscuro |
|---|---|---|
| `canvas` | #FCF9F5 | #131313 |
| `sidebar` | #F7F6F3 | #1B1C1C |
| `card` | #FFFFFF | #222323 |
| `raised` | #EFEDE8 | #2A2B2B |
| `border` | #E9E8E4 | #282828 |
| `borderControl` | #8A8884 | #807F7B |
| `text` | #37352F | #E3E2DE |
| `textMuted` | #65635F | #A3A29E |
| `textPlaceholder` | #6E6C68 | #8C8B87 |
| `textDisabled` | #A8A6A1 | #5F5E5B |
| `accent` | #0B6BCB | #5CA6D6 |
| `onAccent` | #FFFFFF | #0B1B26 |
| `success` | #1B7F6E | #4DAB9A |
| `warning` | #9A4F08 | #E08A3C |
| `danger` | #C0312F | #EC6A67 |
| `scrim` | rgba(0, 0, 0, 0.4) | rgba(0, 0, 0, 0.6) |

Contrastes calculados (claro / oscuro): `text` sobre `canvas` 11,7 / 14,3; `textMuted` 5,7 / 7,3; `accent` 5,0 / 7,0; `borderControl` sobre `canvas` 3,4 / 4,6.

### Chips y avisos semánticos (texto / fondo, contraste entre paréntesis)

| Tipo | Claro | Oscuro |
|---|---|---|
| info | #0B5CAD / #DCEBFA (5,5) | #8EC3E8 / #1D3447 (6,8) |
| success | #145E4F / #DDF1E5 (6,5) | #7BD0AE / #1F3A2B (6,8) |
| warning | #7A3F06 / #FCE8D3 (6,9) | #F0AE72 / #46301B (6,5) |
| error | #9E2523 / #FBE3E1 (6,3) | #F5A19E / #472624 (6,7) |

### Colores de bloque (texto / resaltado)

Se guardan por **nombre**; el tema decide el valor, así «rojo» es legible en claro y en oscuro.

| Nombre | Claro | Oscuro |
|---|---|---|
| gray | #6B6A66 / #EBEAE6 | #A3A29E / #2F2F2E |
| brown | #8A4F2A / #EFE3DA | #C98B5E / #3A2F27 |
| red | #C0312F / #FBE3E1 | #EC6A67 / #472624 |
| orange | #A8540A / #FCE8D3 | #E08A3C / #46301B |
| yellow | #8A6500 / #FBF0C2 | #D9AE3A / #463A16 |
| green | #1B7F4E / #DDF1E5 | #5BC08A / #1F3A2B |
| blue | #0B6BCB / #DCEBFA | #5CA6D6 / #1D3447 |
| purple | #7A3FB5 / #EBE0F7 | #B58AE0 / #33283F |
| pink | #B5307A / #F8DFEC | #E06BA8 / #42263A |

### Ajustes respecto del mockup (RF-1.8)

| Valor del mockup | Problema (contraste calculado) | Valor del estándar |
|---|---|---|
| Texto secundario #787774 | 4,3 sobre marfil (4,27 < 4,5) | #65635F (5,7) |
| Acento #2383E2 como texto | 3,7 | #0B6BCB (5,0) |
| Advertencia #D9730D como texto | 3,1 | #9A4F08 (5,7) en claro |
| Peligro #DF5452 como texto | 3,6 | #C0312F (5,4) en claro |
| Éxito #4DAB9A como texto | 2,6 | #1B7F6E (4,6) en claro |
| Textos de 10 px | Por debajo del mínimo | Mínimo 11 px (solo etiquetas) y 12 px para el resto |

## Degradados

No se usan en la interfaz. Solo cuatro usos permitidos: portadas de página, logotipo e ícono, esqueleto de carga (estático con «reducir movimiento») y desvanecimiento de desbordamiento.

## Tipografía

Familias: sans = Inter, mono = JetBrains Mono, serif = Source Serif 4 (incluidas en la aplicación, subconjunto latino, licencia SIL OFL; sin red). Pila de respaldo del sistema.

| Nivel | Tamaño / interlineado | Peso |
|---|---|---|
| `pageTitle` | 36 / 44 | 700 |
| `h1` | 28 / 36 | 700 |
| `h2` | 22 / 30 | 600 |
| `h3` | 18 / 26 | 600 |
| `reading` | 17 / 28 | 400 |
| `dialogTitle` | 18 / 24 | 600 |
| `component` | 14 / 20 | 600 |
| `ui` | 14 / 20 | 400 |
| `uiSmall` | 13 / 18 | 500 |
| `note` | 12 / 16 | 500 |
| `label` | 11 / 14 | 600 |

Reglas: interfaz ≥ 12 px; etiqueta ≥ 11 px (solo rótulos); lectura ≥ 15 px; números tabulares en tablas y fechas.

## Espaciado, radios, elevación, movimiento, capas y tamaños

Espaciado de base 4 px: 4, 8, 12, 16, 20, 24, 32, 40, 48.

| Radio | Valor |
|---|---|
| `none` | 0 px |
| `xs` | 2 px |
| `base` | 4 px |
| `md` | 6 px |
| `lg` | 8 px |
| `full` | circular |

Elevación: en claro, borde y sombra (niveles 1 a 4: 0px 1px 2px rgba(55, 53, 47, 0.06); 0px 2px 4px rgba(55, 53, 47, 0.08); 0px 8px 16px rgba(55, 53, 47, 0.12); 0px 16px 32px rgba(55, 53, 47, 0.18)); en oscuro, escalón de superficie sin sombra difusa.

| Movimiento | Duración |
|---|---|
| `instant` | 0 ms |
| `fast` | 100 ms |
| `base` | 150 ms |
| `slow` | 220 ms |
| `exit` | 120 ms |
| `theme` | 150 ms |

Con «reducir movimiento» se eliminan desplazamientos y escalas.

| Capa | z |
|---|---|
| `content` | 0 |
| `sticky` | 10 |
| `sidebarOverlay` | 30 |
| `menu` | 40 |
| `tooltip` | 50 |
| `scrim` | 55 |
| `dialog` | 60 |
| `toast` | 70 |
| `skipLink` | 100 |

| Tamaño | Valor |
|---|---|
| `modalS` | 400 px |
| `modalM` | 520 px |
| `modalL` | 720 px |
| `popoverMax` | 360 px |
| `panelWidth` | 380 px |
| `drawerWidth` | 560 px |
| `paletteWidth` | 640 px |
| `sidebarWidth` | 240 px |
| `headerHeight` | 44 px |
| `readingWidth` | 720 px |
| `windowMargin` | 24 px |
| `windowMin` | 900 px |

## Tamaños de ventana

Puntos de corte: ≥ 1 280 px amplio; 1 040–1 279 px normal; 900–1 039 px estrecho (la barra lateral se pliega sola y se abre superpuesta); < 900 px solo desplazamiento. **No existe diseño específico para teléfono ni tableta** (fuera de alcance de la spec 002). Ancho de lectura de página: 720 px.

## Foco y objetivos de clic

Anillo doble: 2 px de acento + 2 px de separación con la superficie. Objetivos de clic mínimos de 24 × 24 px; controles principales 32 px.

## Íconos

Un único conjunto de trazo (1,75 hasta 20 px; 1,5 desde 24 px), heredan el color del texto. Un significado = un ícono (mapa en `iconMap.ts`). Un ícono solo siempre lleva nombre accesible y tooltip.

## Componentes

Cada componente existe una sola vez y cubre sus estados (reposo, hover, foco, activo, deshabilitado, error, carga, vacío). Se consultan en el **catálogo de componentes** (entrada de desarrollo `apps/web/catalog.html`, solo en desarrollo).

## Modales, emergentes y avisos

- Confirmación destructiva: foco inicial en el botón seguro; el velo no cierra; botón de peligro.
- Modal de formulario: foco atrapado y devuelto; Escape cierra (con confirmación si hay cambios); cuerpo con desplazamiento y pie fijo; máximo dos niveles (solo una confirmación sobre un modal).
- Errores accionables: avisos persistentes en el lugar donde ocurrieron, nunca solo temporales.

## Excepciones al estándar

Toda excepción (un valor suelto, un componente propio que no usa el catálogo) debe registrarse aquí con su motivo y quién la aprobó. La prueba «sin valores sueltos» admite excepciones solo mediante `looseValues.baseline.json`, que únicamente puede encogerse.

Excepciones vigentes: ninguna nueva. La lista base contiene el código anterior al rediseño y se retira por pantallas hasta quedar vacía (tarea de cierre del Hito 4).
