---
feature: backup_integration
status: in-progress
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
- [ ] T-1 (S1) Estado sin verificar: ficha reconstruida

## Log
- L1: "ya está entonces la integración completa?"
- L2: 2026-11-24, formato de la ficha completado con autorización del usuario; el contenido previo no se ha reverificado.
