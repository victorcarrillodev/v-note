# Tareas 001 — MVP de v-note

> Deriva de `spec.md` y `plan.md`. Cada tarea es pequeña (**máx. 20–30 min**), está en **orden de dependencia** y cubre uno o más RF/RNF/CL.
> **Regla de ejecución (TDD):** en cada tarea se escribe **primero la prueba** (debe fallar), luego la implementación, y se marca el checkbox solo cuando se cumple **"Hecho cuando"** y `bun run typecheck` y `bun run test` pasan (constitución, art. 4).
> Las tareas de pruebas de viabilidad (Hito 0) viven en `spikes/`, son desechables y sus resultados se anotan en `spikes/RESULTS.md`.
> Los grupos indican su dependencia con **Requiere**; dentro de un grupo, el orden de las tareas es el de ejecución.



---

## HITO 0 — Pruebas de viabilidad (código desechable en `spikes/`)


### Base y editor en Tauri

*Requiere: nada. Resultados se anotan en `spikes/RESULTS.md`.*

- [x] **T-001** Instalar `libayatana-appindicator` y `patchelf` — *Cubre:* RF-19. **Hecho cuando:** `pacman -Q libayatana-appindicator patchelf` lista ambos paquetes.
- [x] **T-002** Crear proyecto Tauri 2 + Vite + React mínimo en `spikes/tauri-base` — *Cubre:* RF-19. **Hecho cuando:** `bun run tauri dev` abre una ventana en Linux.
- [x] **T-003** Integrar BlockNote básico en el spike — *Cubre:* RF-3. **Hecho cuando:** Se puede escribir y aplicar encabezados en la ventana de Tauri.
- [x] **T-004** Probar en WebKitGTK menú `/`, arrastre de bloques y pegado de texto — *Cubre:* RF-3. **Hecho cuando:** Cada prueba tiene resultado (pasa/falla) en RESULTS.md.
- [x] **T-005** Probar pegado de imagen y de HTML con formato — *Cubre:* RF-3, CL-24. **Hecho cuando:** Resultado anotado en RESULTS.md.
- [x] **T-006** Medir escritura en una página de 10 000 bloques — *Cubre:* RNF-2. **Hecho cuando:** Latencia por tecla registrada y comparada con la meta (resultado: con Yjs no se cumple a 10 000; RNF-2 pasó a 2 000 bloques).
- [x] **T-007** Enlazar el editor a un documento Yjs y guardar el estado binario en un archivo — *Cubre:* RF-4. **Hecho cuando:** Reabrir la ventana restaura el texto escrito.
- [x] **T-008** Conversor mínimo Yjs a bloques canónicos (párrafo, encabezado, lista) sin importar BlockNote — *Cubre:* RF-3. **Hecho cuando:** Test compara su salida con el contenido real del editor.
- [x] **T-009** Extender el conversor a código, tabla e imagen — *Cubre:* RF-3. **Hecho cuando:** El test del conversor pasa con 3 tipos más.

### Datos

- [x] **T-010** SQLite nativo con rusqlite: abrir base, ejecutar SQL y transacciones desde el webview — *Cubre:* RF-4. **Hecho cuando:** Un insert dentro de transacción se confirma o revierte.
- [x] **T-011** Verificar que el SQLite nativo incluye búsqueda de texto completo — *Cubre:* RF-5. **Hecho cuando:** Una consulta FTS devuelve coincidencias.
- [x] **T-012** Benchmark nativo: 50 000 filas, inserción, filtro y búsqueda de texto — *Cubre:* RNF-11. **Hecho cuando:** Tiempos registrados en RESULTS.md.
- [x] **T-013** SQLite WASM con VFS opfs-sahpool en el navegador — *Cubre:* RF-18. **Hecho cuando:** Datos escritos persisten tras recargar la pestaña.
- [x] **T-014** Misma consulta FTS en WASM y comparación con el resultado nativo — *Cubre:* RF-5. **Hecho cuando:** Ambos devuelven las mismas filas en el mismo orden.

### Plataforma de escritorio

- [x] **T-015** Tic nativo cada minuto hacia el webview — *Cubre:* RF-15. **Hecho cuando:** Se registran los tics durante 15 minutos.
- [x] **T-016** Cerrar la ventana la oculta a la bandeja y el tic sigue llegando — *Cubre:* RF-19. **Hecho cuando:** Con la ventana oculta se registran tics durante 15 minutos.
- [x] **T-017** Icono de bandeja con menú (Abrir, Captura rápida, Salir) — *Cubre:* RF-13. **Hecho cuando:** Cada opción del menú responde.
- [x] **T-018** Notificación del sistema desde Rust en tu escritorio — *Cubre:* RF-11. **Hecho cuando:** La notificación aparece.
- [x] **T-019** Ventana secundaria pequeña abierta desde Rust sin robar foco — *Cubre:* RF-11. **Hecho cuando:** La ventana aparece sin quitar el foco a otra app.
- [x] **T-020** Atajo global: probar en tu sesión (X11 o Wayland) — *Cubre:* RF-13. **Hecho cuando:** Resultado anotado; si falla, el aviso de degradación se dispara.
- [x] **T-021** Instancia única y reenvío de un argumento a la instancia en ejecución — *Cubre:* RF-13, CL-22. **Hecho cuando:** Ejecutar una segunda vez enfoca la ventana existente.
- [x] **T-022** Guardar, leer y borrar un secreto en el llavero; probar sin servicio de llavero — *Cubre:* RF-14. **Hecho cuando:** Funciona con servicio y falla de forma controlada sin él.
- [x] **T-023** Imprimir a PDF desde el webview en Linux — *Cubre:* RF-24. **Hecho cuando:** Se obtiene un PDF o se documenta que solo hay diálogo.
- [x] **T-024** Empaquetar AppImage y `.deb` del spike e instalarlo — *Cubre:* RF-19. **Hecho cuando:** La app instalada arranca.
- [ ] **T-025** Compilar el spike en Windows y macOS desde CI — *Cubre:* RNF-8. **Hecho cuando:** El workflow termina en verde en ambos sistemas.
- [x] **T-026** Redactar informe Go/No-Go y decidir Tauri o Electron — *Cubre:* art. 1. **Hecho cuando:** Cada fila del plan (sección 10, Hito 0) tiene resultado y hay decisión escrita.

---

## HITO 1 — Núcleo y respaldo


### Fundamentos del repositorio

*Requiere: Hito 0 aprobado.*

- [x] **T-027** Crear el monorepo Bun con los 6 workspaces vacíos — *Cubre:* art. 1. **Hecho cuando:** `bun install` termina sin errores y lista 6 workspaces.
- [x] **T-028** Configurar TypeScript estricto compartido — *Cubre:* art. 1. **Hecho cuando:** `bun run typecheck` pasa en todos los paquetes.
- [x] **T-029** Configurar Vitest con un proyecto por paquete — *Cubre:* art. 4. **Hecho cuando:** `bun run test` ejecuta una prueba trivial por paquete.
- [x] **T-030** Crear `brand.config` y su lector en el núcleo — *Cubre:* RF-20. **Hecho cuando:** Un test lee el nombre del producto desde la configuración.
- [x] **T-031** Test que falla si el nombre del producto está escrito fuera de `brand.config` — *Cubre:* RF-20. **Hecho cuando:** El test pasa y falla al insertar el nombre a propósito.
- [ ] **T-032** Workflow de CI en Linux con typecheck y test — *Cubre:* RNF-8. **Hecho cuando:** El workflow queda verde en el primer push.
- [ ] **T-033** Ampliar CI a Windows y macOS — *Cubre:* RNF-8. **Hecho cuando:** El workflow queda verde en los tres sistemas.
- [x] **T-034** Tipo `Result` y catálogo de códigos de error del núcleo — *Cubre:* art. 3. **Hecho cuando:** Tests de construcción y comparación de errores pasan.
- [x] **T-035** Puerto `Clock` y reloj simulado — *Cubre:* art. 4. **Hecho cuando:** Test avanza el reloj simulado y lee la hora nueva.
- [x] **T-036** Generador de ids estables — *Cubre:* RF-1. **Hecho cuando:** Test de unicidad con 10 000 ids.
- [x] **T-037** Definir la interfaz `SqlStore` (abrir, consultar, ejecutar, transacción) — *Cubre:* RF-4. **Hecho cuando:** Typecheck pasa y no importa nada de DOM ni Tauri.
- [x] **T-038** Adaptador de pruebas `SqlStore` sobre `bun:sqlite` (se usó `node:sqlite` porque Vitest corre en Node) — *Cubre:* art. 4. **Hecho cuando:** Una consulta de ejemplo corre en un test.
- [x] **T-039** Suite de contrato de `SqlStore` (commit, rollback, parámetros, FTS) — *Cubre:* RF-4. **Hecho cuando:** La suite pasa contra el adaptador de pruebas.

### Migraciones y esquema base

*Requiere: Fundamentos.*

- [x] **T-040** Ejecutor de migraciones con versión de esquema y orden — *Cubre:* art. 5. **Hecho cuando:** Test aplica 3 migraciones de ejemplo en orden y es idempotente.
- [x] **T-041** Copia previa de la base antes de migrar — *Cubre:* RF-4. **Hecho cuando:** Test: una migración que falla deja la versión anterior y existe la copia.
- [x] **T-042** Rechazar bases con esquema más nuevo que el soportado — *Cubre:* art. 5. **Hecho cuando:** Test muestra el error esperado.
- [x] **T-043** Migración 001: `meta` y `pages` — *Cubre:* RF-1. **Hecho cuando:** Test comprueba tablas y columnas.
- [x] **T-044** Repositorio de páginas: crear, leer y cambiar título — *Cubre:* RF-1. **Hecho cuando:** Tests de CRUD pasan.
- [x] **T-045** Títulos vacíos ("Sin título") y repetidos — *Cubre:* CL-1, CL-2, CL-3. **Hecho cuando:** Tests de los tres casos pasan.

