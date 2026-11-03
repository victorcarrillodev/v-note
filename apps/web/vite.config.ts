import { brandPlugin } from "../../packages/ui/src/identity/brandPlugin";
import { themeBootPlugin } from "../../packages/ui/src/theme/bootPlugin";
import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { buildManifest } from "./pwa.manifest";

const brand = JSON.parse(readFileSync(new URL("../../brand.config.json", import.meta.url), "utf8")) as { name: string; appId: string };

// En un worker no existe `document`: el export «browser» de decode-named-character-reference (usado por el análisis de Markdown) lo toca al cargarse.
// Se fuerza su variante sin DOM, que sirve igual en el hilo principal.
const noDomEntities = (): Plugin => ({
  name: "vnote:no-dom-entities",
  enforce: "pre",
  async resolveId(id, importer, options) {
    if (id !== "decode-named-character-reference") return null;
    const r = await this.resolve(id, importer, { ...options, skipSelf: true });
    return r && r.id.endsWith("index.dom.js") ? { ...r, id: r.id.replace(/index\.dom\.js$/, "index.js") } : r;
  },
});

export default defineConfig({
  plugins: [themeBootPlugin(), brandPlugin(), 
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
  worker: { format: "es", plugins: () => [noDomEntities()] },
});
