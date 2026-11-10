# Formato de respaldo v1

Un respaldo es una **carpeta de archivos de texto y binarios** que se sube a un repositorio **privado** de GitHub, un commit por ciclo. Es abierto: se puede leer sin la aplicación (Markdown) y contiene una copia **sin pérdida** (JSON) para restaurar todo.

## Reglas generales
- **Determinista:** el mismo contenido produce los mismos bytes (JSON con claves ordenadas, 2 espacios, fin de línea LF, un salto final). Así Git solo muestra diferencias reales.
- **Sin cifrar:** la privacidad descansa en el repositorio privado.
- **Sin secretos:** nunca incluye tokens, claves ni ajustes de la aplicación (tema, idioma, atajos).
- Versión del formato: `formatVersion: 1`. La restauración **rechaza** versiones más nuevas que la soportada.

## Estructura
| Ruta | Contenido |
|---|---|
| `workspace.json` | `{ formatVersion, id, name, pageCount }` |
| `data/<id>.json` | **Sin pérdida**, una por página (incluidas las de la papelera). Ruta estable: depende solo del id |
| `pages/<ruta>--<id8>.md` | Markdown **legible**, solo de páginas vivas. La ruta sigue la jerarquía; las páginas con hijas tienen una carpeta con el mismo nombre |
| `trash.json` | Lista `[{ id, deletedAt, deletedRootId }]` de lo que está en la papelera |
| `assets/<sha256>` | Adjuntos; el nombre es el hash SHA-256 del contenido (mismo contenido = un solo archivo) |

Añadidos en el Hito 2 (sin cambiar `formatVersion`: un respaldo sin ellos sigue siendo válido, y solo aparecen si el espacio tiene bases de datos o tareas): `databases/<id>.json` y `reminders.json`.

## `databases/<id>.json`
Un archivo por base de datos (en línea o de página completa).
```
{ id, name, pageId, hostPageId, createdAt, updatedAt,
  properties: [{ id, name, type, position, config }],     // en orden de `position`
  views:      [{ id, name, type, position, config }],     // tabla, lista, tablero, galería, calendario, línea de tiempo
  rows:       [{ pageId, position, createdAt, updatedAt, values: { <propertyId>: valor } }],
  links:      [{ propertyId, from, to }] }                 // vínculos de relación, en las dos direcciones
```
- Los **valores calculados no se guardan** (fórmulas, rollups, fechas de creación/edición, el contenido de las relaciones): se recalculan al restaurar. Solo hay `values` de propiedades editables.
- La configuración de una fórmula es `{ expression }`; la de un rollup, `{ relationPropertyId, targetPropertyId?, fn }`; la de una relación, `{ targetDatabaseId, pairedPropertyId }`.
- Las filas son páginas: su contenido está en `data/<pageId>.json`.

## `tags.json`

Spec 002 (RF-5.9). Opcional: solo existe si el espacio tiene etiquetas; un respaldo anterior sin él se restaura sin etiquetas y no hace falta subir `formatVersion`.

```
{ tags: [{ id, name, color, createdAt }], assignments: [{ pageId, tagId }] }
```

