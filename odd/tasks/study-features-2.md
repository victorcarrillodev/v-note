---
feature: study-features-2
status: active
created: 2026-11-27
updated: 2026-11-27
authorized-by: usuario / 2026-11-27 / puntos 5, 6, 7 y 8 del backlog
delivery: ask-on-risk
test-runner: bun run typecheck && bun run test
---
## Specs
- S1: quiero que estos puntos los guardes en una lista re atreas para poder tenerlas listas. Despues empieza por el punto 5 6 7 y8 (5: bloques de código ejecutables JS y Python en entorno aislado; 6: ecuaciones en línea, importar Markdown con $$ y mermaid, exportar Mermaid como dibujo en HTML; 7: repaso más inteligente, generar flashcards desde las notas con un atajo y estadísticas de repaso; 8: diagramas con plantillas de flujo, ER y UML y enlazar nodos del lienzo con páginas)
- S2: decisión del usuario para el punto 5: «Intérprete empaquetado, CSP intacta» (JS con intérprete en WebAssembly y Python con Pyodide, ambos empaquetados con la app, en un Worker; se permite `wasm-unsafe-eval`, nunca `unsafe-eval`).

## Dependencias nuevas (constitución, art. 1)
- Punto 5: `quickjs-emscripten` 0.32.0 (JS en WebAssembly) y `pyodide` 314.0.8 (Python en WebAssembly, ~14 MB), empaquetados con la app y sin red. Se cargan solo al ejecutar código. Constitución art. 1: dependencias registradas aquí.