### Árbol de páginas

*Requiere: Migraciones y esquema base.*

- [x] **T-046** Listar hijas ordenadas y obtener el árbol completo — *Cubre:* RF-1. **Hecho cuando:** Test devuelve el árbol esperado.
- [x] **T-047** Índices fraccionarios: insertar entre dos posiciones — *Cubre:* RF-1. **Hecho cuando:** Test de propiedades: el orden siempre es estable.
- [x] **T-048** Crear página dentro de otra sin límite de profundidad — *Cubre:* RF-1. **Hecho cuando:** Test con 1 000 niveles pasa.
- [x] **T-049** Mover una página con todas sus descendientes — *Cubre:* RF-1. **Hecho cuando:** Test: los descendientes siguen bajo la página movida.
- [x] **T-050** Impedir mover una página a sus propios descendientes — *Cubre:* RF-1, CL-4. **Hecho cuando:** Test de propiedades: nunca se crea un ciclo.
- [x] **T-051** Reordenar entre hermanas — *Cubre:* RF-1. **Hecho cuando:** Test comprueba el orden resultante.
- [x] **T-052** Marcar y desmarcar favoritas — *Cubre:* RF-1. **Hecho cuando:** Test lista solo las favoritas.
- [x] **T-053** Ícono y portada como metadatos — *Cubre:* RF-1. **Hecho cuando:** Test guarda y lee ambos.
- [x] **T-054** Duplicar una página sin hijas — *Cubre:* RF-1. **Hecho cuando:** Test: copia con id nuevo y mismo contenido.
- [x] **T-055** Duplicar con hijas, con ids nuevos y referencias internas reasignadas — *Cubre:* RF-1. **Hecho cuando:** Test: las copias no apuntan a las originales.
- [x] **T-056** Ruta de ancestros (migas de pan) — *Cubre:* RF-1. **Hecho cuando:** Test devuelve la ruta correcta.

### Papelera

*Requiere: Árbol de páginas.*

- [x] **T-057** Eliminar a papelera la página y sus descendientes — *Cubre:* RF-2. **Hecho cuando:** Test: ninguna desaparece, todas quedan marcadas.
- [x] **T-058** Listar la papelera con días restantes — *Cubre:* RF-2. **Hecho cuando:** Test calcula 30, 15 y 1 días con reloj simulado.
- [x] **T-059** Restaurar a su lugar o a la raíz si el padre ya no existe — *Cubre:* RF-2. **Hecho cuando:** Tests de ambos casos.
- [x] **T-060** Borrado definitivo que exige confirmación explícita en la API — *Cubre:* RF-2. **Hecho cuando:** Test: sin confirmación el borrado se rechaza.
- [x] **T-061** Purga automática a los 30 días — *Cubre:* RF-2, CL-33. **Hecho cuando:** Test con reloj simulado borra solo lo vencido.
- [x] **T-062** Vaciar la papelera con confirmación — *Cubre:* RF-2. **Hecho cuando:** Test comprueba el vaciado.

### Documentos de página (Yjs)

*Requiere: Migraciones y esquema base.*

- [x] **T-063** Migración 002: `page_docs` — *Cubre:* RF-4. **Hecho cuando:** Test comprueba la tabla.
- [x] **T-064** Guardar una actualización Yjs dentro de una transacción — *Cubre:* RF-4. **Hecho cuando:** Test: o se guarda completa o no se guarda.
- [x] **T-065** Cargar el documento (instantánea más actualizaciones) — *Cubre:* RF-4. **Hecho cuando:** Test: lo guardado se reconstruye idéntico.
- [x] **T-066** Compactación periódica de actualizaciones — *Cubre:* RF-4. **Hecho cuando:** Test: el documento no cambia tras compactar.
- [x] **T-067** Inyección de fallos: corte entre actualizaciones — *Cubre:* RF-4. **Hecho cuando:** Test: el documento queda íntegro tras el corte.
- [x] **T-068** Tipos del modelo canónico de bloques — *Cubre:* RF-3. **Hecho cuando:** Typecheck de los tipos de RF-3.
- [x] **T-069** Conversor Yjs a canónico: texto, encabezados y listas — *Cubre:* RF-3. **Hecho cuando:** Tests por tipo pasan.
- [x] **T-070** Conversor: estilos en línea (negrita, cursiva, subrayado, tachado, código, enlace, color, resaltado) — *Cubre:* RF-3. **Hecho cuando:** Test por estilo pasa.
- [x] **T-071** Conversor: código, cita, aviso, divisor y desplegable — *Cubre:* RF-3. **Hecho cuando:** Tests por tipo pasan.
- [x] **T-072** Conversor: imagen, archivo, tabla y enlace web — *Cubre:* RF-3. **Hecho cuando:** Tests por tipo pasan.
- [x] **T-073** Conversor inverso canónico a Yjs — *Cubre:* RF-3, RF-17, RF-23. **Hecho cuando:** Test de un caso por tipo pasa.
- [x] **T-074** Propiedad: canónico a Yjs y de vuelta es la identidad — *Cubre:* RF-3. **Hecho cuando:** Test de propiedades pasa con 1 000 casos.

### Texto derivado y búsqueda

*Requiere: Documentos de página.*

- [x] **T-075** Migración 003: `page_text` con índice de texto completo — *Cubre:* RF-5. **Hecho cuando:** Test comprueba la tabla y el índice.
- [x] **T-076** Derivar texto plano desde el modelo canónico — *Cubre:* RF-5. **Hecho cuando:** Test por tipo de bloque.
- [x] **T-077** Reindexar al guardar, en la misma transacción — *Cubre:* RF-5. **Hecho cuando:** Test: el texto guardado se encuentra al instante.
- [x] **T-078** API de búsqueda por título y contenido con fragmento resaltado — *Cubre:* RF-5. **Hecho cuando:** Test devuelve el fragmento con la coincidencia.
- [x] **T-079** Filtros por espacio, tipo de página y fecha de modificación — *Cubre:* RF-5. **Hecho cuando:** Tests por filtro.
- [x] **T-080** Excluir la papelera salvo que se pida — *Cubre:* RF-5. **Hecho cuando:** Test en ambos modos.
- [x] **T-081** Registro de páginas visitadas recientes — *Cubre:* RF-5. **Hecho cuando:** Test devuelve las últimas 10 en orden.
- [x] **T-082** Reconstrucción completa de las tablas derivadas — *Cubre:* RF-5. **Hecho cuando:** Test: reconstruir da el mismo resultado que el incremental.
- [x] **T-083** Benchmark: abrir página y buscar con 5 000 páginas — *Cubre:* RNF-1, RNF-11. **Hecho cuando:** Abrir < 100 ms y búsqueda dentro del presupuesto.

### Espacios de trabajo (núcleo)

*Requiere: Texto derivado y búsqueda.*

- [x] **T-084** Registro de espacios fuera de la base (puerto `AppConfigStore`) — *Cubre:* RF-21. **Hecho cuando:** Test persiste y lee el registro.
- [x] **T-085** Crear un espacio (crea y migra su base) — *Cubre:* RF-21. **Hecho cuando:** Test: espacio nuevo con esquema al día.
- [x] **T-086** Renombrar y cambiar de espacio — *Cubre:* RF-21. **Hecho cuando:** Tests pasan.
- [x] **T-087** Marcar un espacio como predeterminado para captura rápida — *Cubre:* RF-13. **Hecho cuando:** Test: solo uno puede ser predeterminado.
- [x] **T-088** Eliminar un espacio exigiendo el nombre y devolviendo el último respaldo — *Cubre:* RF-21, CL-29. **Hecho cuando:** Test: sin nombre correcto no se elimina.
- [x] **T-089** Aislamiento: búsqueda y enlaces no cruzan entre espacios — *Cubre:* RF-21. **Hecho cuando:** Test con dos espacios no mezcla resultados.
- [x] **T-090** Bandeja de entrada por espacio, recreada si falta — *Cubre:* RF-13, CL-16. **Hecho cuando:** Test: tras borrarla se recrea.

### Adaptadores de almacenamiento

*Requiere: Fundamentos y Migraciones.*

- [x] **T-091** Rust: abrir y cerrar la base (WAL, sincronización completa) — *Cubre:* RF-4. **Hecho cuando:** Test de integración abre y cierra una base.
- [x] **T-092** Rust: ejecutar y consultar con parámetros — *Cubre:* RF-4. **Hecho cuando:** Test de integración pasa.
- [x] **T-093** Rust: transacciones begin, commit y rollback — *Cubre:* RF-4. **Hecho cuando:** Test de integración pasa.
- [x] **T-094** Adaptador TypeScript `SqlStore` de Tauri — *Cubre:* RF-4. **Hecho cuando:** Typecheck y una consulta de prueba pasan.
- [x] **T-095** Suite de contrato de `SqlStore` contra el adaptador nativo — *Cubre:* RF-4. **Hecho cuando:** La suite pasa.
- [x] **T-096** Adaptador web SQLite WASM en un worker — *Cubre:* RF-18. **Hecho cuando:** Una consulta de prueba pasa en el navegador.
- [x] **T-097** Suite de contrato de `SqlStore` contra el adaptador web — *Cubre:* RF-18. **Hecho cuando:** La suite pasa.
- [x] **T-098** Interfaz `AssetStore` y hash SHA-256 de contenido — *Cubre:* RF-3. **Hecho cuando:** Test: mismo contenido, mismo hash.
- [x] **T-099** `AssetStore` nativo (carpeta del espacio) — *Cubre:* RF-3. **Hecho cuando:** Test guarda y lee un archivo.
- [x] **T-100** `AssetStore` web (OPFS) — *Cubre:* RF-3. **Hecho cuando:** Test guarda y lee un archivo.
- [x] **T-101** Suite de contrato de `AssetStore`: nombres repetidos y duplicados — *Cubre:* CL-21. **Hecho cuando:** Dos archivos con igual nombre coexisten; igual contenido se deduplica.
- [x] **T-102** Bloqueo de instancia web (Web Locks) — *Cubre:* CL-22. **Hecho cuando:** Test: el segundo contexto no obtiene el bloqueo.
- [x] **T-103** Bloqueo de instancia en escritorio (instancia única) — *Cubre:* CL-22. **Hecho cuando:** Segunda ejecución no abre otro editor.

