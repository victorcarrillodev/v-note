import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  optimizeDeps: { exclude: ["@sqlite.org/sqlite-wasm"] },
  server: { port: 1420, strictPort: true },
});
