# Tareas 006 — Temas de color

> Deriva de `spec.md` y `plan.md` de esta carpeta. Cada tarea es pequeña (**máx. 20–30 min**), está en **orden de dependencia** y cubre uno o más RF/RNF/CL.
> **Regla de ejecución (TDD):** en cada tarea se escribe **primero la prueba** (debe fallar), luego la implementación, y se marca el checkbox solo cuando se cumple **«Hecho cuando»** y `bun run typecheck` y `bun run test` pasan (constitución, art. 4).
> Las verificaciones previas de la Fase 0 viven en `spikes/temas/`, son desechables y sus resultados se anotan en `spikes/RESULTS-temas.md`. Si una verificación falla, **se detiene el trabajo y se actualiza el plan** antes de seguir (AGENTS).
> **Fases cerradas en orden** (art. 2): no se empieza una fase hasta cerrar la anterior. Dentro de un grupo, el orden de las tareas es el de ejecución; **Requiere** indica de qué grupo depende.
> **Sin tareas manuales:** cada «Hecho cuando» se comprueba con una prueba, una medición anotada o un documento revisado.
> **Exploración (AGENTS):** antes de cada grupo, `graphify affected` del símbolo que se vaya a tocar y, antes de cambiar una firma, `find_referencing_symbols` de Serena. Tras cada fase, `graphify update .`.
> **Valores de color:** los del Apéndice A del plan; no se inventan otros.
> **Total:** 91 tareas · Fase 0: 10 · Fase 1: 18 · Fase 2: 19 · Fase 3: 14 · Fase 4: 20 · Fase 5: 10
> **Estado:** implementada. 91 de 91 tareas hechas (Fases 0 a 5); ver `informe-cierre.md`.

---

## FASE 0 — Verificaciones

### Verificaciones previas (código desechable en `spikes/temas/`)

*Requiere: nada. Resultados en `spikes/RESULTS-temas.md`.*

- [x] **T-001** Anotar que la exportación actual no lee el tema (hoja fija en `exportDocument.ts`) y comprobar que `golden.test.ts` y `tests/golden/export-v1.html` la cubren — *Cubre:* RF-6.2. **Hecho cuando:** Nota en `RESULTS-temas.md` y `golden.test.ts` en verde sin modificarse.
- [x] **T-002** Auditar los consumidores que guardan colores leídos de variables CSS o de `data-theme` (grafo, lienzos, miniaturas) con `graphify affected "readTokens"` y `find_referencing_symbols` — *Cubre:* RF-3.1, RF-3.2, CL-4. **Hecho cuando:** Lista de consumidores que no se repintan al pasar de Océano a Bosque, anotada para DP-11.
- [x] **T-003** Exportar un diagrama (SVG) sobre fondo oscuro y mirar si se lee — *Cubre:* RF-6.3, CL-12. **Hecho cuando:** Resultado anotado; DP-10 (tarjeta clara) confirmada o cambiada.
- [x] **T-004** Imprimir un documento con fondo oscuro y `print-color-adjust: exact` en Chromium — *Cubre:* RF-6.3, RF-6.4. **Hecho cuando:** Anotado si el fondo sale en el PDF generado.
- [x] **T-005** Repetir la impresión en WebKitGTK (Tauri en Linux) — *Cubre:* RF-6.3, RF-6.4. **Hecho cuando:** Resultado anotado; si falla, alternativa para DP-9 propuesta.
- [x] **T-006** Cambiar de tema con el editor abierto y texto seleccionado — *Cubre:* CL-4, RNF-3. **Hecho cuando:** Anotado que cursor y selección se conservan y que BlockNote y sus menús siguen las variables.
- [x] **T-007** Medir el cambio de tema en una página larga (≥ 2000 bloques) — *Cubre:* RNF-3. **Hecho cuando:** Tiempo anotado (objetivo menor de 100 ms).
- [x] **T-008** Comprobar con `getByRole("radio", { name })` y el árbol de accesibilidad que un grupo de radios nativos con `fieldset` y `legend` expone nombre, variante y estado — *Cubre:* RF-2.4. **Hecho cuando:** Resultado anotado; DP-7 confirmada o ajustada.
- [x] **T-009** Ver si hay `theme-color` (PWA) o tema de ventana en Tauri que deban seguir al tema, y comprobar que los temas no impiden el modo de contraste forzado (RF-14.11 de la spec 002) — *Cubre:* RF-3.3. **Hecho cuando:** Hallazgos anotados; `theme-color` y ventana no se implementan (fuera de alcance) y, si el contraste forzado se rompe, se anota la corrección para el plan.
- [x] **T-010** Cerrar la Fase 0: actualizar el plan con los resultados (DP-9, DP-10, DP-11, sección 8) — *Cubre:* RNF-3. **Hecho cuando:** Plan actualizado y sin decisiones abiertas.

