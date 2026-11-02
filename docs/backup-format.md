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

## `reminders.json`
```
{ tasks:  [{ id, source, pageId, blockId, databaseId, title, due, remindAt, recurrence, done }],
  states: [{ taskId, occurrence, state, snoozedUntil }] }   // state: fired | snoozed | dismissed
```
Las fechas son **horas locales flotantes** (`AAAA-MM-DD` o `AAAA-MM-DDTHH:mm`), sin zona horaria: la persona las ve igual en cualquier zona (CL-13).

Al restaurar se valida todo antes de escribir: tipos de propiedad y de vista conocidos, páginas existentes, valores solo de propiedades de esa base, vínculos coherentes.

## `data/<id>.json`
```
{ id, parentId, position, title, icon, cover, kind, favorite,
  createdAt, updatedAt, deletedAt, deletedRootId,
  blocks: [ { id, type, props, content, children } ] }
```
`blocks` es el **modelo canónico** de bloques (texto con estilos, enlaces, tablas, anidados). No incluye el historial de deshacer.

Las **menciones** de otras páginas son contenido en línea `{ "type": "mention", "pageId": "…", "title": "…" }` (el título es el último conocido; el destino es el id). En el Markdown de lectura se escriben `[Título](page:ID)`. La tabla `links` de la base es un índice derivado: al restaurar se reconstruye desde las menciones. Añadir este tipo de contenido es compatible hacia atrás, por lo que `formatVersion` sigue en 1.

## Rutas del Markdown
`pages/<slug-del-título>--<id corto>.md`; el slug no tiene acentos ni caracteres especiales y mide como máximo 40 caracteres. Si dos páginas coincidieran, se alarga el id corto. Renombrar una página cambia la ruta del `.md`, **no** la de `data/<id>.json`.

## Qué no entra
Adjuntos de más de **100 MB** (límite individual de GitHub): se omiten, se avisa y se respalda el resto.

## Restauración
Se lee el árbol de un commit, se valida `formatVersion`, y se reconstruye el espacio desde `data/`, `trash.json` y `assets/`. Los `.md` son solo de lectura humana.
