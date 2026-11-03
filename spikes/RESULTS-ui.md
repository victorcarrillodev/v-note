# Resultados de las verificaciones previas de la spec 002 (UI/UX)

| Tarea | Verificación | Resultado |
|---|---|---|
| U-001 | Línea base de peso (web, build de producción, antes del rediseño) | `dist` total 7,7 MB (incluye service worker); JS principal 2 272 KB; CSS 304 KB. Binario de escritorio *debug* 297 MB (no comparable). |
| U-002 | ¿El lector de respaldo v1 tolera un campo adicional en una página? | **Sí.** `validateBackup` copia solo los campos que conoce. Prueba permanente: `packages/core/src/backup/formatTolerance.test.ts`. **Decisión:** el ancho completo (y los campos opcionales futuros) se añaden **sin subir la versión del formato** (sigue en 1), escribiéndose solo cuando tienen valor. |
| U-003 | ¿BlockNote obedece variables propias? | **Sí.** Expone variables CSS (`--bn-colors-editor-background`, `--bn-colors-editor-text`, `--bn-colors-menu-background`, `--bn-colors-menu-text`, `--bn-colors-hovered-background`, `--bn-colors-side-menu`, `--bn-colors-highlights-*`, `--bn-border-radius-small/medium`, `--bn-shadow-medium`) y la propiedad `theme`. Se tematiza **asignando esas variables a los tokens** (tarea de H2). Elementos a vigilar: el menú de barra (`slashMenu={false}`, ya propio) y los controles de Mantine que usan sus propios tamaños. |
| U-004 | Peso de tipografías (solo subconjunto `latin`, suficiente para español e inglés) | Inter 48 KB + JetBrains Mono 40 KB + Source Serif 4 52 KB = **140 KB**. **Tope acordado: 200 KB** de fuentes. El subconjunto `latin-ext` (+144 KB) no se incluye. |
| U-005 | Las fuentes incluidas no producen peticiones externas | Se verifica con la prueba de red existente (`tests-e2e/privacy.e2e.test.ts`) una vez cableadas las fuentes (ver U-040). |
