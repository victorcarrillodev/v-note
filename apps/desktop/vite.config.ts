import { defineConfig, type Plugin } from "vite";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";

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
  plugins: [tailwindcss()],
  clearScreen: false,
  worker: { plugins: () => [noDomEntities()] },
  server: { port: 1430, strictPort: true },
  resolve: {
    // La suite de contrato de @vnote/core usa la API de Vitest; en la app se sustituye por un mini-ejecutor.
    alias: { vitest: resolve(__dirname, "src/contract/vitestShim.ts") },
  },
  build: {
    rollupOptions: { input: { main: resolve(__dirname, "index.html"), contract: resolve(__dirname, "contract.html") } },
  },
});
