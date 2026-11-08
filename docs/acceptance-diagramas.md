# Verificación de la spec 003 — Diagramas de flujo

`tests/diagramasMatrix.test.ts` comprueba que cada fila apunta a archivos que existen. Las columnas «Qué comprueba» dicen qué prueba cubre el caso o el requisito.

## Casos límite (CL-1 a CL-14)

| Caso | Archivos de prueba | Qué comprueba |
|---|---|---|
| CL-1 | `packages/core/src/diagrams/routing/orthogonal.test.ts` | Formas pegadas o con anclajes enfrentados: la ruta de 90° sigue siendo recta, ortogonal y sin cruzar las formas. |
| CL-2 | `packages/core/src/diagrams/diagram.test.ts` | Varios conectores pueden terminar en el mismo anclaje. |
| CL-3 | `packages/core/src/diagrams/anchors.test.ts` | Con la forma al tamaño mínimo o con proporciones extremas los ocho anclajes siguen distintos y sobre el contorno. |
| CL-4 | `packages/core/src/diagrams/routing/orthogonal.test.ts` | Si ninguna ruta evita las formas, se rodea por fuera con una «U» ortogonal; 200 diseños aleatorios cumplen las propiedades. |
| CL-5 | `packages/core/src/diagrams/diagram.test.ts` | Un conector con ambos extremos libres se crea, se mueve entero y se borra. |
| CL-6 | `packages/core/src/diagrams/diagram.test.ts` | Borrar una forma deja sus conectores con el extremo libre en la última posición del anclaje y dice cuáles. |
| CL-7 | `packages/ui/src/diagram/diagramContrast.test.ts` | El aviso de contraste del texto no bloquea y usa el relleno visible mezclado con su opacidad. |
| CL-8 | `packages/ui/src/diagram/ShapeNode.test.ts` | «Sin relleno» y 0 % de opacidad conservan la caja de la forma, que sigue siendo seleccionable. |
| CL-9 | `packages/ui/src/diagram/DiagramEditor.routes.test.tsx` | Cambiar de trazado conserva anclajes y estilo, descarta los ajustes del trazado anterior y lo avisa con Deshacer. |
| CL-10 | `packages/ui/src/diagram/metrics.test.ts` | A zoom 0,1 y 4 los símbolos mantienen un tamaño visible y las áreas activas el mismo tamaño en pantalla. |
| CL-11 | `packages/core/src/diagrams/migrate.test.ts` | Diagramas antiguos con conectores cruzados se abren con los mismos puntos de unión y trazo que tenían. |
| CL-12 | `packages/ui/src/diagram/DiagramEditor.connect.test.tsx` | Con puntero grueso el imán es de 24 px, actúa al soltar y las áreas activas miden 44 px. |
| CL-13 | `packages/core/src/backup/diagramsBackup.test.ts` | Un respaldo anterior a la spec se restaura completo y su diagrama se abre migrado. |
| CL-14 | `packages/ui/src/diagram/DiagramEditor.connect.test.tsx` | Deshacer tras borrar una forma con conectores devuelve la forma y sus uniones originales. |

## Requisitos no funcionales (RNF-1 a RNF-8)

| Requisito | Archivos de prueba | Qué comprueba |
|---|---|---|
| RNF-1 | `packages/core/src/diagrams/path.perf.test.ts`, `tests-e2e/diagramScale.e2e.test.ts` | Con 200 formas y 300 conectores, recalcular los de una forma movida cabe en 100 ms y el arrastre no tiene pausas notorias (medido en Chrome real). |
| RNF-2 | `packages/core/src/backup/diagramDefaultsBackup.test.ts` | El respaldo conserva todo lo nuevo, determinista y sin cifrar, y se restaura. |
| RNF-3 | `tests-e2e/diagramAnchors.e2e.test.ts` | Auditoría axe del editor con formas y conectores seleccionados, en claro y oscuro, sin infracciones graves. |
| RNF-4 | `tests-e2e/privacy.e2e.test.ts` | Ninguna conexión externa nueva. |
| RNF-5 | `packages/ui/src/design/looseValues.test.ts` | Ningún color o tamaño suelto en la interfaz nueva: todo sale de los tokens. |
| RNF-6 | `packages/ui/src/i18n/i18n.test.tsx` | Los textos nuevos existen en español de México y en inglés con las mismas claves. |
| RNF-7 | `packages/core/src/diagrams/migrate.test.ts` | Los diagramas y respaldos anteriores se abren sin perder datos ni cambiar de aspecto. |
| RNF-8 | `spikes/RESULTS-diagramas.md` | Sin dependencias nuevas; el aumento de peso estimado se anota en el documento. |