### Interfaz base

*Requiere: Adaptadores y Árbol de páginas.*

- [x] **T-104** Cascarón web (Vite, React, Tailwind, Radix) — *Cubre:* RF-19. **Hecho cuando:** La pantalla vacía carga en el navegador.
- [x] **T-105** Cascarón de escritorio que carga `packages/ui` — *Cubre:* RF-19. **Hecho cuando:** `bun run tauri dev` muestra la misma pantalla.
- [x] **T-106** Proveedor del núcleo y puertos en React y estado de interfaz — *Cubre:* art. 3. **Hecho cuando:** `packages/core` no importa React (test lo verifica).
- [x] **T-107** Configurar i18next con español de México e inglés — *Cubre:* RF-20. **Hecho cuando:** Un texto cambia al cambiar de idioma.
- [x] **T-108** Test: mismas claves de traducción en español e inglés — *Cubre:* RNF-10. **Hecho cuando:** El test pasa y falla si falta una clave.
- [x] **T-109** Tema claro, oscuro y seguir al sistema — *Cubre:* RF-20. **Hecho cuando:** Los tres modos se aplican y persisten.
- [x] **T-110** Diseño: barra lateral y área de página — *Cubre:* RF-1. **Hecho cuando:** Se ven ambas áreas en web y escritorio.
- [x] **T-111** Árbol lateral virtualizado — *Cubre:* RF-1. **Hecho cuando:** Un árbol de 5 000 páginas se desplaza sin pausas.
- [x] **T-112** Crear página nueva y página hija desde el árbol — *Cubre:* RF-1. **Hecho cuando:** e2e: aparece y queda lista para escribir.
- [x] **T-113** Arrastrar y soltar en el árbol (dnd-kit) — *Cubre:* RF-1. **Hecho cuando:** e2e: mover una página con sus hijas.
- [x] **T-114** Mensaje al mover una página a sus descendientes — *Cubre:* RF-1, CL-4. **Hecho cuando:** e2e muestra el motivo del rechazo.
- [x] **T-115** Vista de página: título, ícono y portada editables — *Cubre:* RF-1. **Hecho cuando:** e2e cambia los tres.
- [x] **T-116** Favoritos, migas de pan y duplicar en la interfaz — *Cubre:* RF-1. **Hecho cuando:** e2e de cada acción.
- [x] **T-117** Vista de papelera: restaurar, borrar definitivo y días restantes — *Cubre:* RF-2. **Hecho cuando:** e2e con diálogo de confirmación.
- [x] **T-118** Gestor de espacios: crear, renombrar, cambiar y eliminar escribiendo el nombre — *Cubre:* RF-21. **Hecho cuando:** e2e de las cuatro acciones.

### Editor

*Requiere: Interfaz base y Documentos de página.*

- [x] **T-119** Integrar BlockNote con el documento Yjs de la página — *Cubre:* RF-3. **Hecho cuando:** e2e escribe y el texto se ve.
- [x] **T-120** Guardado automático desde el editor al núcleo — *Cubre:* RF-4. **Hecho cuando:** e2e: recargar conserva el texto sin acción explícita.
- [x] **T-121** Menú `/` y atajos de Markdown — *Cubre:* RF-3. **Hecho cuando:** e2e inserta bloques con `/` y con `#`, `-`, `1.`, `[]`, `>`.
- [x] **T-122** Habilitar bloques estándar (párrafo, h1–h3, listas, tareas, cita, código, tabla, imagen, archivo) — *Cubre:* RF-3. **Hecho cuando:** e2e inserta cada uno.
- [x] **T-123** Bloque propio: aviso destacado — *Cubre:* RF-3. **Hecho cuando:** e2e inserta y edita.
- [x] **T-124** Bloques propios: divisor y desplegable — *Cubre:* RF-3. **Hecho cuando:** e2e inserta y expande.
- [x] **T-125** Bloque propio: enlace web — *Cubre:* RF-3. **Hecho cuando:** e2e inserta un enlace y se ve la tarjeta.
- [x] **T-126** Formato de texto: color y resaltado — *Cubre:* RF-3. **Hecho cuando:** e2e aplica ambos.
- [x] **T-127** Adjuntar archivo o imagen al `AssetStore` — *Cubre:* RF-3, CL-21. **Hecho cuando:** e2e: dos adjuntos con el mismo nombre coexisten.
- [x] **T-128** Advertencia al adjuntar un archivo de más de 100 MB — *Cubre:* RF-3. **Hecho cuando:** e2e muestra el aviso de que no se respaldará.
- [x] **T-129** Sanear el contenido pegado con DOMPurify — *Cubre:* CL-24. **Hecho cuando:** Test: un `<script>` pegado no llega al documento.
- [x] **T-130** Corpus de entradas maliciosas — *Cubre:* CL-24. **Hecho cuando:** Prueba pasa con todo el corpus.
- [x] **T-131** Deshacer y rehacer coherentes en la sesión — *Cubre:* RF-3. **Hecho cuando:** e2e: deshacer y rehacer tras reabrir la página.
- [x] **T-132** e2e: escribir, cambiar de página, volver, contenido intacto — *Cubre:* RF-3, RF-4. **Hecho cuando:** Prueba pasa.
- [x] **T-133** e2e de inyección de fallos: matar el proceso a mitad de escritura — *Cubre:* RF-4. **Hecho cuando:** Reabrir no muestra corrupción.
- [x] **T-134** Benchmark del editor con 2 000 bloques y Yjs activo — *Cubre:* RNF-2. **Hecho cuando:** Mediana < 50 ms y p95 < 100 ms por tecla.
- [x] **T-134b** Aviso al superar 5 000 bloques que sugiere dividir la página — *Cubre:* RF-3, RNF-2. **Hecho cuando:** e2e: al pasar de 5 000 bloques aparece el aviso y se puede seguir editando.

### Búsqueda y paleta (interfaz)

*Requiere: Editor y Texto derivado.*

- [x] **T-135** Paleta de comandos con cmdk y atajo de apertura — *Cubre:* RF-5. **Hecho cuando:** e2e abre y cierra la paleta.
- [x] **T-136** Recientes al abrir la paleta sin texto — *Cubre:* RF-5. **Hecho cuando:** e2e muestra las últimas páginas.
- [x] **T-137** Búsqueda en vivo con resaltado — *Cubre:* RF-5. **Hecho cuando:** e2e: resultados cambian al escribir.
- [x] **T-138** Mensaje de "sin coincidencias" — *Cubre:* RF-5. **Hecho cuando:** e2e con búsqueda sin resultados.
- [x] **T-139** Filtros por espacio, tipo y fecha, e incluir papelera — *Cubre:* RF-5. **Hecho cuando:** e2e de cada filtro.
- [x] **T-140** Acciones comunes en la paleta (crear página, cambiar tema) — *Cubre:* RF-5. **Hecho cuando:** e2e ejecuta ambas.

### Apariencia, idioma y atajos

*Requiere: Búsqueda y paleta.*

- [x] **T-141** Catálogo de acciones con atajos por defecto — *Cubre:* RF-20. **Hecho cuando:** Test lista cada acción con su atajo.
- [x] **T-142** Detección de conflictos de atajos — *Cubre:* RF-20. **Hecho cuando:** Test: dos acciones con el mismo atajo se detectan.
- [x] **T-143** Pantalla de ajustes de atajos reasignables con aviso de conflicto — *Cubre:* RF-20. **Hecho cuando:** e2e reasigna y recibe aviso al chocar.
- [x] **T-144** Ajustes de idioma y tema — *Cubre:* RF-20. **Hecho cuando:** e2e cambia ambos.
- [x] **T-145** Auditoría axe y de teclado del shell y el editor — *Cubre:* RNF-9. **Hecho cuando:** axe sin errores graves y flujo completo con teclado.

### PWA y trabajo sin conexión

*Requiere: Interfaz base.*

- [x] **T-146** Manifiesto e iconos con vite-plugin-pwa — *Cubre:* RF-19. **Hecho cuando:** Lighthouse o navegador permite instalar la PWA.
- [x] **T-147** Precaché y modo sin conexión — *Cubre:* RF-18. **Hecho cuando:** La app arranca sin red.
- [x] **T-148** e2e con red cortada: crear, editar, buscar y reordenar — *Cubre:* RF-18. **Hecho cuando:** Prueba pasa.
- [x] **T-149** Aviso de respaldo solo con la app abierta en el navegador — *Cubre:* RF-19. **Hecho cuando:** e2e muestra el aviso.
- [x] **T-150** Aviso de que web y escritorio son instalaciones independientes — *Cubre:* RF-19. **Hecho cuando:** e2e muestra el aviso.
- [x] **T-151** Segunda pestaña del mismo espacio en solo lectura con aviso — *Cubre:* CL-22. **Hecho cuando:** e2e con dos contextos.

### Escritorio

*Requiere: Interfaz base y Adaptadores.*

