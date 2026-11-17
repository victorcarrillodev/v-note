# AGENTS.md - v-note

## Proyecto
Aplicación de notas estilo notion, affine y obsidian todo en uno. Una aplicación con funciones avanzadas para poder crear notas de estudio enfocado a programación para poder crear mapas de flujos, diagramas y diferentes tipos de organizadores gráficos, además de poder enlazar archivos entre si por medio de nodos.

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
- Explora con Graphify y Serena según «Flujo obligatorio» (sección *Exploración del código*) antes de redactar un plan o cambiar código.
- No añadas dependencias, ni cambies el stack o el formato de respaldo, sin actualizar antes el plan.
- Respeta los hitos del plan: no empieces un hito hasta cerrar el anterior.
- No modifiques archivos dentro de `specs/` salvo petición explícita.
- Respaldo a GitHub: el token va solo en el llavero del sistema, nunca en el repo, en logs ni en archivos de configuración. Exporta Markdown + JSON sin cifrar a un repo privado, con salida determinista y sin commit si no hubo cambios.
- Nunca escribas datos del usuario fuera de su workspace local ni los envíes a servicios externos, salvo el respaldo a GitHub.
- Si una prueba del Hito 0 sobre Tauri en Linux falla sin arreglo (ver el plan), detente y pregunta antes de cambiar a Electron.

## Exploración del código
Dos herramientas con papeles distintos. **Graphify para orientarse** (qué toca algo, dónde encaja, qué spec lo menciona) y **Serena para trabajar** (leer, buscar referencias exactas y editar código). No uses una para el trabajo de la otra.

| Momento | Herramienta |
|---|---|
| Empezar una spec, un hito o una tarea en una zona que no conoces | Graphify: `graphify explain`, `graphify affected`, `graphify query` |
| Decidir el alcance de un cambio (qué archivos y qué specs toca) | Graphify: `graphify affected "<símbolo>"` (dos niveles de dependencia) |
| Leer una función, un componente o una clase concreta | Serena: `find_symbol(..., include_body=True)` |
| Ver los usos exactos de algo antes de cambiar su firma | Serena: `find_referencing_symbols` |
| Editar, renombrar o borrar código | Serena (nunca Graphify: solo lee) |
| Markdown, JSON, CSS, configuración, Rust de `apps/desktop/src-tauri` | `Read`/`grep` nativos (Serena solo tiene activo el servidor de TypeScript) |

- No abras archivos de código enteros para descubrir qué contienen: primero Graphify o la vista de símbolos de Serena, después solo los cuerpos que necesites.
- **Puertos del núcleo** (`AssetStore`, `Keychain`, `SqlStore`…): para encontrar sus implementaciones en los adaptadores usa `find_referencing_symbols` de Serena o `graphify affected`. `find_implementations` de Serena **no encuentra las implementaciones de otro paquete** (por ejemplo, `TauriKeychain` en `adapters-tauri`).
- Tras cambios grandes: `graphify update .` para refrescar el grafo, y `find_referencing_symbols` y `get_diagnostics_for_file` de Serena sobre lo que cambiaste.

### Flujo obligatorio (no es opcional)
Usar estas herramientas es parte del trabajo, no una sugerencia. Si una tarea no las usa, la respuesta final debe decir por qué (por ejemplo, «solo toqué un archivo Markdown»).

1. **Al empezar la sesión:** llama a `initial_instructions` de Serena (una vez) y comprueba que existe `graphify-out/`. Si no existe, o si hay cambios sin refrescar desde la sesión anterior, ejecuta `graphify update .`. Si Serena aún no hizo el *onboarding* del proyecto, avisa a la persona antes de ejecutarlo.
2. **Antes de escribir o cambiar una spec, un plan o una lista de tareas:** ejecuta `graphify affected "<símbolo>"` y `graphify explain "<nombre>"` de cada símbolo, módulo o ajuste que la spec vaya a tocar, y anota en el plan los archivos y las specs anteriores que aparecen. El plan no debe afirmar «nadie más usa X» sin haberlo comprobado así.
3. **Antes de tocar código:** orientación con Graphify (qué archivos y specs toca) y, con Serena, `get_symbols_overview` del archivo y `find_symbol(..., include_body=True)` solo de lo que vayas a cambiar.
4. **Antes de cambiar una firma, un tipo exportado o una constante compartida:** `find_referencing_symbols` de Serena sobre el símbolo, incluidos los usos en otros paquetes. Un `grep` solo vale como primer candidato, nunca como prueba de que no hay más usos.
5. **Para editar código:** herramientas de edición de Serena (`replace_symbol_body`, `rename_symbol`, `replace_content`…). `Edit` nativo solo para Markdown, JSON, CSS, configuración y Rust de `apps/desktop/src-tauri`.
6. **Al terminar un cambio grande:** `graphify update .`, `get_diagnostics_for_file` sobre lo modificado y, después, `bun run typecheck` y `bun run test`.
7. **Si los hooks de búsqueda te avisan** de que usas demasiado `grep` o `Read`, no es ruido: cambia a Graphify o Serena en lugar de seguir con lo mismo.

**Qué no hace ninguna de las dos:** Graphify solo relaciona a nivel de archivo y de sección (no sabe qué línea ni qué función exacta usa algo), y Serena solo consulta TypeScript (no entiende Markdown, CSS ni el Rust de Tauri). Para esas zonas usa `Read` y `grep`, y dilo en el plan cuando una conclusión dependa de ellos.