---

## FASE 1 — Catálogo y CSS

### Catálogo (`packages/ui/src/design/themes.ts` y `tokens.ts`)

*Requiere: Fase 0.*

- [x] **T-011** Tipos `PaletteId`, `ThemeId`, `ThemeColors`, `ThemeDef` y la lista `PALETTE_IDS` — *Cubre:* RF-1.1, RF-1.2. **Hecho cuando:** `typecheck` pasa; test: hay exactamente los diez ids de D-1, en orden (cinco claros y cinco oscuros).
- [x] **T-012** Valores de los cinco temas claros (Océano, Bosque, Atardecer, Lavanda, Blanco y negro) en `tokens.ts` — *Cubre:* RF-1.1, RF-1.3. **Hecho cuando:** Test: cada uno tiene los 15 colores en formato `#RRGGBB` y coinciden con el Apéndice A.
- [x] **T-013** Valores de los cinco temas oscuros (Medianoche, Esmeralda, Rosa nocturna, Ámbar, Grafito) — *Cubre:* RF-1.1, RF-1.3. **Hecho cuando:** Mismo test, con los valores del Apéndice A.
- [x] **T-014** `variantOf(id)` e `isPaletteId(valor)` — *Cubre:* RF-1.2, D-2. **Hecho cuando:** Test: variante correcta de los diez; `isPaletteId("arcoiris")` es falso.
- [x] **T-015** Exportar el catálogo desde `packages/ui/src/index.ts` — *Cubre:* RNF-7. **Hecho cuando:** `index.test.ts` actualizado y en verde.

### CSS generado (`build-css.ts`, `tokens.css`)

*Requiere: catálogo.*

- [x] **T-016** `build-css.ts` genera un bloque `:root[data-palette="<id>"]` por tema, después del bloque oscuro — *Cubre:* RF-1.3, RNF-7. **Hecho cuando:** `cssTokens.test.ts` comprueba que `tokens.css` coincide con lo generado, incluidos los diez bloques.
- [x] **T-017** Cada bloque de tema declara solo los 15 tokens (ni `scrim`, ni elevaciones, ni `color-scheme`, ni chips, bloques o portadas) — *Cubre:* RF-1.5, RF-3.3. **Hecho cuando:** Test sobre `tokens.css`: el bloque de cada tema tiene 15 variables `--c-*` y nada más.
- [x] **T-018** Regenerar `tokens.css` y comprobar que los bloques claro y oscuro quedan idénticos a antes — *Cubre:* RF-1.4. **Hecho cuando:** Test con el texto de ambos bloques fijado; `git diff` de `tokens.css` solo añade los diez bloques.

### Contraste por tema (`packages/ui/src/design/themes.test.ts`)

*Requiere: catálogo y CSS.*

