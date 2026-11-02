# Checklist de aceptación del Hito 2 (T-322)

Criterios 3, 5 y 12 de la sección 9 de la spec. «Demostrado» = hay una prueba automatizada que lo ejercita en la aplicación real (escritorio, o Chrome para la versión web); «Parcial» indica lo que falta.

Referencia: `bun run typecheck`, `bun run test` y `bun run test:e2e`.

| # | Criterio | Estado | Evidencia | Falta |
|---|---|---|---|---|
| 3 | **Kanban**: se crea un tablero, se arrastran tarjetas entre columnas y cada tarjeta se abre como página completa | **Demostrado** (web) | `tests-e2e/databases.e2e.test.ts` T-283/T-284 (arrastre con ratón real entre columnas y dentro de una columna; orden y columna persisten al recargar) y T-286 (abrir la tarjeta y escribir en el editor); `packages/core/src/databases/boards.test.ts` (columnas, tarjetas, papelera, estados independientes entre tableros) | El e2e de arrastre corre en Chrome; en WebKitGTK de escritorio no se ha repetido |
| 5 | **Fechas y recordatorios**: un recordatorio genera notificación a su hora; si no pudo, aparece vencido al abrir; la agenda lo refleja | **Demostrado** | `tests-e2e/reminders.e2e.test.ts` (escritorio real: una notificación de verdad llega al servicio de notificaciones de D-Bus con el título de la tarea; al reabrir aparece el vencido con su espacio antes de cualquier otra acción; posponer lo oculta); `tests-e2e/remindersWeb.e2e.test.ts` (navegador: fecha, aviso y repetición desde el bloque, notificación, abrir, completar una tarea recurrente y posponer); `packages/core/src/tasks/*.test.ts` (recurrencia con fin de mes, hora flotante entre zonas, agrupación, repeticiones acumuladas) | **No hay ventana de recordatorio propia del sistema** (T-307): el aviso es del sistema y las acciones Abrir / Hecho / Posponer están en la vista «Recordatorios» dentro de la app. **Windows y macOS** no probados |
| 12 | **Bases de datos**: propiedades de todos los tipos incluidas fórmulas, relaciones y rollups, y las seis vistas | **Demostrado** (con matices) | Núcleo: `values.test.ts` (todos los tipos), `relations.test.ts`, `formulas.test.ts`, `engine*.test.ts`, `dependencies.test.ts` (1 000 casos de «ningún ciclo aceptado»), `query.test.ts`, `scale.test.ts` (50 000 filas), `engine.scale.test.ts` (10 000 filas, 92 ms completo / 0,4 ms incremental). Interfaz real: `databases.e2e.test.ts` (tabla, lista, galería, calendario con arrastre, línea de tiempo con arrastre y redimensionado, tablero, filtros, fórmula con vista previa, vista incrustada en una nota) | La creación de **relaciones y rollups desde la interfaz** no está construida (existen en el núcleo y se respaldan). El editor de cada tipo de celda se prueba en jsdom y, en la app real, para texto/número/fecha |

## Fuera de lo demostrado
- El cálculo de fórmulas corre en el hilo principal en la aplicación; el protocolo para un *worker* con cancelación existe y está probado (`engineWorker.test.ts`), pero la aplicación aún no lo usa.
- Una tarea cuyo documento está abierto en el editor no ve el cambio de «Hecho» hecho desde Recordatorios hasta reabrir la página.
- Respaldo y restauración de bases de datos y recordatorios: probado contra el servidor GitHub falso y con identidad byte a byte (`databasesBackup.test.ts`); no contra GitHub real.

Firma de aceptación: ______________________  Fecha: ______________