- [x] **T-152** Tic nativo cada minuto y evento al reanudar — *Cubre:* RF-15. **Hecho cuando:** Test de integración recibe el tic.
- [x] **T-153** Cerrar oculta a la bandeja con menú Abrir y Salir — *Cubre:* RF-19. **Hecho cuando:** e2e de escritorio: la app sigue viva tras cerrar.
- [x] **T-154** Instancia única: segunda ejecución enfoca la existente — *Cubre:* CL-22. **Hecho cuando:** e2e de escritorio.
- [x] **T-155** Carpeta de datos por defecto estándar del sistema — *Cubre:* RF-25. **Hecho cuando:** Test comprueba la ruta por plataforma.
- [x] **T-156** Mostrar la ubicación actual con botón para abrirla — *Cubre:* RF-25. **Hecho cuando:** e2e muestra la ruta.
- [x] **T-157** Elegir carpeta al crear un espacio (diálogo nativo) — *Cubre:* RF-25. **Hecho cuando:** e2e crea un espacio en carpeta elegida.
- [x] **T-158** Validar carpeta: existe, es escribible y tiene espacio — *Cubre:* RF-25. **Hecho cuando:** Tests de los tres rechazos.
- [x] **T-159** Mover un espacio: copiar todo el contenido — *Cubre:* RF-25. **Hecho cuando:** Test: la copia tiene todas las páginas y adjuntos.
- [x] **T-160** Verificar huellas y conmutar a la nueva ubicación — *Cubre:* RF-25. **Hecho cuando:** Test: solo se cambia tras verificar.
- [x] **T-161** Inyección de fallos: interrumpir el movimiento — *Cubre:* RF-25, CL-36. **Hecho cuando:** La ubicación anterior sigue válida y sin duplicados.
- [x] **T-162** Carpeta ausente al abrir: avisar sin crear un espacio vacío — *Cubre:* RF-25, CL-35. **Hecho cuando:** Test: no se crea ninguna base nueva.
- [x] **T-163** Disco lleno al guardar: aviso sin perder lo confirmado — *Cubre:* CL-20. **Hecho cuando:** Test con adaptador de fallos.
- [x] **T-164** e2e de humo de escritorio: crear, reiniciar, persistir — *Cubre:* RF-19. **Hecho cuando:** Prueba pasa en Linux.
- [x] **T-165** Decidir y documentar dónde se alojan las versiones de escritorio — *Cubre:* RF-19. **Hecho cuando:** Decisión escrita en plan.md.
- [x] **T-166** Aviso de versión nueva con botón de descarga — *Cubre:* RF-19. **Hecho cuando:** Test: versión remota mayor muestra el aviso.

### Respaldo: serialización

*Requiere: Documentos de página y Espacios.*

- [x] **T-167** Documentar el formato de respaldo v1 en `docs/backup-format.md` — *Cubre:* RF-15. **Hecho cuando:** Documento revisado con rutas y esquema de cada archivo.
- [x] **T-168** Serializar `workspace.json` — *Cubre:* RF-15. **Hecho cuando:** Test contra archivo de referencia.
- [x] **T-169** Utilidad de JSON estable (claves ordenadas, fin de línea fijo) — *Cubre:* RNF-7. **Hecho cuando:** Test: mismo objeto, mismos bytes.
- [x] **T-170** JSON sin pérdida por página — *Cubre:* RF-15. **Hecho cuando:** Test: contiene todo el modelo canónico.
- [x] **T-171** Markdown legible por página — *Cubre:* RF-15. **Hecho cuando:** Archivo de referencia por tipo de bloque.
- [x] **T-172** Rutas estables por jerarquía (título e id corto, saneadas, sin colisiones) — *Cubre:* RF-15. **Hecho cuando:** Test con títulos repetidos y caracteres raros.
- [x] **T-173** Serializar adjuntos con nombre igual al hash — *Cubre:* RF-15, CL-21. **Hecho cuando:** Test: mismo contenido, un solo archivo.
- [x] **T-174** Serializar la papelera (`trash.json`) — *Cubre:* RF-15. **Hecho cuando:** Test incluye fecha de eliminación.
- [x] **T-175** Archivo dorado: espacio de ejemplo a árbol de archivos — *Cubre:* RNF-7. **Hecho cuando:** Salida idéntica a la de referencia.
- [x] **T-176** Propiedad: mismo contenido produce los mismos bytes — *Cubre:* RNF-7. **Hecho cuando:** fast-check con 1 000 casos.
- [x] **T-177** Huella Git de blobs y árboles calculada localmente — *Cubre:* RF-15. **Hecho cuando:** Test coincide con valores calculados por `git hash-object`.

### Respaldo: cliente de GitHub

*Requiere: Respaldo: serialización.*

- [x] **T-178** Servidor GitHub falso (repos, refs, blobs, árboles, commits) — *Cubre:* RF-15. **Hecho cuando:** El cliente de prueba crea un commit completo en él.
- [x] **T-179** Errores configurables en el servidor falso (401, 403, 404, 422, límite de uso, repositorio lleno) — *Cubre:* RF-16. **Hecho cuando:** Cada error se puede provocar en un test.
- [x] **T-180** Cliente: verificar token y repositorio (existe, privado) — *Cubre:* RF-14. **Hecho cuando:** Tests de repo privado y público.
- [x] **T-181** Cliente: obtener cabeza y árbol recursivo — *Cubre:* RF-15. **Hecho cuando:** Test contra el servidor falso.
- [x] **T-182** Cliente: crear blobs con tope de 100 MB — *Cubre:* RF-15, RF-16. **Hecho cuando:** Test: un blob de 101 MB se rechaza antes de enviarse.
- [x] **T-183** Cliente: crear árbol y commit sobre la cabeza — *Cubre:* RF-15. **Hecho cuando:** Test: el commit cuelga de la cabeza anterior.
- [x] **T-184** Cliente: avanzar la referencia sin forzar y manejar rechazo — *Cubre:* RF-16, CL-18. **Hecho cuando:** Test: referencia movida por fuera se detecta.
- [x] **T-185** Clasificar errores según la tabla 6.4 del plan — *Cubre:* RF-16. **Hecho cuando:** Un test por causa devuelve su categoría.
- [x] **T-186** Redactar tokens en los registros — *Cubre:* RNF-6. **Hecho cuando:** Test: ningún registro contiene el token.

### Respaldo: ejecución

*Requiere: Respaldo: cliente de GitHub.*

- [x] **T-187** Calcular qué archivos subir comparando huellas — *Cubre:* RF-15. **Hecho cuando:** Test: solo se suben los distintos.
- [x] **T-188** No crear commit cuando el árbol es igual — *Cubre:* RF-15. **Hecho cuando:** Test: segundo respaldo sin cambios no crea commit.
- [x] **T-189** Mensaje de commit con fecha y cantidad de páginas modificadas — *Cubre:* RF-15. **Hecho cuando:** Test del formato.
- [x] **T-190** Ejecutor del respaldo completo en un worker — *Cubre:* RF-15, RNF-12. **Hecho cuando:** Test de integración respalda un espacio de ejemplo.
- [x] **T-191** Detectar cambio externo y pedir decisión — *Cubre:* CL-18. **Hecho cuando:** Test: cabeza remota distinta pausa y pregunta.
- [x] **T-192** Omitir adjuntos de más de 100 MB y listarlos — *Cubre:* RF-16. **Hecho cuando:** Test: se respalda el resto y se lista el omitido.
- [x] **T-193** Tabla `backup_runs` y registro de cada ejecución — *Cubre:* RF-15. **Hecho cuando:** Test guarda éxito y fallo.
- [x] **T-194** Cálculo del plazo (último éxito más frecuencia de 1 a 7 días) — *Cubre:* RF-14, RF-15. **Hecho cuando:** Tests con reloj simulado en 1, 3 y 7 días.
- [x] **T-195** Respaldo inmediato al abrir si venció, una sola vez — *Cubre:* RF-15, CL-19. **Hecho cuando:** Test: tres plazos vencidos producen un respaldo.
- [x] **T-196** Reintentos a 1, 5, 15 y 60 minutos y luego aviso — *Cubre:* RF-16. **Hecho cuando:** Test con reloj simulado.
- [x] **T-197** Corte a mitad: la referencia no avanza y se repite — *Cubre:* CL-17. **Hecho cuando:** Test de inyección de fallos.
- [x] **T-198** Disparar el respaldo desde el tic — *Cubre:* RF-15. **Hecho cuando:** Test de integración: el tic inicia el respaldo vencido.
- [x] **T-199** Un fallo no modifica ni borra datos locales — *Cubre:* RF-16. **Hecho cuando:** Test compara la base antes y después del fallo.

### Respaldo: credenciales e interfaz

*Requiere: Respaldo: ejecución y Escritorio.*

- [x] **T-200** Llavero del sistema en escritorio (keyring) — *Cubre:* RF-14. **Hecho cuando:** Test de integración guarda, lee y borra.
- [x] **T-201** Sin servicio de llavero: pedir el token en cada sesión — *Cubre:* RF-14. **Hecho cuando:** Prueba: se pide el token y no se escribe en disco.
- [x] **T-202** Token solo en memoria en la web — *Cubre:* RF-14. **Hecho cuando:** Test: recargar la pestaña lo olvida.
- [x] **T-203** Test: el token no aparece en base, respaldo ni registros — *Cubre:* RNF-6. **Hecho cuando:** Búsqueda del token da cero resultados.
- [x] **T-204** Pantalla de respaldo: conectar token y elegir repositorio — *Cubre:* RF-14. **Hecho cuando:** e2e conecta contra el servidor falso.
- [x] **T-205** Advertencia de repositorio público con confirmación — *Cubre:* RF-14. **Hecho cuando:** e2e: sin confirmar no se guarda.
- [x] **T-206** Selector de frecuencia de 1 a 7 días (por defecto 1) — *Cubre:* RF-14. **Hecho cuando:** e2e guarda y muestra la frecuencia.
- [x] **T-207** Botón "Respaldar ahora" — *Cubre:* RF-15. **Hecho cuando:** e2e produce un commit en el servidor falso.
- [x] **T-208** Panel de estado: último éxito, próximo plazo e historial — *Cubre:* RF-15. **Hecho cuando:** e2e muestra los tres datos.
- [x] **T-209** Aviso visible de fallo con causa y botón de reintento — *Cubre:* RF-16. **Hecho cuando:** e2e para cada causa de la tabla.
- [x] **T-210** Aviso de límite del repositorio con sugerencias — *Cubre:* RF-16. **Hecho cuando:** e2e con repositorio lleno.
- [x] **T-211** Diálogo de decisión por cambio externo — *Cubre:* CL-18. **Hecho cuando:** e2e con referencia movida.

