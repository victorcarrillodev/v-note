// study-features-2 T-2 (e2e real en Chrome): el SVG que produce Mermaid de verdad pasa el filtro de seguridad de la exportación.
// Si el filtro rechazara lo que Mermaid genera, la exportación volvería siempre al código y el dibujo nunca llegaría al documento.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { isSafeSvg, svgProblems } from "../packages/core/src/export/html";
import { Page, launchChrome } from "./cdp";

const dist = join(dirname(createRequire(resolve(__dirname, "../packages/ui/package.json")).resolve("mermaid/package.json")), "dist");
const MIME: Record<string, string> = { ".mjs": "text/javascript", ".js": "text/javascript", ".json": "application/json", ".css": "text/css" };

const EXAMPLES: Record<string, string> = {
  flow: "graph TD\n  A[Inicio] --> B{¿Condición?}\n  B -- Sí --> C[Procesar]\n  B -- No --> D[Fin]",
  sequence: "sequenceDiagram\n  Cliente->>Servidor: Petición\n  Servidor-->>Cliente: Respuesta",
  classes: "classDiagram\n  class Pila {\n    +push(x)\n    +pop()\n  }",
  states: "stateDiagram-v2\n  [*] --> Pendiente\n  Pendiente --> Hecho\n  Hecho --> [*]",
  special: "graph LR\n  A[\"Texto con & y < y # y ñ y ✓\"] --> B[Segundo]",
};

let server: Server, chrome: { stop(): void }, page: Page;
beforeAll(async () => {
  server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? "/").split("?")[0]!);
    if (path.startsWith("/__mermaid/")) {
      const file = join(dist, path.slice("/__mermaid/".length));
      if (file.startsWith(dist) && existsSync(file) && statSync(file).isFile()) { res.setHeader("Content-Type", MIME[extname(file)] ?? "application/octet-stream"); res.end(readFileSync(file)); return; }
      res.statusCode = 404; res.end(); return;
    }
    res.setHeader("Content-Type", "text/html"); res.end("<!doctype html><html><body></body></html>");
  });
  await new Promise<void>((r) => server.listen(4196, r));
  chrome = await launchChrome(9396);
  page = await Page.open(9396, "http://localhost:4196/");
}, 120_000);
afterAll(async () => { await page?.close().catch(() => {}); chrome?.stop(); server?.close(); });

describe("SVG de Mermaid real frente al filtro de exportación", () => {
  it("todos los tipos de diagrama del selector pasan, con la misma configuración que usa la exportación", async () => {
    await page.eval(`(async () => {
      const m = (await import('/__mermaid/mermaid.esm.min.mjs')).default;
      m.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default', htmlLabels: false, flowchart: { htmlLabels: false } });
      const out = {};
      let i = 0;
      for (const [name, code] of Object.entries(${JSON.stringify(EXAMPLES)})) {
        try { await m.parse(code); out[name] = (await m.render('vn-e2e-' + (i++), code)).svg; } catch (e) { out[name] = 'ERROR: ' + e.message; }
      }
      window.__svgs = out;
    })()`);
    await page.waitFor("!!window.__svgs", 60_000);
    const svgs = await page.eval<Record<string, string>>("window.__svgs");
    for (const [name, svg] of Object.entries(svgs)) {
      expect(svg.startsWith("ERROR"), `${name}: ${svg.slice(0, 120)}`).toBe(false);
      expect(svgProblems(svg), `${name} rechazado por el filtro`).toEqual([]);
      expect(isSafeSvg(svg)).toBe(true);
    }
    expect(Object.keys(svgs)).toHaveLength(Object.keys(EXAMPLES).length);
  }, 120_000);
});
