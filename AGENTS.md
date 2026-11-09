# AGENTS.md - v-note

## Proyecto
Clon personal de Notion (nombre de trabajo: **v-note**, puede cambiar). App web *local-first* de un solo usuario,
instalable en Linux, Windows y macOS con Tauri 2 (Electron como plan B) y como PWA. Editor de bloques con BlockNote,
datos en SQLite local y copias de seguridad programadas (de 1 día a 1 semana) a un repositorio privado de GitHub.
No hay servidor, cuentas, sincronización entre equipos, IA ni cifrado en el alcance actual.

> Estado: fase de planeación, aún no hay código. Los comandos de abajo son los previstos y se confirman en la Fase 0.

## Comandos

### Desarrollo
```bash
bun install
bun run dev            # app web en el navegador
bun run tauri dev      # app de escritorio
```

### Tests
```bash
bun run typecheck
bun run test           # unitarias (Vitest)
bun run test:e2e       # Playwright
```

### Empaquetado
```bash
bun run tauri build    # AppImage/.deb/.rpm en Linux, .msi/.exe en Windows
```

## Estilo
- TypeScript estricto en todo el proyecto; React 19 + Vite + Tailwind + Radix/shadcn.
- Monorepo con bun workspaces (sin Turborepo). El núcleo de dominio (páginas, bloques, propiedades, fórmulas) es TypeScript puro, sin dependencias de UI ni de Tauri.
- Lo específico de plataforma (almacenamiento, llavero, planificador, ventana) va solo en la capa adaptador, para poder cambiar Tauri por Electron sin tocar el editor ni el núcleo.
- Identificadores en inglés; textos de interfaz en español, con i18n desde el inicio (es/en).
- El nombre del proyecto vive en un solo lugar de configuración; no lo escribas a mano en varios archivos.

## Reglas
- Lee `docs/constitution.md` y la spec activa en `specs/` (`spec.md` y `plan.md`) antes de tocar código.
- No añadas dependencias, ni cambies el stack o el formato de respaldo, sin actualizar antes el plan.
- Respeta los hitos del plan: no empieces un hito hasta cerrar el anterior.
- No modifiques archivos dentro de `specs/` salvo petición explícita.
- Respaldo a GitHub: el token va solo en el llavero del sistema, nunca en el repo, en logs ni en archivos de configuración. Exporta Markdown + JSON sin cifrar a un repo privado, con salida determinista y sin commit si no hubo cambios.
- Nunca escribas datos del usuario fuera de su workspace local ni los envíes a servicios externos, salvo el respaldo a GitHub.
- Si una prueba del Hito 0 sobre Tauri en Linux falla sin arreglo (ver el plan), detente y pregunta antes de cambiar a Electron.

## Exploración del código
- Antes de explorar o modificar código, usa el MCP `codebase-memory` (`search_graph`, `trace_path`, `get_code_snippet`, `get_architecture`); usa `grep` solo para literales, configuración y archivos que no sean código.
- Si el proyecto no está indexado (`list_projects` vacío), ejecuta `index_repository` sobre la raíz del repo antes de empezar.
- Tras cambios grandes, vuelve a indexar y usa `detect_changes` para revisar el impacto.

## Herramientas MCP instaladas (siempre disponibles, nivel usuario)
Dos servidores MCP están registrados a nivel de usuario y arrancan solos en cada sesión (no son un proceso aparte que haya que levantar). Úsalos por defecto en estos casos:

### `codebase-index` (mcp-codebase-index) — estructura del código
- **Antes de leer archivos enteros**: `get_project_summary`, `get_structure_summary`, `list_files`, `search_codebase`.
- **Localizar y leer una pieza concreta**: `find_symbol`, `get_function_source`, `get_class_source`, `get_functions`, `get_classes` (en vez de abrir el archivo completo).
- **Antes de cambiar una función o módulo**: `get_dependencies`, `get_dependents`, `get_call_chain`, `get_change_impact`, `get_file_dependencies`, `get_file_dependents`.
- **Tras cambios grandes** (varios archivos, mover o renombrar): `reindex`.
- Ojo: el índice incluye carpetas generadas (`dist/`); ignora esos resultados y prefiere los de `src/`.

### `token-optimizer` (@ooples/token-optimizer-mcp) — ahorro de contexto
- **Archivos grandes o releídos**: `smart_read`. **Búsquedas amplias de contenido**: `smart_grep`. **Descubrir archivos**: `smart_glob`. **Ediciones grandes**: `smart_edit` / `smart_write`.
- **Contexto casi lleno**: `optimize_session`. **Conclusiones duraderas y no obvias**: `wiki_write` (y `wiki_query`/`wiki_read` para consultarlas).
- **Informes**: `get_optimization_report`, `token_audit`, `waste_audit`.
- Si sus esquemas aparecen como diferidos, cárgalos con `ToolSearch` la primera vez que haga falta una lectura grande o una búsqueda amplia, no antes.

### Reglas de uso
- Para una lectura pequeña (unas pocas líneas) o un literal exacto, `Read`/`grep` nativos siguen bien.
- Comprobación de salud: `claude mcp list` debe mostrar ambos como conectados; si no, reinstalar antes de seguir.
- Regla de datos del proyecto: `token-optimizer` trae funciones opcionales que hablan con servicios externos (proxy/enrutador OrcaRouter, resúmenes con APIs de Anthropic o Google). **No las actives ni configures claves para ellas**; usa solo las herramientas locales de arriba.

## Al terminar cualquier tarea
- Ejecuta `bun run typecheck` y `bun run test` y confirma en tu respuesta que todo pasa.