### Restauración

*Requiere: Respaldo: ejecución.*

- [x] **T-212** Listar los respaldos (commits) por fecha — *Cubre:* RF-17. **Hecho cuando:** Test contra el servidor falso.
- [x] **T-213** Leer el árbol de un commit y validar el formato — *Cubre:* RF-17, CL-23. **Hecho cuando:** Test con formato válido.
- [x] **T-214** Rechazar versión futura o contenido dañado sin tocar nada — *Cubre:* RF-17, CL-23. **Hecho cuando:** Test: la base existente queda idéntica.
- [x] **T-215** Reconstruir páginas y jerarquía en un espacio nuevo — *Cubre:* RF-17. **Hecho cuando:** Test compara con el original.
- [x] **T-216** Reconstruir adjuntos y papelera — *Cubre:* RF-17. **Hecho cuando:** Test compara con el original.
- [x] **T-217** Propiedad: respaldar y restaurar es la identidad (páginas y jerarquía) — *Cubre:* RF-17. **Hecho cuando:** fast-check con 500 casos.
- [x] **T-218** Asistente de restauración (elegir respaldo y destino nuevo) — *Cubre:* RF-17. **Hecho cuando:** e2e restaura como espacio nuevo.
- [x] **T-219** Reemplazar un espacio: mostrar qué se sustituye y confirmar; intercambio al final — *Cubre:* RF-17. **Hecho cuando:** e2e: cancelar deja todo intacto.
- [x] **T-220** Equipo nuevo: flujo de primer inicio "conectar y restaurar" — *Cubre:* RF-17. **Hecho cuando:** e2e desde instalación limpia.
- [x] **T-221** e2e respaldo y restauración de extremo a extremo — *Cubre:* RF-15, RF-17. **Hecho cuando:** Prueba pasa contra el servidor falso.

### Cierre del Hito 1

*Requiere: todos los grupos del Hito 1.*

- [x] **T-222** Benchmark de escala con 5 000 páginas — *Cubre:* RNF-11. **Hecho cuando:** Dentro del presupuesto.
- [x] **T-223** Prueba de privacidad: solo se contacta a `api.github.com` — *Cubre:* RNF-5. **Hecho cuando:** e2e interceptando toda la red pasa.
- [ ] **T-224** Empaquetado en CI: AppImage, `.deb` y `.msi` — *Cubre:* RF-19. **Hecho cuando:** Artefactos descargables del workflow.
- [x] **T-225** Demostrar criterios 1, 2 (sin enlaces ni grafo), 7, 8, 9, 10 y 11 de la spec — *Cubre:* RF-1. **Hecho cuando:** Checklist firmado con evidencia.

---

## HITO 2 — Kanban, bases de datos y recordatorios


### Modelo de bases de datos

*Requiere: Hito 1.*

- [x] **T-226** Migración de bases de datos, propiedades, filas, valores, relaciones y vistas — *Cubre:* RF-22. **Hecho cuando:** Test comprueba el esquema.
- [x] **T-227** Crear una base de datos (en línea o página completa) — *Cubre:* RF-22. **Hecho cuando:** Test crea ambas.
- [x] **T-228** Propiedades: crear, renombrar, borrar y ordenar — *Cubre:* RF-22. **Hecho cuando:** Tests pasan.
- [x] **T-229** Valores: texto, número y casilla — *Cubre:* RF-22. **Hecho cuando:** Test de validación por tipo.
- [x] **T-230** Valores: selección y selección múltiple con opciones — *Cubre:* RF-22. **Hecho cuando:** Tests pasan.
- [x] **T-231** Valores: fecha (inicio y fin) y fechas automáticas de creación y edición — *Cubre:* RF-22. **Hecho cuando:** Tests pasan.
- [x] **T-232** Valores: enlace web, correo y teléfono — *Cubre:* RF-22. **Hecho cuando:** Validación con casos válidos e inválidos.
- [x] **T-233** Valores: archivos — *Cubre:* RF-22. **Hecho cuando:** Test guarda referencias a adjuntos.
- [x] **T-234** Valores: estado (por hacer, en curso, hecho) — *Cubre:* RF-22, RF-8. **Hecho cuando:** Test de transición de estado.
- [x] **T-235** Pertenencia múltiple: una página en varias bases — *Cubre:* RF-22, CL-34. **Hecho cuando:** Test: valores independientes por base.
- [x] **T-236** Eliminar página en varias bases: advertir y mandar a la papelera — *Cubre:* RF-22, CL-7. **Hecho cuando:** Test: desaparece de todas.
- [x] **T-237** Filtros: operadores por tipo de propiedad — *Cubre:* RF-22. **Hecho cuando:** Un test por tipo.
- [x] **T-238** Filtros: grupos AND y OR anidados — *Cubre:* RF-22. **Hecho cuando:** Tests de combinaciones.
- [x] **T-239** Orden múltiple — *Cubre:* RF-22. **Hecho cuando:** Test de desempates.
- [x] **T-240** Agrupación — *Cubre:* RF-22. **Hecho cuando:** Test de grupos.
- [x] **T-241** Vistas guardadas (crear, editar, borrar) — *Cubre:* RF-22. **Hecho cuando:** Tests de CRUD.
- [x] **T-242** Vistas enlazadas de una base en otra página — *Cubre:* RF-22. **Hecho cuando:** Test: un cambio se ve en ambas.
- [x] **T-243** Benchmark de consultas con 50 000 filas — *Cubre:* RNF-11. **Hecho cuando:** Dentro del presupuesto.

### Relaciones y rollups

*Requiere: Modelo de bases de datos.*

- [x] **T-244** Relación bidireccional entre dos bases — *Cubre:* RF-22. **Hecho cuando:** Test: el vínculo se ve en ambas.
- [x] **T-245** Quitar el vínculo al eliminar la fila relacionada — *Cubre:* RF-22. **Hecho cuando:** Test del otro lado.
- [x] **T-246** Rollup: contar y sumar — *Cubre:* RF-22. **Hecho cuando:** Tests pasan.
- [x] **T-247** Rollup: promedio, mínimo y máximo — *Cubre:* RF-22. **Hecho cuando:** Tests pasan.
- [x] **T-248** Recalcular rollups al cambiar datos relacionados — *Cubre:* RF-22. **Hecho cuando:** Test: cambio de valor actualiza el rollup.

### Fórmulas

*Requiere: Relaciones y rollups.*

- [x] **T-249** Tokenizador de fórmulas — *Cubre:* RF-22. **Hecho cuando:** Tests de tokens y errores léxicos.
- [x] **T-250** Analizador con precedencia y paréntesis — *Cubre:* RF-22. **Hecho cuando:** Tests de expresiones.
- [x] **T-251** Evaluador con tipos y errores controlados — *Cubre:* RF-22. **Hecho cuando:** Test: dividir entre cero da error, no excepción.
- [x] **T-252** Funciones de texto — *Cubre:* RF-22. **Hecho cuando:** Un test por función.
- [x] **T-253** Funciones numéricas — *Cubre:* RF-22. **Hecho cuando:** Un test por función.
- [x] **T-254** Funciones de fecha — *Cubre:* RF-22. **Hecho cuando:** Un test por función.
- [x] **T-255** Funciones lógicas — *Cubre:* RF-22. **Hecho cuando:** Un test por función.
- [x] **T-256** Referencias a propiedades y a rollups — *Cubre:* RF-22. **Hecho cuando:** Test evalúa referencias cruzadas.
- [x] **T-257** Grafo de dependencias entre propiedades — *Cubre:* RF-22. **Hecho cuando:** Test del orden de cálculo.
- [x] **T-258** Detección de ciclos al definir fórmulas, rollups y relaciones — *Cubre:* RF-22, CL-26. **Hecho cuando:** Test: la definición circular se rechaza con mensaje.
- [x] **T-259** Propiedad: ninguna definición aceptada contiene un ciclo — *Cubre:* CL-26. **Hecho cuando:** fast-check con 1 000 casos.
- [x] **T-260** Recálculo incremental solo de filas afectadas — *Cubre:* RF-22, RNF-13. **Hecho cuando:** Test cuenta las filas recalculadas.
- [x] **T-261** Recálculo en un worker con cancelación — *Cubre:* RNF-13. **Hecho cuando:** Test cancela a la mitad sin dejar valores a medias.
- [x] **T-262** Error por celda con explicación sin afectar a las demás — *Cubre:* RF-22. **Hecho cuando:** Test: una celda con error no altera las otras.
- [x] **T-263** Benchmark: 10 000 filas tras un cambio — *Cubre:* RNF-13. **Hecho cuando:** Interfaz sin congelarse y dentro del presupuesto.

### Vistas de base de datos (interfaz)

*Requiere: Fórmulas.*

