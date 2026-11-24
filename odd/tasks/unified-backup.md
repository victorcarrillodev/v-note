---
feature: unified-backup
status: active
created: 2026-11-24
updated: 2026-11-24
authorized-by: usuario / 2026-11-24 / ejecución del plan backup_destinations_plan.md
delivery: ask-on-risk
test-runner: bun run typecheck && bun run test
---
## Specs
- S1: "no uses el modelo de spec por SDD ahora utilizaremos ODD asi que las cosas que lo restrinjan eliminalas. haz el cambio en constitution para que se pueda en diferentes plataformas."
- S2: "quiero que se puedan hacer respaldos de la aplicacion en diferentes lugares, como google drive, github, dropbox y demas lugares que sirvan para poder almacenar este tipo de archivos" + "poder elejir donde guardar la informacio" + "poder hacer que el registro de lugar de guardado sea facil"
- S3: "y los espacios y demas se juntan en un solo lugar para poder descargar y/ actualizar todo junto"
- S4: "Que la aplicacion este haciendo copias de seguridad cad que una persona termine de escribir sin que la app sufra deterioro en la velocidad y funcionamiento."
- S5: "Hacer que la aplicacion cuando guarde los respaldos no cree copias y copias, sino que actualice lo que tiene y no genere copias basura y desgaste el almacenamiento"

## Tareas
- [x] T-1 (S1) route=inline commit=- Migrar `docs/constitution.md` y `AGENTS.md` de SDD/Serena/Graphify a ODD/Engram/Codegraph y habilitar múltiples destinos de respaldo. Risk: none
- [ ] T-2 (S2, S3, S5) route=inline commit=- Definir puerto `BackupDestination`, formato unificado (`app/` + `workspaces/<id>/`) y `AppBackupService` con actualización in-place por manifiesto SHA-256.
- [ ] T-3 (S4) route=inline commit=- Añadir modo `on_idle` (debounce, maxWait, coalescencia y backoff) en `BackupScheduler` y serialización incremental sin deterioro de rendimiento.
- [ ] T-4 (S2, S5) route=inline commit=- Implementar destinos (`LocalFolderDestination`, `GoogleDriveDestination`, `DropboxDestination`, `GitHubDestination`) y puertos de plataforma / OAuth PKCE.
- [ ] T-5 (S2, S3) route=inline commit=- Añadir restauración unificada (`restoreAllFromBackup`) y actualizar `BackupPanel` y `RestoreWizard` con selector fácil de destino y modo continuo.
- [ ] T-6 (S1-S5) route=inline commit=- Ejecutar `bun run typecheck`, `bun run test`, `v-ia task check` y `v-ia review check`.

## Evidencia
| Tarea | Comando / comprobación | Resultado observado | Fecha |
|---|---|---|---|
| T-1 | Lectura de `docs/constitution.md` y `AGENTS.md` | Reglas actualizadas a ODD + multi-destino | 2026-11-24 |

## Log
- L1: Creación de ficha ODD para respaldo unificado multi-destino y transición de SDD a ODD.
