# Resultados del Hito 0 (pruebas de viabilidad)

Equipo: Manjaro, kernel 7.2, sesión Wayland, WebKitGTK 2.52.6, Node 24.22.2, Bun 1.4.2, Rust 1.99.

| Tarea | Prueba | Resultado | Notas |
|---|---|---|---|
| T-001 | Paquetes `libayatana-appindicator` y `patchelf` | PASA | Instalados |
| T-002 | Tauri 2 + Vite + React abre y el webview reporta un latido | PASA | Primera compilación ~90 s. User agent del webview: `AppleWebKit/605.1.15 ... Version/60.5` (WebKitGTK) |
| T-003 | BlockNote en la ventana de Tauri (escribir y atajo `#`) | PASA | Automatizado con tauri-driver + WebKitWebDriver sobre la app real |
| T-004 | Menú `/`, arrastre de bloques, pegado de texto | PASA (con reserva) | El arrastre se probó con eventos HTML5 sintéticos porque WebDriver no genera arrastres nativos. **Pendiente de verificación manual con el ratón** |
| T-005 | Pegado de HTML con formato e imagen | PASA | Negrita conservada, `<script>` y `onerror` no se ejecutan; pegar imagen no rompe el editor. Pegado con eventos sintéticos, no con el portapapeles real del sistema |
| T-006 | 10 000 bloques (RNF-2) | PASA | Escritura: p50 = 43 ms, p95 = 56 ms, máx = 78 ms (presupuesto 100 ms). Carga del documento: 3.7 s |
| T-007 | Editor sobre Yjs con persistencia binaria en archivo | PASA | Reabrir la app restaura el texto |

## Hallazgos que afectan al plan
1. **BlockNote 0.57**: la colaboración con Yjs se activa con `withCollaboration` (de `@blocknote/core/yjs`), no con la opción `collaboration` suelta. Incluye deshacer/rehacer propio de Yjs (`yUndo`).
2. **`y-prosemirror` es una dependencia opcional** de BlockNote. Si falta, el editor funciona pero **no sincroniza nada con Yjs y no avisa**. Debe agregarse explícitamente (plan, sección 7) y cubrirse con una prueba que verifique que el fragmento Yjs no queda vacío tras escribir.
3. **Cargar 10 000 bloques tarda ~3.7 s**: aceptable para el presupuesto de escritura, pero conviene considerar carga progresiva para páginas enormes.
4. El webview de este equipo identifica `X11` en el user agent aunque la sesión sea Wayland (GTK usa XWayland); relevante para T-018 (atajo global).

## Corrección: pantalla en blanco (reportada por la persona usuaria)
- **Causa 1:** si el archivo guardado (`doc.bin`) estaba dañado, `Y.applyUpdate` lanzaba una excepción dentro de un efecto asíncrono, el editor nunca se montaba y la ventana quedaba en blanco sin mensaje. Un archivo basura de 3 bytes que dejé en una depuración lo provocó.
- **Causa 2:** abrir `http://localhost:1420` en un navegador normal (sin la API de Tauri) también dejaba la pantalla en blanco.
- **Arreglo:** se aísla el archivo dañado como `doc.bin.corrupt` (sin perder datos), se abre un documento vacío con un aviso visible, y en modo navegador se muestra el editor con aviso de "sin persistencia". Cubierto por `tests/e2e/resilience.test.ts` (escrito primero, visto en rojo).
- **Lección para el producto (constitución, art. 5):** cargar un documento dañado nunca debe dejar la app sin interfaz ni destruir el archivo; hay que añadir esta prueba al Hito 1 (T-39 a T-41).

## Corrección de T-006: el resultado correcto es el medido CON Yjs
La primera medición (p95 = 56 ms con 10 000 bloques) se hizo sin Yjs y **no representa la app real**. Con el editor enlazado a Yjs (como será en producción):

| Bloques por página | Mediana por tecla | p95 |
|---|---|---|
| 500 | 17 ms | 26 ms |
| 1 000 | 16 ms | 45 ms |
| 2 000 | 23 ms | 35 ms |
| 5 000 | 59 ms | 100 ms |
| 10 000 | **~780 ms** | **~850–980 ms** |

**RNF-2 (10 000 bloques sin latencia perceptible) NO se cumple** con BlockNote + Yjs. Hasta ~2 000 bloques va bien; 5 000 está en el límite. El costo crece de forma no lineal (y-prosemirror compara el fragmento completo en cada cambio). Requiere decisión: ver informe.

## Datos
| Tarea | Prueba | Resultado | Notas |
|---|---|---|---|
| T-008 | Conversor puro Yjs → bloques canónicos (párrafos, estilos, encabezados, listas, tareas, colores, enlaces) | PASA | Salida idéntica a `editor.document` del editor real; el conversor no importa BlockNote |
| T-009 | Conversor: código, cita, divisor, desplegable, tabla, imagen, archivo | PASA | Se detectó y corrigió un falso positivo (la tabla no se comparaba). BlockNote no admite `strike` + `code` juntos |
| T-010 | SQLite nativo (rusqlite, SQLite incluido): transacciones commit/rollback, WAL + sincronización completa | PASA | `cargo test` en `spikes/sqlite-native`. Exposición por IPC al webview queda para las tareas de adaptador del Hito 1 |
| T-011 | Texto completo (FTS5) en SQLite nativo | PASA | Búsqueda y fragmentos resaltados |
| T-012 | Benchmark 50 000 filas (perfil debug) | PASA | Insertar 354 ms; filtrar 10 ms; texto completo < 1 ms |
| T-013 | SQLite WASM con `opfs-sahpool` | PASA | Persiste tras recargar. **Debe correr en un Worker** (en el hilo principal falla con "Missing required OPFS APIs"). En Vite hay que añadir `optimizeDeps.exclude: ['@sqlite.org/sqlite-wasm']` o el `.wasm` se sirve como HTML |
| T-014 | Misma consulta FTS en WASM y nativo | PASA | Mismas filas y mismo fragmento resaltado (SQLite 3.54.1 en WASM) |