- [x] **T-019** Función pura `checkTheme(def)` que devuelve la lista de pares que incumplen los mínimos — *Cubre:* RF-5.1, RF-5.5. **Hecho cuando:** Test: un tema de prueba con un texto gris claro sobre fondo blanco devuelve el par que falla.
- [x] **T-020** Texto principal y suave ≥ 4,5:1 sobre `canvas`, `sidebar`, `card` y `raised`, en los diez temas (`it.each`) — *Cubre:* RF-5.1. **Hecho cuando:** Test en verde.
- [x] **T-021** Acento y estados (`success`, `warning`, `danger`) ≥ 4,5:1 sobre `canvas`, `sidebar` y `card` — *Cubre:* RF-5.1. **Hecho cuando:** Test en verde en los diez temas.
- [x] **T-022** Texto de ayuda ≥ 4,5:1 sobre `canvas` y `card`, texto sobre el acento ≥ 4,5:1 y borde de control ≥ 3:1 sobre las cuatro superficies — *Cubre:* RF-5.1. **Hecho cuando:** Test en verde en los diez temas.
- [x] **T-023** Colores de bloque de la variante ≥ 4,5:1 sobre `canvas` y `card` del tema, y texto principal ≥ 4,5:1 sobre sus fondos — *Cubre:* RF-5.2, CL-6. **Hecho cuando:** Test en verde en los diez temas.
- [x] **T-024** Colores de acento de página (`ACCENT_IDS`) ≥ 4,5:1 sobre `canvas` y `card`, y `onAccent` sobre ellos ≥ 4,5:1 — *Cubre:* RF-4.1, CL-7. **Hecho cuando:** Test en verde en los diez temas.
- [x] **T-025** Blanco y negro: texto y acento sobre `canvas` en 21:1 — *Cubre:* RF-5.3. **Hecho cuando:** Test que comprueba 21:1 exacto.
- [x] **T-026** Texto principal ≥ 4,5:1 sobre los fondos de chips (llamadas de la exportación) de la variante — *Cubre:* RF-5.1, RF-6.3. **Hecho cuando:** Test en verde en los diez temas.
- [x] **T-027** Los estados no dependen solo del color: comprobar que chips y avisos llevan icono o texto además del color y escribir la prueba (la spec 002 no la tiene) — *Cubre:* RF-5.4, RNF-2. **Hecho cuando:** Prueba en verde que verifica icono o texto en chips y avisos de éxito, aviso y error; si alguno depende solo del color, se corrige.
- [x] **T-028** Cierre del grupo: `typecheck` y `test` completos — *Cubre:* RF-5.5. **Hecho cuando:** Todo en verde y `graphify update .` ejecutado.

---

## FASE 2 — Resolución, aplicación y arranque

### Resolución del tema (`packages/ui/src/theme/`)

*Requiere: Fase 1.*

- [x] **T-029** `resolveTheme` acepta los diez ids y devuelve su variante — *Cubre:* RF-2.3, D-2. **Hecho cuando:** `resolveTheme.test.ts` cubre los 13 valores, `system` con sistema claro y oscuro, `null` e inválido.
- [x] **T-030** `resolvePalette(mode)`: el id si es un tema de color, `null` en cualquier otro caso — *Cubre:* RF-1.4. **Hecho cuando:** Test con `light`, `dark`, `system`, un tema de color e inválido.
- [x] **T-031** `applyTheme(root, mode, systemDark)` pone `data-theme` y `data-palette`, y quita este último cuando no aplica — *Cubre:* RF-2.3, RF-3.5. **Hecho cuando:** `applyTheme.test.ts`: pasar de Océano a Oscuro deja `data-palette` ausente.
- [x] **T-032** `parseThemeMode(valor)`: valores válidos tal cual, cualquier otro `system` — *Cubre:* RNF-5, CL-1, CL-10. **Hecho cuando:** Test con `"arcoiris"`, vacío, `null` y un id ya inexistente.

### Proveedor y ventanas

*Requiere: resolución.*