- [x] **T-264** Bloque "vista de base de datos" en el editor — *Cubre:* RF-22. **Hecho cuando:** e2e inserta el bloque.
- [x] **T-265** Página completa de base de datos con selector de vistas — *Cubre:* RF-22. **Hecho cuando:** e2e cambia de vista.
- [x] **T-266** Vista tabla: columnas y edición de celdas — *Cubre:* RF-22. **Hecho cuando:** e2e edita celdas de cada tipo.
- [x] **T-267** Tabla virtualizada con 50 000 filas — *Cubre:* RNF-11. **Hecho cuando:** Desplazamiento fluido en el benchmark.
- [x] **T-268** Editores de celda: selección, fecha y casilla — *Cubre:* RF-22. **Hecho cuando:** e2e de cada editor.
- [x] **T-269** Editor de fórmulas con vista previa y mensajes de error — *Cubre:* RF-22. **Hecho cuando:** e2e muestra el error en español.
- [x] **T-270** Panel de filtros, orden y agrupación — *Cubre:* RF-22. **Hecho cuando:** e2e aplica cada uno.
- [x] **T-271** Vista lista — *Cubre:* RF-22. **Hecho cuando:** e2e.
- [x] **T-272** Vista galería — *Cubre:* RF-22. **Hecho cuando:** e2e.
- [x] **T-273** Vista calendario (mes) — *Cubre:* RF-22. **Hecho cuando:** e2e muestra filas por fecha.
- [x] **T-274** Calendario: arrastrar entre días cambia la fecha — *Cubre:* RF-22. **Hecho cuando:** e2e arrastra y la fecha cambia.
- [x] **T-275** Vista línea de tiempo tipo Gantt: eje y barras — *Cubre:* RF-22. **Hecho cuando:** e2e muestra barras por rango.
- [x] **T-276** Gantt: arrastrar y redimensionar barras — *Cubre:* RF-22. **Hecho cuando:** e2e cambia fechas.
- [x] **T-277** Configurar vistas enlazadas desde la interfaz — *Cubre:* RF-22. **Hecho cuando:** e2e enlaza una base.
- [x] **T-278** Diálogo de advertencia al eliminar una página en varias bases — *Cubre:* RF-22. **Hecho cuando:** e2e.

### Tableros kanban

*Requiere: Vistas de base de datos.*

- [x] **T-279** Crear tablero: base con estado y vista tablero con columnas iniciales — *Cubre:* RF-8. **Hecho cuando:** Test: columnas Por hacer, En curso y Hecho existen.
- [x] **T-280** Columnas: crear, renombrar y reordenar — *Cubre:* RF-8. **Hecho cuando:** Tests pasan.
- [x] **T-281** Eliminar columna con tarjetas: confirmar y mover — *Cubre:* RF-8. **Hecho cuando:** Test: las tarjetas pasan a la columna elegida.
- [x] **T-282** Crear tarjeta = página más fila — *Cubre:* RF-8. **Hecho cuando:** Test: la tarjeta es una página completa.
- [x] **T-283** Vista tablero con arrastrar y soltar (dnd-kit) — *Cubre:* RF-8. **Hecho cuando:** e2e arrastra entre columnas.
- [x] **T-284** Persistir estado y orden al arrastrar — *Cubre:* RF-8. **Hecho cuando:** e2e: recargar conserva columna y orden.
- [x] **T-285** La tarjeta muestra título, fecha límite y recordatorio — *Cubre:* RF-8. **Hecho cuando:** e2e.
- [x] **T-286** Abrir la tarjeta como página con el editor completo — *Cubre:* RF-8. **Hecho cuando:** e2e escribe en una tarjeta.
- [x] **T-287** Tarjeta eliminada desde fuera: desaparece y vuelve al restaurar — *Cubre:* CL-7. **Hecho cuando:** Test del ciclo.
- [x] **T-288** Mover en un tablero no cambia el estado en otros — *Cubre:* CL-34. **Hecho cuando:** Test con dos tableros.

### Tareas y recordatorios (núcleo)

*Requiere: Tableros kanban.*

- [x] **T-289** Migración de `tasks` y `reminder_state` — *Cubre:* RF-11. **Hecho cuando:** Test comprueba el esquema.
- [x] **T-290** Bloque propio de tarea (casilla con fecha y recordatorio) — *Cubre:* RF-11. **Hecho cuando:** e2e inserta y fija fecha.
- [x] **T-291** Derivar tareas de las casillas del documento — *Cubre:* RF-11. **Hecho cuando:** Test: cada casilla con fecha crea una tarea.
- [x] **T-292** Derivar tareas de tarjetas y filas con propiedad de fecha — *Cubre:* RF-11. **Hecho cuando:** Test.
- [x] **T-293** Modelo de recordatorio (límite, hora flotante, recurrencia) — *Cubre:* RF-11. **Hecho cuando:** Typecheck y test de validación.
- [x] **T-294** Recurrencia diaria y semanal — *Cubre:* RF-11. **Hecho cuando:** Tests de siguiente ocurrencia.
- [x] **T-295** Recurrencia mensual y anual con ajuste a fin de mes — *Cubre:* RF-11, CL-25. **Hecho cuando:** Test: el 31 en febrero cae el 28 o 29.
- [x] **T-296** Completar una tarea recurrente programa la siguiente desde la fecha original — *Cubre:* RF-11, CL-32. **Hecho cuando:** Test con completado anticipado.
- [x] **T-297** Marcar hecha cancela los recordatorios pendientes — *Cubre:* RF-11. **Hecho cuando:** Test.
- [x] **T-298** Cambiar o eliminar la fecha reprograma el aviso — *Cubre:* RF-11. **Hecho cuando:** Test.
- [x] **T-299** Recordatorio con fecha pasada: avisar y ofrecer opciones — *Cubre:* CL-11. **Hecho cuando:** Test del caso.
- [x] **T-300** Evaluar en cada tic los recordatorios cuya hora llegó — *Cubre:* RF-11. **Hecho cuando:** Test con reloj simulado.
- [x] **T-301** Agrupar varios vencidos en una sola lista — *Cubre:* CL-14. **Hecho cuando:** Test: 20 vencidos producen una entrada agrupada.
- [x] **T-302** Varias repeticiones acumuladas: solo la más reciente — *Cubre:* RF-11. **Hecho cuando:** Test.
- [x] **T-303** Posponer 10 minutos, 1 hora o hasta mañana — *Cubre:* RF-11. **Hecho cuando:** Test de las tres opciones.
- [x] **T-304** La hora flotante sobrevive al cambio de zona horaria — *Cubre:* CL-13. **Hecho cuando:** Test con dos zonas.
- [x] **T-305** Estado de permisos de notificación y aviso único — *Cubre:* RF-11. **Hecho cuando:** Test: el aviso sale una sola vez.

### Recordatorios (plataforma e interfaz)

*Requiere: Tareas y recordatorios (núcleo).*

- [x] **T-306** Notificación del sistema en escritorio — *Cubre:* RF-11. **Hecho cuando:** e2e de escritorio muestra la notificación.
- [x] **T-307** Ventana de recordatorio con Abrir, Hecho y Posponer — *Cubre:* RF-11. **Hecho cuando:** e2e de escritorio usa las tres acciones.
- [x] **T-308** Notificación web mientras la app está abierta — *Cubre:* RF-11, RF-19. **Hecho cuando:** e2e en navegador.
- [x] **T-309** Selector de fecha y recordatorio en el bloque de tarea y en propiedades — *Cubre:* RF-11. **Hecho cuando:** e2e fija ambos.
- [x] **T-310** Selector de recurrencia — *Cubre:* RF-11. **Hecho cuando:** e2e fija cada frecuencia.
- [x] **T-311** Agenda por espacio ordenada por fecha — *Cubre:* RF-12. **Hecho cuando:** e2e muestra casillas, tarjetas y filas.
- [x] **T-312** Resumen global al abrir: vencidos y de hoy de todos los espacios — *Cubre:* RF-12. **Hecho cuando:** e2e con dos espacios muestra el origen de cada uno.
- [x] **T-313** Acciones sobre vencidos reflejadas al instante — *Cubre:* RF-12. **Hecho cuando:** e2e marca, pospone y descarta.
- [x] **T-314** e2e completo: dispara, abre la tarea, pospone y completa — *Cubre:* RF-11, RF-12. **Hecho cuando:** Prueba pasa.
- [x] **T-315** e2e con la app cerrada a la hora: aparece vencido al abrir — *Cubre:* CL-12. **Hecho cuando:** Prueba pasa.

### Ampliar respaldo y restauración

*Requiere: Tareas y recordatorios (núcleo).*

- [x] **T-316** Serializar bases de datos (definición, propiedades, vistas, filas y vínculos) — *Cubre:* RF-15, RF-22. **Hecho cuando:** Test contra archivo de referencia.
- [x] **T-317** Serializar `reminders.json` — *Cubre:* RF-15. **Hecho cuando:** Test contra archivo de referencia.
- [x] **T-318** Restaurar bases de datos — *Cubre:* RF-17. **Hecho cuando:** Test compara con el original.
- [x] **T-319** Restaurar recordatorios y estados — *Cubre:* RF-17. **Hecho cuando:** Test compara con el original.
- [x] **T-320** Propiedad de ida y vuelta incluyendo bases de datos — *Cubre:* RF-17. **Hecho cuando:** fast-check pasa.
- [x] **T-321** Actualizar los archivos dorados del respaldo — *Cubre:* RNF-7. **Hecho cuando:** Salida idéntica a la nueva referencia.
- [x] **T-322** Demostrar criterios 3, 5 y 12 de la spec — *Cubre:* RF-8. **Hecho cuando:** Checklist firmado con evidencia.

---

## HITO 3 — Diagramas y organizadores


### Diagramas de flujo

*Requiere: Hito 2 (el editor y el respaldo ya existen).*

