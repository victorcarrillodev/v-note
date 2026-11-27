import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/** Archivos de Pyodide que se empaquetan con la aplicación: el intérprete funciona sin red y sin CDN. */
export const PYODIDE_FILES = ["pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"] as const;
const TYPES: Record<string, string> = { mjs: "text/javascript", js: "text/javascript", wasm: "application/wasm", zip: "application/zip", json: "application/json" };
const dir = () => dirname(createRequire(import.meta.url).resolve("pyodide"));
const typeOf = (file: string) => TYPES[file.split(".").pop() ?? ""] ?? "application/octet-stream";

type Res = { statusCode: number; setHeader(k: string, v: string): void; end(b?: Uint8Array): void };
type Server = { middlewares: { use(h: (req: { url?: string }, res: Res, next: () => void) => void | Promise<void>): void } };
type BuildCtx = { emitFile(f: { type: "asset"; fileName: string; source: Uint8Array }): void };

/**
 * Plugin de Vite (sin depender de sus tipos: este paquete no es una aplicación).
 * Sirve (en desarrollo) y emite (al construir) los archivos de Pyodide bajo `/pyodide/`.
 * Solo los de la lista: nada más del paquete queda accesible desde la dirección.
 */
export function pyodideAssets() {
  return {
    name: "vnote:pyodide-assets",
    configureServer(server: Server) {
      server.middlewares.use(async (req, res, next) => {
        const m = /^\/pyodide\/([A-Za-z0-9_.-]+)(?:\?.*)?$/.exec(req.url ?? "");
        const file = m?.[1];
        if (!file || !(PYODIDE_FILES as readonly string[]).includes(file)) return next();
        try {
          const body = await readFile(join(dir(), file));
          res.statusCode = 200;
          res.setHeader("Content-Type", typeOf(file));
          res.setHeader("Cache-Control", "no-cache");
          res.end(body);
        } catch { next(); }
      });
    },
    async generateBundle(this: BuildCtx) {
      for (const file of PYODIDE_FILES) {
        this.emitFile({ type: "asset", fileName: `pyodide/${file}`, source: new Uint8Array(await readFile(join(dir(), file))) });
      }
    },
  };
}