- [x] **T-033** `ThemeProvider` usa `parseThemeMode` y `applyTheme`; el contexto expone `mode`, `resolved`, `palette` y `themeKey` — *Cubre:* RF-2.3, DP-11. **Hecho cuando:** `theme.test.tsx` actualizado (incluye el caso `arcoiris`) y en verde.
- [x] **T-034** `setMode` devuelve si la preferencia se pudo guardar — *Cubre:* CL-2. **Hecho cuando:** Test con un `PreferenceStore` cuyo `set` devuelve `false`: el tema se aplica en la sesión y `setMode` devuelve `false`.
- [x] **T-035** Solo en modo `system` se escucha el cambio del sistema — *Cubre:* CL-5. **Hecho cuando:** Test: con Medianoche elegido, un cambio de `prefers-color-scheme` no altera los atributos.
- [x] **T-036** Cambiar de tema con un componente en edición no lo desmonta ni pierde su estado — *Cubre:* CL-4, RNF-3. **Hecho cuando:** Test con un campo de texto con contenido y foco que sobrevive a tres cambios de tema.
- [x] **T-037** `useStorageSync` y `SyncedAppearance` usan `applyTheme` — *Cubre:* RF-3.4, CL-3. **Hecho cuando:** `appearance.test.tsx`: un evento `storage` con un tema de color actualiza ambos atributos.

### Arranque sin destello (`theme/bootPlugin.ts`)

*Requiere: resolución.*

- [x] **T-038** `themeBootScript` se construye desde el catálogo (mapa `id → variante`) — *Cubre:* RF-3.5, RNF-7. **Hecho cuando:** Test: el script contiene los diez ids con su variante; añadir un tema al catálogo lo incluye sin tocar el script.
- [x] **T-039** Prueba de paridad: ejecutar el script en jsdom deja los mismos atributos que `applyTheme` — *Cubre:* RF-3.5, CL-1, CL-2. **Hecho cuando:** `boot.test.ts` cubre los 13 valores, un valor inválido y un `localStorage` que lanza error.
- [x] **T-040** Comprobar que el build de la web y el de escritorio siguen inyectando el script en `<head>` — *Cubre:* RF-3.5. **Hecho cuando:** Prueba sobre el HTML generado: el script aparece primero y contiene `"grafito"`.

### Consumidores de tema

*Requiere: proveedor.*

- [x] **T-041** `GraphView` se redibuja al cambiar `themeKey`, también entre temas de la misma variante — *Cubre:* RF-3.1, RF-3.2. **Hecho cuando:** `GraphView.test.tsx` (archivo nuevo): pasar de Océano a Bosque vuelve a llamar a `readTokens`.
- [x] **T-042** Aplicar la lista de la tarea T-002: un arreglo con su prueba por cada consumidor que no se repinte — *Cubre:* RF-3.1, RF-3.2. **Hecho cuando:** Cada consumidor de la lista tiene su prueba, o `RESULTS-temas.md` dice que no hay más.
- [x] **T-043** `theme.toggle` pasa a `dark` desde cualquier tema claro y a `light` desde cualquier oscuro — *Cubre:* RF-2.6. **Hecho cuando:** `App.test.tsx` cubre los 13 valores.
- [x] **T-044** Claro, Oscuro y Sistema no ponen `data-palette` y se ven como antes — *Cubre:* RF-1.4. **Hecho cuando:** Test con los tres valores y la suite existente de `SettingsView` y `theme` sin cambios de comportamiento.
- [x] **T-045** `PageEditor` recibe la variante del tema de color (`theme="dark"` con Esmeralda) — *Cubre:* RF-3.2. **Hecho cuando:** Test del editor con un tema oscuro de color: `data-color-scheme="dark"`.
- [x] **T-046** `color-scheme` sale de la variante y ningún bloque de tema lo redefine — *Cubre:* RF-3.3. **Hecho cuando:** Test sobre `tokens.css`: `color-scheme` solo en los bloques claro y oscuro.
- [x] **T-047** Cierre de la Fase 2: elegir un tema guardando la preferencia a mano y abrir la app deja los atributos correctos — *Cubre:* RF-2.3, RF-3.5. **Hecho cuando:** Test de `App` con la preferencia `ambar` y `typecheck`/`test` completos en verde; `graphify update .` ejecutado.

---

## FASE 3 — Selector y textos

