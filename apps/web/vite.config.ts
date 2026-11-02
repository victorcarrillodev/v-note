import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { buildManifest } from "./pwa.manifest";

const brand = JSON.parse(readFileSync(new URL("../../brand.config.json", import.meta.url), "utf8")) as { name: string; appId: string };

export default defineConfig({
  plugins: [
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: buildManifest(brand),
      includeAssets: ["icons/*.png"],
      workbox: {
        // Todo lo necesario para arrancar sin red: código, estilos, el .wasm de SQLite y el worker.
        globPatterns: ["**/*.{js,css,html,wasm,png,svg,woff,woff2,webmanifest}"],
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: { port: 1440, strictPort: true },
  // sqlite-wasm carga su .wasm por URL relativa: no debe optimizarse/empaquetarse en dependencias (hallazgo del Hito 0).
  optimizeDeps: { exclude: ["@sqlite.org/sqlite-wasm"] },
  worker: { format: "es" },
});
