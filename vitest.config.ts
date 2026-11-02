import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    include: ["tests/**/*.test.ts", "packages/*/src/**/*.test.{ts,tsx}", "packages/*/tests/**/*.test.{ts,tsx}", "apps/*/src/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "spikes/**", "**/dist/**"],
    // Las pruebas de componentes de la interfaz necesitan DOM; el resto corre en Node.
    environmentMatchGlobs: [["packages/ui/**", "jsdom"], ["apps/**", "jsdom"]],
    // La suite completa corre cientos de pruebas de interfaz a la vez; con 5 s algunas flujos largos fallan por carga, no por error.
    testTimeout: 20_000,
    hookTimeout: 60_000,
    setupFiles: ["./tests/setup-dom.ts"],
  },
});
