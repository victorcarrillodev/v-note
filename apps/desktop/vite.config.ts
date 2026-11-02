import { defineConfig } from "vite";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  clearScreen: false,
  server: { port: 1430, strictPort: true },
  resolve: {
    // La suite de contrato de @vnote/core usa la API de Vitest; en la app se sustituye por un mini-ejecutor.
    alias: { vitest: resolve(__dirname, "src/contract/vitestShim.ts") },
  },
  build: {
    rollupOptions: { input: { main: resolve(__dirname, "index.html"), contract: resolve(__dirname, "contract.html") } },
  },
});