## Tareas
- [x] T-1 (S1) Punto 6a: importar Markdown con `$$…$$` como bloque de ecuación y ```` ```mermaid ```` como bloque Mermaid (cierra el ciclo exportar-importar). Risk: none
- [x] T-2 (S1) Punto 6b: exportar a HTML el diagrama Mermaid dibujado (SVG), no como código. Risk: ítem 2 (se inserta un SVG ajeno en el HTML exportado; se rechaza si trae scripts, on…=, javascript: o marcos, con prueba)
- [x] T-3 (S1) Punto 6c: ecuaciones en línea (`$…$`) dentro del texto de un bloque, con exportación y búsqueda. Risk: ítem 3 (nuevo contenido en línea `math` en el modelo, Yjs y respaldo Markdown; ida y vuelta con pruebas)
- [x] T-4 (S1) Punto 7a: generar flashcards desde las notas con un atajo (a partir de la selección o del bloque). Risk: ítem 3 (acción de atajo nueva `cards.generate`, Mod+Alt+G; añadir no rompe los existentes)
- [x] T-5 (S1) Punto 7b: estadísticas de repaso en la vista Repaso (pendientes, nuevas, aprendiendo, dominadas, repasadas hoy, olvidos y retención estimada; sin racha: ver L3). Risk: ítem 3 (el estado de la tarjeta gana `last` y `lapses`; las tarjetas viejas se leen con valores por defecto)
- [x] T-6 (S1) Punto 8a: plantillas de diagrama de flujo, ER y UML. Risk: none
- [x] T-7 (S1) Punto 8b: enlazar un nodo del lienzo con una página (abrir con clic, respaldo y restauración). Risk: ítem 3 (el formato guardado del diagrama gana un campo opcional `page`; los diagramas sin él se guardan igual que antes, con prueba)
- [x] T-8 (S1, S2) Punto 5: bloque de código ejecutable (JS y Python) en Worker aislado, sin red ni acceso al DOM, con límite de tiempo. Risk: ítem 2 (ejecuta código escrito por la persona: JS en QuickJS sin APIs del host y Python con la red y el almacenamiento quitados del Worker, con tiempo, memoria y salida limitados) e ítem 5 (dependencias nuevas, CSP con `wasm-unsafe-eval`, ~14 MB de archivos empaquetados)
<!-- route=inline|delegated(<motivo: exploración | escritores paralelos | respaldo de contexto | verificador independiente>); cada tarea de código cierra con "Risk: ítem N (motivo)" o "Risk: none" -->

## Evidencia
| Tarea | Comando / comprobación | Resultado observado | Fecha |
|---|---|---|---|
| T-1 | `bun run test packages/core/src/import` | RED: 3 fallos por la razón esperada; GREEN 33 pruebas. Un fallo real hallado por la prueba: el parser convertía `\\` en `\` y destruía los saltos de línea de LaTeX; se lee el texto fuente | 2026-11-27 |
| T-2 | `bun run test packages/core/src/export packages/ui/src/page packages/ui/src/study` | RED 3 fallos; GREEN 117 (export) y 265 (page+study) | 2026-11-27 |
| T-3 | `bun run test packages/core/src/blocks/inlineMath.test.ts packages/ui/src/study/InlineMath.test.tsx` | RED 6 fallos; GREEN. Yjs ida y vuelta, búsqueda, Markdown, HTML, importación sin confundir importes ($5 y $6) y editor en línea | 2026-11-27 |
| T-4 | `bun run test packages/core/src/flashcards packages/ui/src/study/generateCards.test.ts packages/ui/src/editor/PageEditorCards.test.tsx` | RED por módulo ausente (generate.ts, generateCards.ts: sin ejecución RED aparte del adaptador); GREEN: 10 de reglas, 3 del adaptador y 2 con el editor real (crea 2 tarjetas; repetir no duplica) | 2026-11-27 |
| T-5 | `bun run test packages/core/src/flashcards packages/ui/src/study` | RED 4 fallos en núcleo y 3 en la vista; GREEN. Sin cambios en los intervalos del repaso (las pruebas previas pasan; solo se amplió la forma del estado) | 2026-11-27 |
| T-6 | `bun run test packages/core/src/diagrams packages/ui/src/diagram/diagramTemplates.test.tsx` | RED 18+3 fallos por módulo ausente; GREEN: formas válidas, sin solapes, conectores a formas existentes, textos traducidos es/en, 3 elementos en el menú «/» | 2026-11-27 |
| T-7 | `bun run test packages/core/src/diagrams/nodeLink.test.ts packages/ui/src/diagram/NodePageLink.test.tsx packages/ui/src/diagram/DiagramEditor.pageLink.test.tsx` | RED 4 fallos en núcleo; GREEN: enlazar/quitar, ida y vuelta, tipo inválido rechazado, buscar y enlazar desde el lienzo, insignia que abre la página, página ausente o en la papelera y sin contexto de enlaces | 2026-11-27 |
| T-8 | `bun run test packages/ui/src/runner packages/ui/src/editor/CodeBlockRun.test.tsx tests/desktop-csp.test.ts` | RED por módulos ausentes; GREEN: JS real (salida, errores, bucle infinito cortado, aislamiento, memoria y salida limitadas), Python real en Node (print, excepciones, stdlib, estado limpio, input), anfitrión del Worker (tiempo, cancelar, reinicio, orden), plugin de archivos y CSP | 2026-11-27 |
| T-8 (e2e) | `bunx vitest run -c vitest.e2e.config.ts tests-e2e/codeRunCsp.e2e.test.ts` | Chrome real con la CSP EXACTA de `tauri.conf.json`: JS y Python ejecutan en el Worker; `typeof fetch/window/document` indefinidos; `sum(range(5))` = 10; `js.fetch` desde Python bloqueado; 0 violaciones de CSP. Primera ejecución falló por mi texto de prueba (el editor reindenta saltos de línea) y se reescribió | 2026-11-27 |
| T-8 (revisión) | `v-ia-reviewer` ×4 sobre el candidato 443a623034b9 → risk: `changes` (BLOCKER), resilience/readability/reliability: `approve` con warnings | BLOCKER real: `lockdownGlobals` solo sombreaba `fetch`/`indexedDB`/`caches`/`importScripts` (viven en `WorkerGlobalScope.prototype`) y no cubría `navigator.storage` (OPFS). Corregido recorriendo toda la cadena de prototipos; la e2e ahora intenta esos desvíos en Chrome real (no se ejecutó antes del arreglo para verla fallar: el revisor ya lo había demostrado en Chrome) | 2026-11-27 |
| T-8 (correcciones) | `bun run test packages/ui/src/runner packages/ui/src/editor packages/ui/src/diagram packages/ui/src/study packages/core/src` ; e2e `codeRunCsp` y `mermaidExportSvg` | Resilience: reintento de carga de Pyodide, `run()` sin colgarse, cancelación por señal solo del propio bloque y al desmontar, insignia que comprueba el destino. Reliability: salida de Python sin fuga entre ejecuciones, `$…$` dentro de enlaces, `$` literal escapado en el respaldo, retención con total de repasos (83 % con 5 aciertos y 1 olvido). Risk: `isSafeSvg` estricto probado contra SVG real de Mermaid (la primera versión rechazaba todo por `<foreignObject>`; se resolvió con `htmlLabels: false` global). Readability: limitador de salida compartido, mensajes de ejecución en es/en | 2026-11-27 |

## Log
- L1: quiero que estos puntos los guardes en una lista re atreas para poder tenerlas listas. Despues empieza por el punto 5 6 7 y8 (5: bloques de código ejecutables JS y Python en entorno aislado; 6: ecuaciones en línea, importar Markdown con $$ y mermaid, exportar Mermaid como dibujo en HTML; 7: repaso más inteligente, generar flashcards desde las notas con un atajo y estadísticas de repaso; 8: diagramas con plantillas de flujo, ER y UML y enlazar nodos del lienzo con páginas)
- L2: 2026-11-27, el usuario eligió para el punto 5 «Intérprete empaquetado, CSP intacta (Recomendado)».
- L3: 2026-11-27 la «racha» de repaso (T-5) se omite: no hay historial diario por tarjeta y añadirlo exigiría una tabla nueva y su respaldo. Queda en el backlog (B-7).
- L4: 2026-11-27 T-7 no incluye retroenlaces: el índice de enlaces (`linkIndex`) solo cuenta menciones. Anotado en el backlog (B-9).

- L5: 2026-11-27 sin verificar en la app de escritorio real (WebKitGTK): la e2e corre en Chrome. WebKit puede comportarse distinto con `wasm-unsafe-eval` y Workers de módulo. Anotado en el backlog (B-14).
- L6: 2026-11-27 la revisión independiente de T-1 a T-8 salió con cambios requeridos (BLOCKER de aislamiento en Python); corregido y pendiente de nueva revisión. Sin aplicar por baja prioridad: los `as never` de `PageEditor` (generar tarjetas), el límite de memoria de Python (Pyodide acota la memoria del WebAssembly y una petición enorme da `MemoryError`, probado) y la lista negra de `isSafeSvg` sigue siendo defensa en profundidad: hoy el SVG viene de Mermaid en modo estricto.
- L7: 2026-11-27 la e2e de ejecución corre en Chrome, no en WebKitGTK (B-14).
