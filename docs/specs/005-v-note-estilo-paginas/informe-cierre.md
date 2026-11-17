# Informe de cierre — Spec 005 (estilo de páginas)

> **Estado:** implementada. 184 de 184 tareas hechas (Fases 0 a 5). `bun run typecheck` sin errores y `bun run test` con **299 archivos y 3 266 pruebas en verde**. Pruebas de extremo a extremo en Chrome (`tests-e2e/`): `pageStyle`, `pageOptions`, `unsplash` y `backupStyle`, todas en verde.

## 1. Casos límite (E-180)

| Caso | Prueba que lo cubre |
|---|---|
| **CL-1** imagen pequeña | `ui/src/page/coverImport.test.tsx` («aviso de baja resolución»: 300 px avisa, 1 200 no) y `ui/src/page/cover/importCoverImage.test.ts` |
| **CL-2** vertical o muy panorámica | `ui/src/page/cover/encode.test.ts` (orientación EXIF: `imageOrientation: "from-image"`), `reposition.test.ts` y `coverAdjust.test.tsx` (reposicionar con ratón y teclado) |
| **CL-3** título claro con poco oscurecido | `ui/src/page/coverAdjust.test.tsx` («avisa con 54 y no con 55») y `cover/contrast.test.ts` |
| **CL-4** título o descripción largos | `ui/src/page/pageHeaderCard.test.tsx` (título de tres líneas que crece; descripción de dos líneas fuera de edición y completa al editarla) |
| **CL-5** misma imagen en varias páginas | `core/src/assets/gc.test.ts` («la misma imagen en dos páginas no se borra al quitarla de una») |
| **CL-6** portada en la papelera | `core/src/assets/gc.test.ts` (portada y estilo se conservan en la papelera y al restaurar; el archivo no se limpia) |
| **CL-7** pegar o arrastrar una imagen | `ui/src/page/coverImport.test.tsx` («arrastrar y pegar sobre la cabecera») |
| **CL-8** red caída al descargar | `ui/src/unsplash/unsplashPane.test.tsx` («fallo de red al descargar»: la portada anterior no cambia y no queda archivo) |
| **CL-9** clave borrada o revocada | `ui/src/unsplash/unsplashPane.test.tsx` («clave borrada o revocada») |
| **CL-10** Unsplash desactivado con fotos guardadas | `ui/src/unsplash/unsplashPane.test.tsx` («desactivar Unsplash con portadas guardadas») y `tests-e2e/unsplash.e2e.test.ts` (sin red) |
| **CL-11** intentar editar una página bloqueada | `ui/src/page/lock.test.tsx` («escribir, pegar y arrastrar no cambian el documento y muestran el aviso») |
| **CL-12** cientos de encabezados | `ui/src/page/tocPanel.test.tsx` (300 encabezados con desplazamiento propio; `IntersectionObserver` sin recálculo por cada evento de desplazamiento) |
| **CL-13** encabezados repetidos | `core/src/pages/toc.test.ts` (E-056) y `core/src/export/tocExport.test.ts` (anclas `uso`, `uso-1`, `uso-2`) |
| **CL-14** respaldo anterior a la spec | `core/src/backup/formatV2.test.ts` (`fullWidth` pasa a ancho completo; archivo dorado v1) y `tests-e2e/backupStyle.e2e.test.ts` (restaurar un respaldo v1 en la aplicación) |
| **CL-15** respaldo de versión mayor | `core/src/backup/futureVersion.test.ts` (no escribe nada, no crea ni modifica espacios) y `ui/src/restore/RestoreWizard.test.tsx` (aviso) |
| **CL-16** una fuente no carga | `ui/src/design/fonts.test.ts` (cada `--font-<id>` trae pila de respaldo del sistema; `font-display: swap`) |
| **CL-17** pantalla estrecha | `pageHeaderCard.test.tsx` (360 px), `tocLayout.test.ts` y `tocPanel.test.tsx` (modo reducido a 900 y 360 px), `options/pageOptionsSections.test.tsx` (menú a todo el ancho) |

## 2. Criterios de finalización (E-183)