`color` es uno de los nueve nombres de la paleta (`gray`, `brown`, `red`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink`); el tema decide el valor. Las etiquetas van ordenadas por nombre y las asignaciones por página y etiqueta, para que la salida sea determinista. Al restaurar se valida antes de escribir: nombres no vacíos ni repetidos, colores de la paleta y asignaciones a páginas existentes.

## `reminders.json`

`startTime` («HH:mm», la hora de `due`) y `durationMin` (entero positivo) son opcionales (spec 002, RF-7.2): solo se escriben cuando la tarea los tiene; un respaldo anterior sin ellos se restaura igual que siempre.
```
{ tasks:  [{ id, source, pageId, blockId, databaseId, title, due, remindAt, recurrence, done, startTime?, durationMin? }],
  states: [{ taskId, occurrence, state, snoozedUntil }] }   // state: fired | snoozed | dismissed
```
Las fechas son **horas locales flotantes** (`AAAA-MM-DD` o `AAAA-MM-DDTHH:mm`), sin zona horaria: la persona las ve igual en cualquier zona (CL-13).

Al restaurar se valida todo antes de escribir: tipos de propiedad y de vista conocidos, páginas existentes, valores solo de propiedades de esa base, vínculos coherentes.

## `data/<id>.json`
```
{ id, parentId, position, title, icon, cover, kind, favorite,
  createdAt, updatedAt, deletedAt, deletedRootId,
  fullWidth?,                      // solo cuando es true (ver abajo)
  blocks: [ { id, type, props, content, children } ] }
```
**`fullWidth` (spec 002, RF-10.3):** la página ocupa todo el ancho. Se escribe **solo cuando es `true`**; ausente significa ancho normal. Así las páginas en ancho normal producen exactamente los mismos bytes que antes de existir el campo (no aparecen commits nuevos por este motivo) y un respaldo anterior a esta spec se restaura con las páginas en ancho normal. El lector de la versión 1 **ignora campos que no conoce** (comprobado en `formatTolerance.test.ts`), por lo que añadirlo es compatible hacia atrás y `formatVersion` sigue en 1. Los ajustes de apariencia del dispositivo (tema, tipografía, densidad) **no** forman parte del respaldo.

`blocks` es el **modelo canónico** de bloques (texto con estilos, enlaces, tablas, anidados). No incluye el historial de deshacer.

Las **menciones** de otras páginas son contenido en línea `{ "type": "mention", "pageId": "…", "title": "…" }` (el título es el último conocido; el destino es el id). En el Markdown de lectura se escriben `[Título](page:ID)`. La tabla `links` de la base es un índice derivado: al restaurar se reconstruye desde las menciones. Añadir este tipo de contenido es compatible hacia atrás, por lo que `formatVersion` sigue en 1.

## Diagramas de flujo (spec 003)
El bloque `diagram` guarda su contenido como texto JSON en `props.data`. Desde la spec 003 ese JSON lleva `version: 2` e incluye, además de las formas y los conectores de antes:
- **Formas:** `style` (`fill`, `fillOpacity`, `stroke`, `strokeWidth`, `strokeDash`, `textColor`) en lugar del `color` único.
- **Conectores:** `from` y `to` son un extremo **unido** (`{ node, anchor }`, con `anchor` ∈ `n, ne, e, se, s, sw, w, nw`) o **libre** (`{ x, y }`); además `route` (`straight | orthogonal | curved | free`), `style` (`color`, `width`, `dash`, `startCap`, `endCap`, `textColor`) y, según el trazado, `waypoints`, `curvature`, `points` y `smooth`.
- Los colores son `palette:<id>` (cambian con el tema) o hexadecimales (fijos).

**Compatibilidad:** `formatVersion` **sigue en 1**. Un diagrama guardado sin `version` (versión 1: `color` en la forma y `from`/`to` como ids) se **migra al abrirlo**, sin reescribir el respaldo hasta que la persona lo edite; un respaldo anterior a la spec 003 se restaura completo (comprobado con `tests/golden/backup-pre003-diagrams.json`). Una aplicación más antigua no sabe leer un diagrama v2 y lo marcará como dañado en pantalla, pero su texto se conserva intacto en el respaldo. El Markdown legible no cambia de forma (`> - A → B (etiqueta)`); los extremos libres se escriben `(extremo libre)`.

**Estilos predeterminados (Hito 3):** si el espacio definió estilos predeterminados de diagramas, el respaldo añade el archivo opcional `diagram-defaults.json` en la raíz (`{ shape?, edge? }`, JSON determinista); si no hay, no se escribe. Un respaldo sin él se restaura con los estilos del sistema.

## Rutas del Markdown
`pages/<slug-del-título>--<id corto>.md`; el slug no tiene acentos ni caracteres especiales y mide como máximo 40 caracteres. Si dos páginas coincidieran, se alarga el id corto. Renombrar una página cambia la ruta del `.md`, **no** la de `data/<id>.json`.

## Qué no entra
Adjuntos de más de **100 MB** (límite individual de GitHub): se omiten, se avisa y se respalda el resto.

## Restauración
Se lee el árbol de un commit, se valida `formatVersion`, y se reconstruye el espacio desde `data/`, `trash.json` y `assets/`. Los `.md` son solo de lectura humana.

## Pulido de diagramas y mapas mentales (spec 004)
Sin cambios de formato: `formatVersion` **sigue en 1** y no se añade ningún archivo. Los datos nuevos viajan dentro del texto JSON del propio bloque (`props.data`) como **campos aditivos y opcionales**; el escritor no emite un campo sin valor, de modo que un diagrama o mapa sin editar produce exactamente los mismos bytes que antes.
- **Diagrama (`diagram`):** `view` opcional con `height` (alto del lienzo en px, entre 240 y 1600). Sin él se usa el alto de siempre.
- **Mapa mental (`mindmap`):** `view` opcional con `height` en el árbol; en cada globo, `off` opcional (`{x, y}`: desplazamiento respecto a la distribución automática, heredado por los hijos) y `style` opcional (`fill`, `stroke`, `text` y `line`, cada uno `palette:<id>`, hex o `none`). El organigrama comparte el modelo pero ignora estos campos.
- **Compatibilidad:** un respaldo anterior se restaura sin cambios y se ve igual. Una versión anterior de la aplicación lee un mapa nuevo sin error: conserva los campos de los globos que no conoce y pierde solo el `view` del árbol (el alto vuelve al de por defecto). El Markdown legible y el texto de búsqueda no cambian.
- **Valores finales:** cuadrícula de 20 px; alto del lienzo entre 240 y 1600 px (por defecto 420 px en el diagrama y entre 320 y 560 px en el mapa, que solo se guarda cuando se cambia); `off` sin campo cuando es (0, 0); colores inválidos se descartan al leer.