## Criterios de finalización de la spec (sección 8)

| N.º | Criterio | Evidencia |
|---|---|---|
| 1 | Unir un conector a cualquiera de los 8 anclajes y que quede ahí | `tests-e2e/diagramAnchors.e2e.test.ts` (G-080), `packages/ui/src/diagram/DiagramEditor.connect.test.tsx` |
| 2 | Al mover o redimensionar, ningún conector cambia de anclaje | `tests-e2e/diagramAnchors.e2e.test.ts` (G-081), `packages/core/src/diagrams/diagram.test.ts` |
| 3 | Conectores con extremos libres | `tests-e2e/diagramAnchors.e2e.test.ts` (G-082) |
| 4 | Los cuatro trazados con ajuste manual | `tests-e2e/diagramRoutes.e2e.test.ts`, `packages/core/src/diagrams/routing/orthogonal.test.ts` |
| 5 | Relleno, contorno, texto, opacidad, estilo de conector, color personalizado, predeterminados y copiar/pegar | `tests-e2e/diagramStyle.e2e.test.ts` |
| 6 | Controles legibles, táctiles y con foco, sin infracciones graves | `packages/ui/src/diagram/metrics.test.ts`, `tests-e2e/diagramAnchors.e2e.test.ts` (axe) |
| 7 | Todo se deshace y rehace y se maneja con teclado | `tests-e2e/diagramRoutes.e2e.test.ts`, `tests-e2e/diagramStyle.e2e.test.ts`, `packages/ui/src/diagram/EdgeEnds.test.tsx` |
| 8 | Diagramas y respaldos anteriores se abren sin cambios; lo nuevo entra en respaldo, restauración, exportación y búsqueda | `packages/core/src/diagrams/migrate.test.ts`, `packages/core/src/backup/diagramRestoreFlow.test.ts`, `packages/core/src/export/svg.test.ts` |
| 9 | RNF-1 a RNF-8 y `typecheck` / `test` en verde | tabla de arriba y `bun run typecheck && bun run test` |
| 10 | CL-1 a CL-14 con su prueba | tabla de arriba |

## Verificaciones manuales (lista para firmar) — **pendientes de la persona responsable**

Estas tres no se pueden cerrar solo con pruebas automáticas. Marca cada punto, anota la evidencia y firma.

### G-172 — Táctil en un dispositivo real
- [ ] El imán une al soltar el dedo cerca de un punto de unión (24 px de alcance).
- [ ] Los puntos de unión, asas y botones de zoom se pulsan sin fallar (objetivos de 44 px).
- [ ] El zoom y el desplazamiento con dos dedos no chocan con arrastrar formas ni extremos.
- Dispositivo y navegador: ______ · Evidencia (capturas o vídeo): ______ · Firma y fecha: ______

### G-173 — Símbolos sobre todos los tonos y teclado completo
- [ ] Anclajes, asas, puntos de control y selección se ven sobre cada relleno de la paleta, en claro y oscuro.
- [ ] Todo el flujo (insertar formas, conectar, cambiar trazado, estilo, copiar y pegar, deshacer) se completa solo con teclado y el orden de foco es lógico.
- Evidencia: ______ · Firma y fecha: ______

### G-178 — Demostración de los criterios de finalización 1 a 10
- [ ] Recorrido de los 10 criterios con la evidencia de la tabla anterior, en la aplicación de escritorio y en la web.
- Evidencia: ______ · Firma y fecha: ______