### Textos (`i18n/es-MX.ts`, `i18n/en.ts`)

*Requiere: Fase 2.*

- [x] **T-048** Claves en español: `theme.<id>` ×10, `theme.groupSystem/groupLight/groupDark`, `theme.variantLight/variantDark` y `theme.option` — *Cubre:* RNF-6. **Hecho cuando:** `typecheck` pasa y los textos coinciden con la sección 6.3 del plan.
- [x] **T-049** Las mismas claves en inglés — *Cubre:* RNF-6. **Hecho cuando:** Los nombres coinciden con la sección 6.3 del plan.
- [x] **T-050** Prueba de paridad: toda clave nueva existe en los dos idiomas y `en.ts` no contiene texto en español — *Cubre:* RNF-6. **Hecho cuando:** Test en verde (se amplía el de paridad existente).

### Selector (`settings/ThemePicker.tsx`)

*Requiere: textos.*

- [x] **T-051** `ThemeSwatch`: miniatura con los colores del catálogo, sin hex escritos en el componente — *Cubre:* RF-2.2. **Hecho cuando:** Test: los estilos de la miniatura coinciden con `canvas`, `sidebar`, `card`, `accent`, `onAccent` y `text` del tema.
- [x] **T-052** `ThemePicker`: `fieldset`, `legend` y tres grupos con 13 radios nativos del mismo `name` — *Cubre:* RF-2.1. **Hecho cuando:** Test: Sistema (1), Temas claros (6) y Temas oscuros (6), en el orden del plan.
- [x] **T-053** Cada radio tiene nombre accesible «nombre, claro|oscuro» y la opción vigente aparece marcada — *Cubre:* RF-2.4, RNF-2. **Hecho cuando:** Test con `getByRole("radio", { name: "Océano, claro" })` y estado `checked`.
- [x] **T-054** Elegir un tema llama a `setMode` y se aplica al instante; la tarjeta elegida lleva una marca ✓ además del borde — *Cubre:* RF-2.3, RNF-2. **Hecho cuando:** Test: clic en Ámbar deja `data-palette="ambar"`, `data-theme="dark"` y la marca visible.
- [x] **T-055** Teclado: Tab entra al grupo y las flechas cambian y aplican el tema — *Cubre:* RF-2.4. **Hecho cuando:** Test con `user-event`: flecha abajo pasa a la opción siguiente y la aplica.
- [x] **T-056** Miniatura de «Sistema» partida entre claro y oscuro — *Cubre:* RF-2.2. **Hecho cuando:** Test que comprueba las dos mitades con los colores de Claro y Oscuro.
- [x] **T-057** Aviso cuando `setMode` devuelve `false` — *Cubre:* CL-2. **Hecho cuando:** Test: aparece «el tema no se conservará» (con su clave i18n) y desaparece al guardarse bien.
- [x] **T-058** Pantalla estrecha: rejilla `auto-fill` de mínimo 140 px y objetivos de al menos 44 px — *Cubre:* CL-8, RNF-2. **Hecho cuando:** Test sobre las clases/estilos del componente (una o dos columnas a 360 px).
- [x] **T-059** Sustituir el `<select>` de «Tema» en `SettingsView` por `ThemePicker` — *Cubre:* RF-2.1. **Hecho cuando:** `SettingsView.test.tsx` actualizado y en verde.
- [x] **T-060** Prueba de accesibilidad del selector con la herramienta que ya usa `a11yNewScreens.test.tsx` — *Cubre:* RNF-2. **Hecho cuando:** Sin violaciones en Ajustes con un tema claro y uno oscuro de color.
- [x] **T-061** Cierre de la Fase 3: `typecheck` y `test` completos — *Cubre:* RF-2.1, RF-2.2. **Hecho cuando:** Todo en verde y `graphify update .` ejecutado.

---

## FASE 4 — Exportación

### Núcleo (`packages/core/src/export/`)

*Requiere: Fase 3.*

