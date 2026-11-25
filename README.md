# Notas de estudio para programación

El nombre del producto se define en `brand.config.json`.

Notas de estudio enfocadas en programación: bloques, bases de datos, diagramas, mapas y enlaces entre páginas. Funciona sin internet; los datos viven en SQLite local.

## Requisitos
- [Bun](https://bun.sh)
- Para la app de escritorio: Rust y las [dependencias de Tauri 2](https://tauri.app/start/prerequisites/)

## Desarrollo
Desde la raíz:

```bash
bun install
```

La app web se levanta desde `apps/web` y la de escritorio desde `apps/desktop`:

```bash
cd apps/web && bun run dev
cd apps/desktop && bun run tauri dev
```

## Pruebas
```bash
bun run typecheck
bun run test
bun run test:e2e
```

## Instaladores
`bun run installer`. Detalles en [docs/instaladores.md](docs/instaladores.md).

## Documentación
- [Manual de uso](docs/manual/README.md)
- [Formato del respaldo](docs/backup-format.md)
- [Constitución del proyecto](docs/constitution.md)

## Licencia
[MIT](LICENSE). El proyecto está en desarrollo y todavía no publica instaladores oficiales.
