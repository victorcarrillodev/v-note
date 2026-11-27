# AGENTS.md - v-note

## Proyecto

Aplicación de notas y apuntes profesional. Una aplicación con funciones avanzadas para poder crear notas de estudio enfocado a sistemas computacionales o estudio en general.

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

- Typescript estricto en toddo el proyecto; React19 + Vite + Vite Plus + sass
- Monorepo con bun workspaces (sin Turborepo). El núcleo de dominio (páginas, bloques, propiedades, fórmulas) es TypeScript puro, sin dependencias de UI ni de Tauri.
- Lo específico de plataforma (almacenamiento, llavero, planificador, ventana, OAuth) va solo en la capa adaptador, para poder cambiar Tauri por Electron sin tocar el editor ni el núcleo.
- Identificadores en inglés; textos de interfaz en español, con i18n desde el inicio (es/en).
- El nombre del proyecto vive en un solo lugar de configuración; no lo escribas a mano en varios archivos.
- El proyecto debe tener una arquitectura estilo scream arquitecture contando con un directorio "/shared" para componentes, codigo y utils reutilizables.

## Reglas

- Lee `docs/constitution.md` antes de tocar código y sigue el flujo **ODD** (`v-ia`, `odd/tasks/`).
- Usa **Engram** para memoria persistente de decisiones/arquitectura y **Codegraph** (cuando esté disponible en el entorno) para explorar dependencias, según lo dictado en `v-ia`.
- Respaldo multi-destino: los tokens y credenciales van solo en el llavero del sistema, nunca en el repo, en logs ni en archivos de configuración. Exporta de forma determinista e incremental al destino configurado por el usuario (Carpeta local, Google Drive, Dropbox, GitHub, etc.) actualizando in-place sin copias basura.
- Nunca escribas datos del usuario fuera de su workspace local ni los envíes a servicios externos no configurados explícitamente por el usuario para respaldo o funciones opcionales (Unsplash).

## Al terminar cualquier tarea

- Ejecuta `bun run typecheck` y `bun run test` y confirma en tu respuesta que todo pasa.