- [x] **T-062** Tipo `ExportPalette` y `ExportOptions.palette`, exportados desde `core/src/index.ts` — *Cubre:* RF-6.1, D-10. **Hecho cuando:** `typecheck` pasa y `index.test.ts` actualizado.
- [x] **T-063** Extraer la hoja actual a `buildExportCss(palette?)`; sin paleta devuelve exactamente la actual — *Cubre:* RF-6.2. **Hecho cuando:** `golden.test.ts` sin modificar en verde y test que compara la hoja con el texto anterior.
- [x] **T-064** Con paleta: `color` y fondo del cuerpo y `color-scheme` de la variante — *Cubre:* RF-6.3. **Hecho cuando:** Test con una paleta oscura y otra clara.
- [x] **T-065** Con paleta: texto suave, fondos elevados, bordes y bordes de tabla según la tabla de la sección 4.4 del plan — *Cubre:* RF-6.3. **Hecho cuando:** Test que comprueba cada regla de la tabla.
- [x] **T-066** Con paleta: llamadas con los colores de los chips de la variante — *Cubre:* RF-6.3. **Hecho cuando:** Test de las cuatro llamadas.
- [x] **T-067** Con paleta: colores y fondos de bloque, enlaces y menciones con el acento, y «faltante» con `danger` — *Cubre:* RF-6.3. **Hecho cuando:** Test de `.c-*`, `.bg-*`, `a`, `.mention` y `.missing`.
- [x] **T-068** Impresión con paleta: no fuerza `#000` y añade `print-color-adjust: exact`; sin paleta queda igual — *Cubre:* RF-6.3, RF-6.4. **Hecho cuando:** Test de la hoja con y sin paleta.
- [x] **T-069** Diagramas exportados sobre tarjeta clara cuando la variante es oscura (según T-003) — *Cubre:* RF-6.3, CL-12. **Hecho cuando:** Test: con paleta oscura la figura del diagrama lleva fondo claro; con paleta clara y sin paleta no cambia.
- [x] **T-070** `exportHtml` recibe `opts.palette` y lo aplica — *Cubre:* RF-6.1. **Hecho cuando:** Test de exportación completa con paleta que contiene sus colores.
- [x] **T-071** El documento con paleta sigue siendo autocontenido: sin recursos externos, sin scripts y sin `prefers-color-scheme` — *Cubre:* RF-6.4, RNF-1. **Hecho cuando:** Test que recorre el HTML buscando `http`, `<script` y `prefers-color-scheme`.
- [x] **T-072** Contraste del documento exportado: los pares texto/fondo de la hoja con paleta ≥ 4,5:1 en los diez temas — *Cubre:* RF-6.3, RF-5.1. **Hecho cuando:** Test (`it.each`) que extrae los pares de la hoja y los mide.
- [x] **T-073** Las imágenes adjuntas se exportan con los mismos bytes con y sin paleta — *Cubre:* RF-6.3. **Hecho cuando:** Test que compara los datos de imagen incrustados en ambos casos.
- [x] **T-074** `controller.exportPages` acepta `palette` y la pasa a `exportHtml` — *Cubre:* RF-6.1. **Hecho cuando:** Test del controlador con un `exportHtml` simulado que recibe la paleta.

### Interfaz (`design/exportPalette.ts`, `page/ExportDialog.tsx`)

*Requiere: núcleo.*

