# Backlog

Lista de pendientes por hacer, ordenada por impacto. Origen: recomendaciones del 2026-11-27 («qué más necesitaría la aplicación para ser más completa»). Cuando un punto se empiece, pasa a una ficha en `odd/tasks/` y aquí se marca con su enlace.

## Para que sea confiable
- [ ] B-1 Verificación real en escritorio: abrir la app con la CSP, probar respaldo a carpeta y a GitHub de punta a punta, y Drive/Dropbox con client ID propio (hoy solo con simuladores).
- [ ] B-2 Instalador de Windows y aviso de actualizaciones: publicar con `package.yml` (ver `release-readiness` T-4). Sin firma, Windows muestra advertencia.
- [ ] B-3 Cifrado opcional del respaldo con contraseña (hoy va en claro al destino).
- [ ] B-4 Historial de versiones por página: volver a una versión anterior del contenido.

## Para estudiar programación
- [x] B-5 Bloques de código ejecutables (JS y Python) en un entorno aislado → ficha `study-features-2` T-8 (falta probarlo en WebKitGTK, ver B-14).
- [x] B-6 Ecuaciones en línea; importar Markdown con `$$` y ```` ```mermaid ````; exportar Mermaid como dibujo en HTML → ficha `study-features-2` T-1 a T-3.
- [x] B-7 Repaso más inteligente → fichas `study-features-2` (tarjetas con atajo Mod+Alt+G y estadísticas) y `backlog-b7-b11` T-1 (racha diaria, guardada como días en cada tarjeta).
- [x] B-8 Diagramas: plantillas de flujo, ER y UML; enlazar nodos del lienzo con páginas → ficha `study-features-2` T-6 y T-7 (sin retroenlaces: ver B-9).

## Para el uso diario
- [x] B-9 Búsqueda y navegación: filtros por etiqueta y fecha, búsqueda dentro de adjuntos PDF, retroenlaces visibles en cada página (incluidos los de formas del lienzo enlazadas). → ficha `backlog-b7-b11` T-2 a T-4.
- [x] B-10 Recortador web: guardar una página o fragmento desde el navegador a la captura rápida. → ficha `backlog-b7-b11` T-5 (marcador + pegar).
- [x] B-11 Adjuntos: previsualizar PDF e imágenes con anotaciones. → ficha `backlog-b7-b11` T-6.

## Calidad y mantenimiento
- [ ] B-12 Accesibilidad: revisión con teclado y lector de pantalla.
- [ ] B-13 Rendimiento con espacios grandes: medir con miles de páginas.
- [ ] B-14 Pruebas e2e de escritorio en WebKitGTK (las actuales corren en Chrome); el bloque de código ejecutable, los bloques de estudio, el zoom y los PDF ya están en `study.native`; falta el resto (el arnés usa el binario debug).
- [x] B-16 `PageEditor`: tipar el límite de `cardsToInsert`/`insertBlocks` (sin `as never`; `typecheck` limpio).
- [ ] B-15 Orden de código: mensajes en español dentro de `core` sin i18n; cancelación de `oauth_wait`; posible falso verde en `AppUnifiedBackup.test.tsx:61`.

## Pendientes de fichas abiertas
- [x] `release-readiness` T-1: CSP comprobada en la app de escritorio.
- [ ] `study-features-2`: nueva revisión independiente del aislamiento de Python (L6).
- [ ] `release-readiness` T-4 y T-8: instaladores y donaciones (pospuestos por el usuario).