## Plataforma de escritorio (tauri-driver sobre la app real, Manjaro/Wayland)
| Tarea | Prueba | Resultado | Notas |
|---|---|---|---|
| T-015 | Tic nativo hacia el webview | PASA | Hilo de Rust emite `tick`; el webview lo recibe |
| T-016 | Cerrar oculta a la bandeja y el tic sigue llegando | PASA | Con la ventana oculta llegaron ≥ 4 tics en 3 s. Confirma D-17/D-18 del plan |
| T-017 | Icono de bandeja con menú | PASA | `tests-e2e/desktopShell.e2e.test.ts`: el menú (`com.canonical.dbusmenu`, el protocolo del panel) tiene Abrir, Captura rápida y Salir; Captura rápida abre la ventana de captura, Abrir vuelve a mostrar la principal oculta y Salir termina el proceso |
| T-018 | Notificación del sistema desde Rust | PASA | Verificada capturando D-Bus (`org.freedesktop.Notifications.Notify`) |
| T-019 | Ventana secundaria pequeña | PASA | Con X11 (`GDK_BACKEND=x11`) la ventana aparece sin quitarle el foco a otra app (`focusable(false)`). En Wayland nativo (GNOME) el compositor da el foco a toda ventana nueva y la app no puede impedirlo, así que ahí **no se abre la ventana**: el aviso es la notificación del sistema, que no toma foco (`reminder_window_allowed` en `main.rs`; `VNOTE_REMINDER_WINDOW=1` fuerza la ventana). Ambos casos en `desktopShell.e2e.test.ts`. Forzar X11 por defecto se probó y se descartó (arranque inestable: ~60 % de fallos en los e2e frente a 0 %) |
| T-020 | Atajo global | PASA | En X11 dispara: `desktopShell.e2e.test.ts` arranca la app en un Xwayland aislado, registra Ctrl+Alt+N, pulsa con XTest y se abre la captura. En Wayland nativo no hay atajo global (el plugin solo existe para X11); ahí, y si el sistema no lo permite, se aplica la degradación de RF-13 (`capture.native.e2e.test.ts`). No se pudo inyectar la tecla en el XWayland de la sesión (XTest no llega a los atajos) ni usar `/dev/uinput` (solo root): la prueba física en tu escritorio sigue siendo recomendable |
| T-021 | Instancia única + reenvío de `--quick-capture` | PASA | La segunda ejecución termina y la primera recibe los argumentos |
| T-022 | Llavero del sistema | PASA | Guardar, leer y borrar funcionan (Secret Service disponible en este equipo). Sin servicio: devuelve error controlado |
| T-023 | PDF desde el webview | PLAN B | La impresión silenciosa a archivo falla ("Impresora no encontrada": GTK localiza el nombre de la impresora virtual "Print to File"). Se valida el diálogo de impresión del sistema (permite Guardar como PDF). Pendiente para el Hito 4: PDF directo por plataforma |
| T-409 | PDF en escritorio desde la app | PASA (diálogo) | `window.print()` desde un iframe no abría nada en WebKitGTK. Ahora el comando `print_html` carga el documento exportado en una ventana propia y abre el diálogo de impresión real de GTK («Imprimir»), comprobado en `tests-e2e/exportPdf.native.e2e.test.ts` (aparece, Escape lo cierra, la app sigue viva). Elegir destino y guardar el PDF es del diálogo del sistema y no se automatizó (no hay CUPS aquí y el diálogo no se pinta sin gestor de ventanas): comprobarlo a mano una vez |
| T-024 | Empaquetado | PASA | `.deb` 6.8 MB y AppImage 104 MB generados; la AppImage arranca. El `.deb` no se instaló (Manjaro no usa dpkg) |
| T-025 | Compilar en Windows y macOS (CI) | PENDIENTE | Workflow escrito en `.github/workflows/spike-build.yml`; falta ejecutarlo en GitHub |

## Informe Go/No-Go (T-026)
**Decisión: GO con Tauri 2.** No hay motivo para pasar a Electron: el editor, el arrastre (sintético), el pegado, SQLite nativo con texto completo, el tic con la ventana oculta, las notificaciones, la instancia única, el llavero y el empaquetado funcionan sobre WebKitGTK.

Condiciones y cambios al plan:
1. **RNF-2 pasa de 10 000 a 2 000 bloques por página** (con aviso para dividir al superar 5 000). Decisión A, tomada por el plan; reversible.
2. **Dependencias**: añadir `y-prosemirror` (opcional en BlockNote, falla en silencio sin él); usar `withCollaboration` de `@blocknote/core/yjs`; en Vite excluir `@sqlite.org/sqlite-wasm` de la optimización; SQLite WASM solo funciona dentro de un Worker; `tauri-driver` (herramienta de pruebas) en desarrollo.
3. **PDF**: en el MVP se usa el diálogo de impresión del sistema; el PDF directo queda como mejora.
4. **Cargar el documento no debe poder dejar la app en blanco**: archivo dañado → aislarlo y abrir vacío con aviso (ya cubierto y probado en el spike).
5. **Pendiente de verificación humana** (3 puntos): menú de la bandeja (T-017), foco de la ventana de recordatorio (T-019) y disparo real del atajo global en Wayland (T-020). Pendiente de CI: T-025.