- [x] **T-075** `exportPaletteFor(id, systemDark)`: Claro y Oscuro con los colores base, los diez temas con su catálogo, `system` con la variante vigente — *Cubre:* RF-6.3, CL-11. **Hecho cuando:** Test de los 13 valores, con `system` claro y oscuro.
- [x] **T-076** Claves es/en del grupo «Aspecto»: `export.look`, `lookStandard`, `lookTheme` — *Cubre:* RNF-6. **Hecho cuando:** Paridad es/en en verde.
- [x] **T-077** El diálogo muestra el grupo «Aspecto» con «Estándar» seleccionado de partida — *Cubre:* RF-6.1, RF-6.2. **Hecho cuando:** Test en `ExportDialog.test.tsx`: exportar sin tocar nada no pasa paleta.
- [x] **T-078** Con «Tema actual (nombre)» el diálogo pasa la paleta del tema vigente — *Cubre:* RF-6.3, CL-11. **Hecho cuando:** Test con Océano y con Sistema.
- [x] **T-079** El aspecto elegido no se conserva: al reabrir el diálogo vuelve a «Estándar» — *Cubre:* RF-6.5. **Hecho cuando:** Test de cerrar y reabrir.
- [x] **T-080** El PDF usa la misma paleta que el HTML — *Cubre:* RF-6.1, RF-6.4. **Hecho cuando:** Test: `printHtml` recibe el HTML con la paleta cuando se elige «Tema actual».
- [x] **T-081** Cierre de la Fase 4: `typecheck` y `test` completos — *Cubre:* RF-6.1 a RF-6.5. **Hecho cuando:** Todo en verde y `graphify update .` ejecutado.

---

## FASE 5 — Cierre

### Datos y rendimiento

*Requiere: Fase 4.*

- [x] **T-082** e2e: elegir un tema, reiniciar y comprobar que sigue elegido — *Cubre:* RF-2.3, RF-2.5. **Hecho cuando:** Prueba e2e en verde.
- [x] **T-083** e2e: al cargar, `data-theme` y `data-palette` ya están puestos antes de que la aplicación se monte — *Cubre:* RF-3.5. **Hecho cuando:** Prueba e2e en verde.
- [x] **T-084** e2e: cambiar de tema y exportar con «Tema actual» no genera ninguna petición de red — *Cubre:* RNF-1. **Hecho cuando:** `privacy.e2e.test.ts` ampliada y en verde.
- [x] **T-085** Prueba: un respaldo no contiene el tema y restaurarlo no cambia el del dispositivo — *Cubre:* RF-2.5, CL-9, RNF-5. **Hecho cuando:** Test en `backup/serialize.test.ts` y en restauración.
- [x] **T-086** Rendimiento: cambiar de tema en una página larga tarda menos de 100 ms — *Cubre:* RNF-3. **Hecho cuando:** Medición en la prueba de rendimiento.

### Calidad y documentación

*Requiere: datos y rendimiento.*

- [x] **T-087** Recorrer los casos límite CL-1 a CL-12 y enlazar la prueba que cubre cada uno — *Cubre:* CL-1, CL-2, CL-3, CL-4, CL-5, CL-6, CL-7, CL-8, CL-9, CL-10, CL-11, CL-12. **Hecho cuando:** Tabla en `informe-cierre.md` con la prueba de cada caso.
- [x] **T-088** Manual de usuario (`docs/manual/`): elegir tema, los diez temas y el aspecto de exportación — *Cubre:* RNF-6. **Hecho cuando:** Sección nueva revisada.
- [x] **T-089** Revisión de los textos en inglés — *Cubre:* RNF-6. **Hecho cuando:** Sin textos en español en la interfaz en inglés.
- [x] **T-090** Demostrar los criterios de finalización 1 a 8 de la spec con la prueba de cada uno — *Cubre:* RF-1.1, RF-1.2, RF-1.3, RF-1.4, RF-1.5, RF-2.1, RF-2.2, RF-2.3, RF-2.4, RF-2.5, RF-2.6, RF-3.1, RF-3.2, RF-3.3, RF-3.4, RF-3.5, RF-4.1, RF-4.2, RF-4.3, RF-5.1, RF-5.2, RF-5.3, RF-5.4, RF-5.5, RF-6.1, RF-6.2, RF-6.3, RF-6.4, RF-6.5, RNF-2, RNF-4, RNF-7. **Hecho cuando:** Tabla criterio → prueba en `informe-cierre.md`.
- [x] **T-091** Marcar la spec y el plan como implementados y refrescar el grafo — *Cubre:* RNF-7. **Hecho cuando:** Estado actualizado en `spec.md`, `plan.md` y este archivo, y `graphify update .` ejecutado.
