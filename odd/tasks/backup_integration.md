---
feature: backup_integration
status: superseded
updated: 2026-11-24
---
## Specs
- S1: "ya está entonces la integración completa?"

# Backup integration task

User asked: "ya está entonces la integración completa?"

## Current status
- Google Drive mock updated to simulate PATCH on duplicate file names. (Test edit applied)
- Pending:
  - Wire UI preferences `backup_destination_kind` and `backup_auto_idle` in `apps/desktop/src/main.tsx`.
  - Ensure `IdleBackupScheduler` is instantiated when auto‑backup flag is true.
  - Update documentation (`docs/constitution.md`, `AGENTS.md`).
  - Run full test suite (`bun run test`).
  - Perform ODD review checks (`v-ia task check`, `v-ia review check`).

## Next steps
Await user approval to modify the application code, docs, and run the full tests.

## Tareas
- [x] T-1 (S1) Absorbida por unified-backup T-5 (UI, modo continuo, restauración). Risk: none

## Evidencia
| Tarea | Comando / comprobación | Resultado observado | Fecha |
|---|---|---|---|
| T-1 | `bun run test packages/ui/src/app/AppUnifiedBackup.test.tsx` | Integración completa por UI: respaldar, no reescribir sin cambios y restaurar todo | 2026-11-27 |

## Log
- L1: "ya está entonces la integración completa?"
- L2: 2026-11-24, formato de la ficha completado con autorización del usuario; el contenido previo no se ha reverificado.
- L3: 2026-11-27 sustituida por unified-backup (T-2 a T-6), cerrada con pruebas.