## Herramientas instaladas (nivel usuario)

### `serena` — inteligencia de código (MCP)
Arranca solo en cada sesión con el proyecto del directorio actual (`.serena/project.yml`, servidor de lenguaje `typescript`). En este equipo no hay npm: el servidor de TypeScript está instalado con Bun y se indica con `ls_specific_settings.typescript.ls_path` en `~/.serena/serena_config.yml`.
- **Al empezar la sesión:** llama a `initial_instructions` una vez para obtener el id de sesión. Todo lo demás pasa por `serena_repl` (código Python sobre el objeto `s`). Si los esquemas aparecen como diferidos, cárgalos con `ToolSearch` antes del primer uso.
- **Las líneas que devuelve Serena empiezan en 0.** Las llamadas independientes se pueden lanzar en paralelo en un mismo turno.
- Sus respuestas incluyen fragmentos de código y pueden ser largas: acota con `relative_path` y `include_kinds`, y usa `max_answer_chars` si hace falta.

| Caso | Llamada |
|---|---|
| Ver qué hay en un archivo de código antes de leerlo | `s.lsp.get_symbols_overview(ruta)` |
| Leer una función, componente o clase concreta | `s.lsp.find_symbol("Nombre", include_body=True)`. Con `depth=1` y sin cuerpo, para listar antes los miembros de una clase |
| Saber quién usa algo antes de cambiar su firma o lo que exporta, también entre paquetes (`core` → `ui` y adaptadores) | `s.lsp.find_referencing_symbols(...)` |
| Ir a la definición de un símbolo importado | `s.lsp.find_declaration(...)` |
| Renombrar un símbolo en todo el monorepo | `s.lsp.rename_symbol(...)`, que actualiza importaciones y usos de forma atómica |
| Borrar un símbolo comprobando que nadie lo usa | `s.lsp.safe_delete_symbol(...)` |
| Reemplazar una función o componente completo | `s.edit.replace_symbol_body(...)` |
| Añadir código junto a un símbolo | `s.edit.insert_after_symbol` / `s.edit.insert_before_symbol` |
| Cambiar unas pocas líneas dentro de un símbolo grande | `s.edit.replace_content(...)` (texto o regex) |
| El mismo cambio en muchos archivos | `s.edit.replace_in_files(..., dry_run=True)`, revisar y luego aplicar |
| Buscar un patrón en el código, como candidatos para luego leerlos por símbolo | `s.fs.search_for_pattern(...)`, acotado a una ruta |
| Comprobación rápida tras editar, antes del `typecheck` completo | `s.lsp.get_diagnostics_for_file(ruta)` |
| Guardar conclusiones duraderas y no obvias del código | `s.mem.write_memory(...)` / `s.mem.read_memory(...)` (en `.serena/memories/`) |

Documentación de cada parte: `s.info("lsp")`, `s.info("edit")`, `s.info("fs")` y `s.info("mem")`. Si una herramienta de refactorización de Serena termina sin error, el cambio ya está aplicado en todos los usos: no hace falta releer los archivos.

### `graphify` — grafo de conocimiento (CLI y skill `/graphify`)
Instalado con `uv` (paquete `graphifyy`). El grafo vive en `graphify-out/` (`graph.json`, `GRAPH_REPORT.md`, `graph.html`), que **no se versiona** (está en `.gitignore`). Relaciona código y documentación: las secciones de `docs/specs/` aparecen enlazadas con los símbolos que mencionan.
- **Generar o refrescar el grafo:** `graphify update .` (solo código y encabezados de Markdown, local, sin IA, unos 8 s). Hazlo al empezar una sesión si `graphify-out/` no existe o tras cambios grandes. Para un análisis semántico de la documentación con IA, `/graphify .`, solo si la persona lo pide (gasta tokens).
- **Consultas** (desde la raíz del repo):

| Caso | Comando |
|---|---|
| Qué es algo y con qué se relaciona | `graphify explain "<nombre>"` |
| Qué se ve afectado si cambia algo (incluye specs y planes que lo mencionan) | `graphify affected "<nombre>"` |
| Pregunta libre sobre el proyecto | `graphify query "<pregunta>"` |
| Cómo se conectan dos piezas | `graphify path "<A>" "<B>"` |
| Piezas centrales (las más conectadas) | `graphify god-nodes` |
| Leer una sección concreta de un documento | `graphify section "docs/specs/005-v-note-estilo-paginas/plan.md#<sección>"` |

- Sus respuestas son a nivel de archivo ("importa", "llama"): para la línea y la función exactas, sigue con Serena.
- Limita la salida con `| head -n 40`; `affected` de un puerto muy usado puede pasar de 100 líneas.
- No instales sus hooks (`graphify claude install`, `graphify install --project`): interceptan cada búsqueda y chocan con las reglas de esta sección.

### Reglas de uso
- Para una lectura pequeña (unas pocas líneas ya ubicadas) o un literal exacto, `Read`/`grep` nativos siguen bien.
- Comprobación de salud: `claude mcp list` debe mostrar `serena` como conectado, y `serena project health-check .` debe terminar con «Health check passed». `graphify --help` debe responder. Si algo falla, avisa antes de seguir.

## Al terminar cualquier tarea
- Ejecuta `bun run typecheck` y `bun run test` y confirma en tu respuesta que todo pasa.
