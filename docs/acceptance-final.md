# Checklist final de aceptación del MVP (T-417)

Criterios 1 a 18 de la sección 9 de la spec. «Demostrado» = hay una prueba automatizada que lo ejercita; «Parcial» = se demostró lo que cabe en este entorno y lo restante se indica en «Falta» (nada se da por cumplido sin evidencia).

## Verificación de referencia (ejecutada el 2026-11-02, Manjaro/Wayland)

| Comando | Resultado |
|---|---|
| `bun run typecheck` | Sin errores |
| `bun run test` | 144 archivos, 1 531 pruebas, todas pasan |
| `bun run test:e2e` (navegador, Chrome por CDP) | Pasan todos los archivos, incluido `import.e2e.test.ts` tras corregir el worker de importación (ver abajo) |
| `bun run test:e2e` (escritorio, tauri-driver) | Pasan con el servidor de Vite sirviendo el puerto 1430 (el binario *debug* carga `devUrl`); `contract.native` solo corre con el frontend embebido (`tauri://localhost`) y no se repitió |

Hallazgo corregido durante esta verificación: el worker de importación fallaba en el navegador con `document is not defined` (el export `browser` de `decode-named-character-reference` toca el DOM al cargarse). Se resolvió con un plugin de resolución en los workers de `apps/web/vite.config.ts` y `apps/desktop/vite.config.ts`; `tests-e2e/import.e2e.test.ts` T-397/T-398 pasan.

## Criterios

| # | Criterio | Estado | Evidencia | Falta |
|---|---|---|---|---|
| 1 | Páginas y editor | **Demostrado** | `docs/acceptance-hito1.md` fila 1; `blocks.e2e`, `pwa.e2e` | — |
| 2 | Búsqueda, retroenlaces y grafo | **Demostrado** | Hito 1 fila 2; `palette.e2e`, `links.e2e`, `graph.e2e` | — |
| 3 | Kanban | **Demostrado** | `docs/acceptance-hito2.md`; `databases.e2e` | — |
| 4 | Diagramas y organizadores | **Demostrado** | `docs/acceptance-hito3.md`; `diagram.e2e`, `diagramScale.e2e`, `organizers.e2e` | Selección de conector con ratón físico |
| 5 | Fechas y recordatorios | **Demostrado** | Hito 2 fila 5; `reminders.e2e` (escritorio), `remindersWeb.e2e` | — |
| 6 | Captura rápida | **Demostrado** (atajo global solo en X11) | `capture.e2e`, `capture.native.e2e`; atajo global y bandeja: `desktopShell.e2e` (Ctrl+Alt+N con XTest en un servidor X11 aislado abre la captura; el menú de la bandeja abre la captura) | En Wayland nativo no existe el atajo global (plugin solo X11): se usa la degradación de RF-13 |
| 7 | Respaldo | **Parcial** | `packages/core/src/backup/*.test.ts` con servidor GitHub falso | Contra un repositorio privado de GitHub real |
| 8 | Restauración | **Demostrado** (servidor falso) | Identidad byte a byte serializar→restaurar→serializar | Contra GitHub real |
| 9 | Sin conexión e instalación | **Parcial** | `pwa.e2e` (instalable, sin red), `app.e2e` | Instaladores y Windows/macOS (T-025, T-033, T-224): requieren CI y otros sistemas |
| 10 | Tema e idioma | **Demostrado** | `palette.e2e` T-144, `i18n.test.tsx`, `a11y.e2e` | Contraste solo en tema claro |
| 11 | Espacios de trabajo | **Parcial** | `workspaces.test.ts`, `moveWorkspace.test.ts`, `datadir.e2e` | Diálogo nativo de carpeta (T-157) |
| 12 | Bases de datos | **Demostrado** | Hito 2 fila 12; `databases.e2e`, pruebas de núcleo | Fórmulas en el hilo principal (el worker existe y está probado) |
| 13 | Importar y exportar | **Demostrado** (PDF de escritorio aparte) | Importar: `import.e2e` T-397/T-398, `importer.test.ts`; exportar HTML: `export/html.test.ts`, `export/golden.test.ts`; PDF: `docs/export-sample.pdf` (Chrome headless) | Guardar el PDF desde el diálogo del sistema: comprobarlo a mano una vez (el e2e verifica que el diálogo se abre con el documento) |
| 14 | Hitos 1 a 4 | **Parcial** | Checklists de Hito 1, 2 y 3; Hito 4 en este documento | Hito 0: solo T-025 (CI Windows/macOS) |
| 15 | RNF-1 a RNF-13 | **Demostrado** salvo RNF-8 | `docs/acceptance-rnf-matrix.md` y `tests/rnfMatrix.test.ts` | RNF-8 (tres sistemas) requiere ejecutar `.github/workflows/ci.yml` |
| 16 | CL-1 a CL-36 | **Demostrado** | `docs/acceptance-cl-matrix.md` y `tests/clMatrix.test.ts` (37 pruebas) | — |
| 17 | Calidad | **Demostrado** | `bun run typecheck` sin errores; `bun run test` 1 531/1 531 | — |
| 18 | Plan | **Demostrado** | `specs/001-v-note-mvp/plan.md`, sincronizado en T-418 | — |

## Pendiente

- **T-025, T-033** (Windows y macOS), **T-032** (CI verde en el primer push), **T-224** (instaladores en CI): requieren otros sistemas o ejecutar los workflows en GitHub.
- **A comprobar a mano una vez:** guardar un PDF desde el diálogo de impresión (T-409) y pulsar el atajo global con el teclado físico (T-020).
- **T-019 (cerrada):** en Wayland nativo el recordatorio se limita a la notificación del sistema (sin ventana con Abrir/Hecho/Posponer, que tomaría el foco); con X11 la ventana aparece sin quitar el foco. Los vencidos se ven igualmente al abrir la app.

Firma de aceptación: ______________________  Fecha: ______________