- [x] **T-323** Estructura Yjs del diagrama (nodos, conectores, vista) y su tipo canónico — *Cubre:* RF-9. **Hecho cuando:** Test de ida y vuelta canónico a Yjs.
- [x] **T-324** Bloque "diagrama" insertable desde `/` con lienzo vacío — *Cubre:* RF-9. **Hecho cuando:** e2e inserta el bloque.
- [x] **T-325** Integrar React Flow con el estado en Yjs — *Cubre:* RF-9. **Hecho cuando:** e2e: el estado persiste al recargar.
- [x] **T-326** Paleta de formas (inicio/fin, proceso, decisión, entrada/salida, nota) — *Cubre:* RF-9. **Hecho cuando:** e2e muestra las cinco formas.
- [x] **T-327** Arrastrar una forma de la paleta a la posición soltada — *Cubre:* RF-9. **Hecho cuando:** e2e: la forma queda donde se soltó.
- [x] **T-328** Mover y redimensionar formas — *Cubre:* RF-9. **Hecho cuando:** e2e.
- [x] **T-329** Editar el texto de las formas — *Cubre:* RF-9. **Hecho cuando:** e2e.
- [x] **T-330** Conectores con flecha que siguen a las formas — *Cubre:* RF-9. **Hecho cuando:** e2e: al mover una forma el conector la sigue.
- [x] **T-331** Editar el texto de los conectores — *Cubre:* RF-9. **Hecho cuando:** e2e.
- [x] **T-332** Cambiar el color de las formas — *Cubre:* RF-9. **Hecho cuando:** e2e.
- [x] **T-333** Eliminar una forma elimina sus conectores explícitamente e informa — *Cubre:* RF-9. **Hecho cuando:** e2e: no quedan conectores huérfanos.
- [x] **T-334** Zoom y desplazamiento — *Cubre:* RF-9. **Hecho cuando:** e2e.
- [x] **T-335** Ajustar a pantalla y centrar en un extremo del conector — *Cubre:* CL-8, CL-9. **Hecho cuando:** e2e de ambos botones.
- [x] **T-336** Deshacer y rehacer dentro del diagrama — *Cubre:* RF-9. **Hecho cuando:** e2e.
- [x] **T-337** Benchmark con 500 elementos — *Cubre:* RNF-3. **Hecho cuando:** Mover y ampliar dentro del presupuesto.
- [x] **T-338** Accesibilidad del lienzo: teclado y etiquetas — *Cubre:* RNF-9. **Hecho cuando:** axe sin errores graves.

### Organizadores gráficos

*Requiere: Diagramas de flujo.*

- [x] **T-339** Estructura de datos de árbol para organizadores — *Cubre:* RF-10. **Hecho cuando:** Tests de operaciones sobre el árbol.
- [x] **T-340** Disposición automática con d3-hierarchy — *Cubre:* RF-10. **Hecho cuando:** Test: posiciones sin solapamiento.
- [x] **T-341** Bloque mapa mental: agregar rama e hijo — *Cubre:* RF-10. **Hecho cuando:** e2e.
- [x] **T-342** Mapa mental: colapsar y recordar el estado — *Cubre:* RF-10. **Hecho cuando:** e2e: recargar conserva lo colapsado.
- [x] **T-343** Mapa mental: arrastrar para reubicar — *Cubre:* RF-10. **Hecho cuando:** e2e.
- [x] **T-344** Bloque organigrama con niveles padre-hijo — *Cubre:* RF-10. **Hecho cuando:** e2e.
- [x] **T-345** Organigrama: colapsar y reubicar — *Cubre:* RF-10. **Hecho cuando:** e2e.
- [x] **T-346** Bloque línea de tiempo y su estructura — *Cubre:* RF-10. **Hecho cuando:** e2e.
- [x] **T-347** Línea de tiempo: orden cronológico — *Cubre:* RF-10. **Hecho cuando:** Test con eventos en desorden.
- [x] **T-348** Línea de tiempo: empates estables sin solaparse — *Cubre:* CL-10. **Hecho cuando:** Test con dos eventos en la misma fecha.
- [x] **T-349** Línea de tiempo: arrastrar un evento cambia su fecha — *Cubre:* RF-10. **Hecho cuando:** e2e.
- [x] **T-350** Bloque matriz N×M con plantilla 2×2 — *Cubre:* RF-10. **Hecho cuando:** e2e.
- [x] **T-351** Matriz: editar celdas y arrastrar elementos — *Cubre:* RF-10. **Hecho cuando:** e2e.
- [x] **T-352** Derivar texto de etiquetas para la búsqueda — *Cubre:* RF-5, RF-9, RF-10. **Hecho cuando:** Test: una etiqueta de forma se encuentra al buscar.
- [x] **T-353** Serializar diagramas y organizadores en el respaldo y restaurarlos — *Cubre:* RF-15, RF-17. **Hecho cuando:** Test de ida y vuelta sin pérdida.
- [x] **T-354** Actualizar archivos dorados con diagramas y organizadores — *Cubre:* RNF-7. **Hecho cuando:** Salida idéntica a la referencia.
- [x] **T-355** e2e de cada tipo de organizador — *Cubre:* RF-10. **Hecho cuando:** Cuatro pruebas pasan.
- [x] **T-356** Demostrar el criterio 4 de la spec — *Cubre:* RF-9. **Hecho cuando:** Checklist firmado con evidencia.

---

## HITO 4 — Enlaces, grafo, captura rápida, importar y exportar


### Enlaces y retroenlaces

*Requiere: Hito 3.*

- [x] **T-357** Migración de `links` — *Cubre:* RF-6. **Hecho cuando:** Test comprueba la tabla.
- [x] **T-358** Mención en línea que guarda el id de destino — *Cubre:* RF-6. **Hecho cuando:** Test del modelo canónico.
- [x] **T-359** Menú de mención `@` / `[[` con búsqueda de páginas — *Cubre:* RF-6. **Hecho cuando:** e2e inserta una mención.
- [x] **T-360** Extraer enlaces al guardar y actualizar `links` — *Cubre:* RF-6. **Hecho cuando:** Test: agregar y quitar menciones actualiza la tabla.
- [x] **T-361** Retroenlaces: consulta y panel en la página — *Cubre:* RF-6. **Hecho cuando:** e2e muestra las páginas que enlazan.
- [x] **T-362** Renombrar una página mantiene los enlaces con el título nuevo — *Cubre:* RF-6. **Hecho cuando:** Test.
- [x] **T-363** Enlace roto con acción para restaurar desde la papelera — *Cubre:* RF-6, CL-5. **Hecho cuando:** e2e.
- [x] **T-364** Enlaces circulares permitidos — *Cubre:* CL-6. **Hecho cuando:** Test con ciclo A a B a A.

### Grafo

*Requiere: Enlaces y retroenlaces.*

- [x] **T-365** API de grafo: nodos y aristas por espacio, vista local y filtros — *Cubre:* RF-7. **Hecho cuando:** Test con espacio de ejemplo.
- [x] **T-366** Disposición de fuerzas en un worker — *Cubre:* RF-7. **Hecho cuando:** Test: el cálculo termina con 1 000 nodos.
- [x] **T-367** Render en canvas con zoom y arrastre — *Cubre:* RF-7. **Hecho cuando:** e2e.
- [x] **T-368** Selección: resaltar conexiones y abrir la página — *Cubre:* RF-7. **Hecho cuando:** e2e.
- [x] **T-369** Filtros y vista local por defecto — *Cubre:* RF-7. **Hecho cuando:** e2e.
- [x] **T-370** Mensaje cuando no hay enlaces — *Cubre:* RF-7. **Hecho cuando:** e2e.
- [x] **T-371** Benchmark con grafo grande — *Cubre:* RNF-11. **Hecho cuando:** Dentro del presupuesto.

### Captura rápida

*Requiere: Escritorio y Espacios.*

- [x] **T-372** Migración de `quick_capture_draft` — *Cubre:* RF-13. **Hecho cuando:** Test comprueba la tabla.
- [x] **T-373** Ventana mínima de captura — *Cubre:* RF-13. **Hecho cuando:** e2e de escritorio la abre.
- [x] **T-374** Guardado continuo del borrador — *Cubre:* RF-13. **Hecho cuando:** Test: el borrador existe tras cada edición.
- [x] **T-375** Confirmar guarda en la Bandeja del espacio predeterminado sin abrir el espacio — *Cubre:* RF-13. **Hecho cuando:** e2e: la nota aparece en la bandeja.
- [x] **T-376** Cancelar con texto conserva el borrador y ofrece descartarlo — *Cubre:* RF-13. **Hecho cuando:** e2e de ambos caminos.
- [x] **T-377** Ajuste para elegir el espacio predeterminado — *Cubre:* RF-13. **Hecho cuando:** e2e.
- [x] **T-378** Espacio predeterminado eliminado: pedir elegir otro — *Cubre:* CL-30. **Hecho cuando:** e2e.
- [x] **T-379** Mover o convertir una nota de la bandeja en página o tarjeta — *Cubre:* RF-13. **Hecho cuando:** e2e.
- [x] **T-380** Atajo global (`ShortcutService` de escritorio) — *Cubre:* RF-13. **Hecho cuando:** e2e abre la captura desde otra app.
- [x] **T-381** Detectar atajo no disponible y avisar — *Cubre:* RF-13, CL-15. **Hecho cuando:** e2e simulando fallo del registro.
- [x] **T-382** Captura desde la bandeja del sistema y desde dentro de la app — *Cubre:* RF-13. **Hecho cuando:** e2e de ambas.
- [x] **T-383** Argumento interno de captura reenviado a la instancia en ejecución — *Cubre:* RF-13. **Hecho cuando:** e2e: segunda ejecución abre la ventana de captura.
- [x] **T-384** Instrucciones para asignar un atajo del sistema — *Cubre:* RF-13. **Hecho cuando:** e2e muestra el texto con el comando.

### Importar

*Requiere: Enlaces y retroenlaces.*

