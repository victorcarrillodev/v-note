import { defineConfig } from "vitest/config";

// Pruebas de extremo a extremo de la app de escritorio real (requieren el binario compilado, tauri-driver y una pantalla).
export default defineConfig({
  test: { include: ["tests-e2e/**/*.e2e.test.ts"], testTimeout: 120_000, hookTimeout: 120_000, fileParallelism: false },
});