| Criterio de la spec (sección 8) | Prueba |
|---|---|
| **1** Cabecera tipo tarjeta y piezas por separado | `pageHeaderCard.test.tsx`, `options/pageOptionsMenu.test.tsx` («cada interruptor cambia su pieza al instante») y e2e `pageStyle.e2e.test.ts` / `pageOptions.e2e.test.ts` |
| **2** Portadas: imagen, Unsplash, color, degradado; los errores no tocan la anterior | `coverPicker.test.tsx`, `coverImport.test.tsx`, `unsplash/unsplashPane.test.tsx` |
| **3** Ajustes de portada y deshacer | `coverAdjust.test.tsx` (altura, reposicionar, oscurecido, esquinas, Ctrl+Z) |
| **4** Menú con cinco secciones; ratón, teclado y lector | `options/pageOptionsMenu.test.tsx`, y axe con contraste en claro y oscuro en `pageStyle.e2e.test.ts` y `pageOptions.e2e.test.ts` |
| **5** Tipografía y espaciado al instante; ancho completo conservado | `options/pageOptionsSections.test.tsx`, `pageStyleScope.test.tsx`, `fullWidth.test.tsx`, `pageOptions.e2e.test.ts` (se conservan tras recargar) y `tests-e2e/h2h3.e2e.test.ts` (ancho completo) |
| **6** Índice flotante y bloque, actualizados y con enlaces | `tocPanel.test.tsx` y e2e `pageOptions.e2e.test.ts` («cada enlace lleva a su encabezado») |
| **7** Bloquear, acento, estadísticas, restablecer, predeterminado | `lock.test.tsx`, `options/pageOptionsSections.test.tsx`, `design/accentContrast.test.ts` |
| **8** Unsplash apagado por defecto, clave en el llavero, privacidad | `settings/unsplashSettings.test.tsx`, `core/src/unsplash/*.test.ts` y e2e `unsplash.e2e.test.ts` (tres casos de privacidad) |
| **9** Respaldo sin pérdida, determinista, v1 restaurable | `core/src/backup/formatV2.test.ts` (ida y vuelta con los mismos bytes), e2e `backupStyle.e2e.test.ts` (respaldo y restauración de punta a punta; respaldo v1) |
| **10** `typecheck` y `test`; pruebas de las reglas nuevas | Optimización de imagen: `cover/encode.test.ts`, `importCoverImage.test.ts`; respaldo: `formatV2.test.ts`, `futureVersion.test.ts`; migración del ancho: `pages/fullWidth.test.ts`; índice: `pages/toc.test.ts`, `tocExport.test.ts` |

## 3. Mediciones

| Qué | Resultado | Objetivo |
|---|---|---|
| Abrir el menú de opciones (Chrome, e2e) | 35–52 ms (primera apertura 44–52 ms) | < 100 ms (RNF-4) |
| Aplicar un cambio de opción | ≈ 48 ms | < 100 ms |
| Optimizar una imagen de 18,1 MB | mayor pausa entre fotogramas: **17 ms** (16 fotogramas durante el trabajo) | interfaz respondiendo |
| Fuentes nuevas (7 `woff2` variables) | 349 068 bytes | < 5 MB (RNF-6) |

## 4. Hallazgos durante el cierre (corregidos)

- **Cambios seguidos en el menú se pisaban:** el parche se calculaba sobre el estilo de la pantalla, no el guardado; ahora `patchPageStyle` parte del estilo actual y las escrituras van en serie (`controllerStyle.test.ts`). «Usar como predeterminado» también toma el estilo actual.
- **Parpadeo de la portada en la web:** `assetsFor` creaba un almacén nuevo en cada render y la imagen se volvía a cargar; ahora se crea uno por espacio.
- **Un parche vacío** de `setProps` generaba SQL inválido; ahora no hace nada.
- **Accesibilidad:** el botón de la descripción tenía un `aria-label` que no contenía su texto visible (axe: *label-content-name-mismatch*).
- **Título de una fila bloqueada:** `PageService.rename` rechaza una página bloqueada (`LOCKED`), así el título de las vistas de base de datos queda protegido también desde el núcleo.

## 5. Notas

- La prueba de accesibilidad del bloque de índice ignora una sola regla (`aria-allowed-attr` sobre `.tiptap`): BlockNote deja `aria-haspopup` y `aria-autocomplete` en el editor después de usar su menú «/». Es un atributo de la biblioteca, no del bloque.
- En `tests-e2e/h2h3.e2e.test.ts`, la prueba «tabla con palabra clave y calendario semanal» ya fallaba antes de esta spec (se comprobó con el último commit limpio); no está relacionada con estos cambios.
- La web vuelca a OPFS de forma asíncrona: las pruebas de recarga esperan unos segundos antes de recargar.
- Quedan sin cambios: la exportación HTML y PDF conserva su aspecto (la cabecera tipo tarjeta no se exporta), como indica el plan.
