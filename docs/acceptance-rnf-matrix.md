# Verificación de requisitos no funcionales (T-415)

Cada RNF-1 a RNF-13 y la prueba o configuración que lo verifica. `tests/rnfMatrix.test.ts` comprueba que cada archivo existe.
Las filas que dependen de e2e reales (RNF-3, RNF-5, RNF-9) o de CI en varios sistemas (RNF-8) se ejecutan fuera de `bun run test`.

| Requisito | Verificación |
|---|---|
| RNF-1 | `packages/core/src/pages/scale.test.ts` |
| RNF-2 | `packages/core/src/blocks/count.test.ts` |
| RNF-3 | `tests-e2e/diagramScale.e2e.test.ts` |
| RNF-4 | `packages/core/src/docs/docStore.test.ts` |
| RNF-5 | `tests-e2e/privacy.e2e.test.ts` |
| RNF-6 | `packages/core/src/backup/tokenStore.test.ts` |
| RNF-7 | `packages/core/src/backup/serialize.test.ts` |
| RNF-8 | `.github/workflows/ci.yml` |
| RNF-9 | `tests-e2e/a11y.e2e.test.ts` |
| RNF-10 | `packages/ui/src/i18n/i18n.test.tsx` |
| RNF-11 | `packages/core/src/databases/scale.test.ts` |
| RNF-12 | `packages/core/src/backup/backupWorker.test.ts` |
| RNF-13 | `packages/core/src/formulas/engine.scale.test.ts` |