- [x] **T-385** Modelo y tabla del informe de importación — *Cubre:* RF-23. **Hecho cuando:** Test guarda importado, aproximado y omitido.
- [x] **T-386** Lector de Markdown con remark a modelo canónico — *Cubre:* RF-23. **Hecho cuando:** Tests por tipo de bloque.
- [x] **T-387** Imágenes locales referenciadas a `AssetStore` — *Cubre:* RF-23. **Hecho cuando:** Test: la imagen queda adjunta.
- [x] **T-388** Enlaces `[[ ]]` de Obsidian a menciones — *Cubre:* RF-23. **Hecho cuando:** Test de resolución por nombre.
- [x] **T-389** Importar una carpeta de Markdown en una página contenedora — *Cubre:* RF-23, CL-28. **Hecho cuando:** Test: nada existente se sobrescribe.
- [x] **T-390** Leer el ZIP con fflate — *Cubre:* RF-23. **Hecho cuando:** Test lista el contenido de un ZIP de ejemplo.
- [x] **T-391** Notion: jerarquía y nombres con identificador — *Cubre:* RF-23. **Hecho cuando:** Test reconstruye el árbol.
- [x] **T-392** Notion: CSV con papaparse a base de datos básica — *Cubre:* RF-23. **Hecho cuando:** Test: columnas y filas correctas.
- [x] **T-393** Notion: elementos sin equivalente aproximados y reportados — *Cubre:* RF-23. **Hecho cuando:** Test: el informe los lista.
- [x] **T-394** Enlaces rotos de la importación listados — *Cubre:* CL-27. **Hecho cuando:** Test del informe.
- [x] **T-395** Archivo dañado o no soportado: omitir y reportar — *Cubre:* RF-23. **Hecho cuando:** Test con archivo corrupto.
- [x] **T-396** Importación atómica: cancelar revierte todo — *Cubre:* RF-23, RNF-12. **Hecho cuando:** Test de inyección de fallos.
- [x] **T-397** Progreso y cancelación en un worker — *Cubre:* RF-23, RNF-12. **Hecho cuando:** e2e cancela a la mitad.
- [x] **T-398** Interfaz de importación con informe final — *Cubre:* RF-23. **Hecho cuando:** e2e muestra el informe.
- [x] **T-399** Importar dos veces crea dos contenedores — *Cubre:* CL-28. **Hecho cuando:** Test.
- [x] **T-400** Fixtures sintéticos de Obsidian y de Notion — *Cubre:* RF-23. **Hecho cuando:** Pruebas de ambos pasan.

### Exportar

*Requiere: Enlaces y retroenlaces.*

- [x] **T-401** Renderizador de bloques a HTML — *Cubre:* RF-24. **Hecho cuando:** Archivo de referencia por tipo de bloque.
- [x] **T-402** Estilos incrustados e imágenes en línea — *Cubre:* RF-24. **Hecho cuando:** Test: el HTML se abre sin archivos externos.
- [x] **T-403** Renderizador SVG de diagramas — *Cubre:* RF-24. **Hecho cuando:** Archivo de referencia.
- [x] **T-404** Renderizador SVG de organizadores — *Cubre:* RF-24. **Hecho cuando:** Archivos de referencia.
- [x] **T-405** Exportar con páginas hijas (con índice) — *Cubre:* RF-24. **Hecho cuando:** Test de estructura.
- [x] **T-406** Exportar la vista elegida de una base de datos — *Cubre:* RF-24. **Hecho cuando:** Test.
- [x] **T-407** Adjunto faltante: avisar y completar — *Cubre:* RF-24. **Hecho cuando:** Test.
- [x] **T-408** Estilos de impresión para PDF — *Cubre:* RF-24. **Hecho cuando:** Revisión visual de un PDF de ejemplo.
- [x] **T-409** PDF en escritorio: impresión nativa a archivo o diálogo del sistema — *Cubre:* RF-24. **Hecho cuando:** e2e de escritorio genera un PDF.
- [x] **T-410** PDF en web: diálogo de impresión — *Cubre:* RF-24. **Hecho cuando:** e2e abre el diálogo.
- [x] **T-411** Progreso y cancelación de la exportación — *Cubre:* RF-24, RNF-12, CL-31. **Hecho cuando:** e2e cancela una exportación grande.
- [x] **T-412** Interfaz de exportar (HTML o PDF, con o sin hijas) — *Cubre:* RF-24. **Hecho cuando:** e2e.
- [x] **T-413** Archivos dorados de exportación — *Cubre:* RF-24. **Hecho cuando:** Salida idéntica a la referencia.

### Cierre del MVP

*Requiere: todos los hitos.*

- [x] **T-414** Matriz de verificación de CL-1 a CL-36 con su prueba — *Cubre:* CL-1. **Hecho cuando:** Cada caso tiene una prueba que pasa.
- [x] **T-415** Verificar RNF-1 a RNF-13 con sus pruebas — *Cubre:* RNF-1. **Hecho cuando:** Todos los presupuestos cumplidos.
- [x] **T-416** Auditoría completa de accesibilidad — *Cubre:* RNF-9. **Hecho cuando:** axe sin errores graves en todas las pantallas.
- [x] **T-417** Demostrar los criterios 1 a 18 de la spec — *Cubre:* RF-1. **Hecho cuando:** Checklist completo con evidencia.
- [x] **T-418** Sincronizar spec.md y plan.md con lo construido — *Cubre:* art. 2. **Hecho cuando:** Sin diferencias entre código, spec y plan.

---

## Resumen

| Hito | Tareas |
|---|---|
| HITO 0 | 26 |
| HITO 1 | 199 |
| HITO 2 | 97 |
| HITO 3 | 34 |
| HITO 4 | 62 |
| **Total** | **418** |

## Cobertura de requisitos funcionales

| RF | Tareas |
|---|---|
| RF-1 | T-036, T-043, T-044, T-046, T-047, T-048, T-049, T-050, T-051, T-052, T-053, T-054, T-055, T-056, T-110, T-111, T-112, T-113, T-114, T-115, T-116, T-225, T-417 |
| RF-2 | T-057, T-058, T-059, T-060, T-061, T-062, T-117 |
| RF-3 | T-003, T-004, T-005, T-008, T-009, T-068, T-069, T-070, T-071, T-072, T-073, T-074, T-098, T-099, T-100, T-119, T-121, T-122, T-123, T-124, T-125, T-126, T-127, T-128, T-131, T-132 |
| RF-4 | T-007, T-010, T-037, T-039, T-041, T-063, T-064, T-065, T-066, T-067, T-091, T-092, T-093, T-094, T-095, T-120, T-132, T-133 |
| RF-5 | T-011, T-014, T-075, T-076, T-077, T-078, T-079, T-080, T-081, T-082, T-135, T-136, T-137, T-138, T-139, T-140, T-352 |
| RF-6 | T-357, T-358, T-359, T-360, T-361, T-362, T-363 |
| RF-7 | T-365, T-366, T-367, T-368, T-369, T-370 |
| RF-8 | T-234, T-279, T-280, T-281, T-282, T-283, T-284, T-285, T-286, T-322 |
| RF-9 | T-323, T-324, T-325, T-326, T-327, T-328, T-329, T-330, T-331, T-332, T-333, T-334, T-336, T-352, T-356 |
| RF-10 | T-339, T-340, T-341, T-342, T-343, T-344, T-345, T-346, T-347, T-349, T-350, T-351, T-352, T-355 |
| RF-11 | T-018, T-019, T-289, T-290, T-291, T-292, T-293, T-294, T-295, T-296, T-297, T-298, T-300, T-302, T-303, T-305, T-306, T-307, T-308, T-309, T-310, T-314 |
| RF-12 | T-311, T-312, T-313, T-314 |
| RF-13 | T-017, T-020, T-021, T-087, T-090, T-372, T-373, T-374, T-375, T-376, T-377, T-379, T-380, T-381, T-382, T-383, T-384 |
| RF-14 | T-022, T-180, T-194, T-200, T-201, T-202, T-204, T-205, T-206 |
| RF-15 | T-015, T-152, T-167, T-168, T-170, T-171, T-172, T-173, T-174, T-177, T-178, T-181, T-182, T-183, T-187, T-188, T-189, T-190, T-193, T-194, T-195, T-198, T-207, T-208, T-221, T-316, T-317, T-353 |
| RF-16 | T-179, T-182, T-184, T-185, T-192, T-196, T-199, T-209, T-210 |
| RF-17 | T-073, T-212, T-213, T-214, T-215, T-216, T-217, T-218, T-219, T-220, T-221, T-318, T-319, T-320, T-353 |
| RF-18 | T-013, T-096, T-097, T-147, T-148 |
| RF-19 | T-001, T-002, T-016, T-024, T-104, T-105, T-146, T-149, T-150, T-153, T-164, T-165, T-166, T-224, T-308 |
| RF-20 | T-030, T-031, T-107, T-109, T-141, T-142, T-143, T-144 |
| RF-21 | T-084, T-085, T-086, T-088, T-089, T-118 |
| RF-22 | T-226, T-227, T-228, T-229, T-230, T-231, T-232, T-233, T-234, T-235, T-236, T-237, T-238, T-239, T-240, T-241, T-242, T-244, T-245, T-246, T-247, T-248, T-249, T-250, T-251, T-252, T-253, T-254, T-255, T-256, T-257, T-258, T-260, T-262, T-264, T-265, T-266, T-268, T-269, T-270, T-271, T-272, T-273, T-274, T-275, T-276, T-277, T-278, T-316 |
| RF-23 | T-073, T-385, T-386, T-387, T-388, T-389, T-390, T-391, T-392, T-393, T-395, T-396, T-397, T-398, T-400 |
| RF-24 | T-023, T-401, T-402, T-403, T-404, T-405, T-406, T-407, T-408, T-409, T-410, T-411, T-412, T-413 |
| RF-25 | T-155, T-156, T-157, T-158, T-159, T-160, T-161, T-162 |
