# Instaladores (Linux y Windows)

El nombre del producto sale de `brand.config.json`; los scripts lo pasan a Tauri con `--config`, así que `tauri.conf.json` no lo lleva escrito.

## Generarlos en GitHub Actions (método recomendado)

Workflow: `.github/workflows/package.yml` (Linux y Windows en paralelo).

1. **A mano:** GitHub → *Actions* → *package* → *Run workflow*; o `gh workflow run package.yml`.
2. **Con versión:** `git tag v0.1.0 && git push origin v0.1.0` (cualquier tag `v*`).
3. Al terminar, bajar los artefactos de la ejecución: `gh run download <id>` (o desde la web).

| Artefacto | Contenido |
| --- | --- |
| `instaladores-ubuntu-latest` | `.deb`, `.AppImage`, `.rpm` |
| `instaladores-windows-latest` | `*-setup.exe` (NSIS, es/en) y `.msi` |

Antes de cada versión, subir `version` en `apps/desktop/src-tauri/tauri.conf.json` (y en `package.json` de `apps/desktop`).

## Generarlos en local

- **Linux:** `bun run installer` → `dist-installers/` (`.deb`, `.AppImage`, `.rpm` si hay `rpmbuild`).
- **Windows (en Windows):** `bun run installer` → `.exe` NSIS y `.msi` en `dist-installers/`.
- **Windows desde Linux:** no funciona con el `nsis` de AUR (es de 64 bits y el plugin de Tauri es de 32): `Plugin not found ... SemverCompare`. Usar Actions.

## Notas

- Los instaladores no están firmados: Windows SmartScreen avisará al instalar.
- El build de Linux en CI necesita `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `patchelf`, `libdbus-1-dev`, `libssl-dev` y `rpm` para el `.rpm` (ya instalados en el workflow).
