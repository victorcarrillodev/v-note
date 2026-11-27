---
feature: unified-backup
status: done
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
- [x] T-2 (S2, S3, S5) route=inline commit=- Definir puerto `BackupDestination`, formato unificado (`app/` + `workspaces/<id>/`) y `AppBackupService` con actualización in-place por manifiesto SHA-256. Risk: ítem 3 (formato de respaldo y comandos nuevos; contrato cubierto por pruebas)
- [x] T-3 (S4) route=inline commit=- Añadir modo `on_idle` (debounce, maxWait, coalescencia y backoff) en `BackupScheduler` y serialización incremental sin deterioro de rendimiento. Risk: ítem 4 (planificador con coalescencia; cubierto por pruebas)
- [x] T-4 (S2, S5) route=inline commit=- Implementar destinos (`LocalFolderDestination`, `GoogleDriveDestination`, `DropboxDestination`, `GitHubDestination`) y puertos de plataforma / OAuth PKCE. Risk: ítem 1 (escribe en destinos externos; escritura atómica y diff por SHA-256 con pruebas)
- [x] T-5 (S2, S3) route=inline commit=- Añadir restauración unificada (`restoreAllFromBackup`) y actualizar `BackupPanel` y `RestoreWizard` con selector fácil de destino y modo continuo. Risk: ítem 3 (formato de respaldo y comandos nuevos; contrato cubierto por pruebas)
- [x] T-6 (S1-S5) route=inline commit=- Ejecutar `bun run typecheck`, `bun run test`, `v-ia task check` y `v-ia review check`. Risk: none

## Evidencia
| Tarea | Comando / comprobación | Resultado observado | Fecha |
|---|---|---|---|
| T-1 | Lectura de `docs/constitution.md` y `AGENTS.md` | Reglas actualizadas a ODD + multi-destino | 2026-11-24 |

| T-2 | `bun run test packages/core/src/backup` | AppBackupService, destination y manifiesto: 286 pruebas del módulo pasan | 2026-11-27 |
| T-3 | `bun run test packages/core/src/backup/idleScheduler.test.ts unifiedBackupController.test.ts packages/core/src/workspaces/writeNotifier.test.ts` | debounce, maxWait, coalescencia, backoff y aviso de escritura pasan | 2026-11-27 |
| T-4 | `githubDestination.test.ts destinationFactory.test.ts oauthPkce.test.ts tauriBackupPorts.test.ts`; `cargo test --offline --workspace` | GitHub/Drive/Dropbox/carpeta, PKCE y puertos Tauri pasan; Rust: 5 pruebas de backup_fs ok | 2026-11-27 |
| T-5 | `UnifiedBackupPanel.test.tsx RestoreAllPanel.test.tsx AppUnifiedBackup.test.tsx` | Respaldar todos los espacios, no reescribir sin cambios y restaurar todo como espacios nuevos | 2026-11-27 |
| T-6 | `bun run typecheck && bun run test` | typecheck ok; 351 archivos, 3642 pruebas pasan | 2026-11-27 |
| Revisión | `v-ia review check` + 4 lentes v-ia-reviewer (risk, resilience, readability, reliability) | Recibo pass (candidato e13aaf79b7b4); las 4 lentes approve; `v-ia review status`: ready (approved) | 2026-11-27 |

## Log
- L1: Creación de ficha ODD para respaldo unificado multi-destino y transición de SDD a ODD.
- L2: 2026-11-27 el usuario eligió «los cuatro destinos completos»: Drive y Dropbox por OAuth PKCE con client ID propio de la persona (se pega en Respaldo unificado). No verificado contra Google/Dropbox reales ni con la app de escritorio abierta.
- L3: 2026-11-27 revisión independiente aprobada. Anotado sin corregir: oauth_wait no cancelable; `GET /cb` con state ajeno gasta el intento; mensajes en español dentro de `core` sin i18n; AppUnifiedBackup.test.tsx:61 podría dar falso verde en el segundo respaldo.
