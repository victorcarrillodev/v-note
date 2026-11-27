// @vitest-environment node
// study-features-2 T-8 (prueba primero): los archivos de Pyodide viajan con la aplicación (sin red) y se sirven en desarrollo.
import { describe, it, expect } from "vitest";
import { pyodideAssets, PYODIDE_FILES } from "./pyodidePlugin";

describe("archivos de Pyodide empaquetados", () => {
  it("lista exactamente los archivos que el intérprete necesita", () => {
    expect([...PYODIDE_FILES].sort()).toEqual(["pyodide-lock.json", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip"]);
  });

  it("al construir, los emite bajo pyodide/ con su contenido real", async () => {
    const plugin = pyodideAssets();
    const emitted: { fileName: string; size: number }[] = [];
    await (plugin.generateBundle as (this: unknown) => Promise<void>).call({
      emitFile: (f: { fileName: string; source: Uint8Array }) => { emitted.push({ fileName: f.fileName, size: f.source.length }); },
    });
    expect(emitted.map((f) => f.fileName).sort()).toEqual(PYODIDE_FILES.map((f) => `pyodide/${f}`).sort());
    expect(emitted.every((f) => f.size > 0)).toBe(true);
    expect(emitted.find((f) => f.fileName === "pyodide/pyodide.asm.wasm")!.size).toBeGreaterThan(1_000_000);
  });

  it("en desarrollo responde /pyodide/<archivo> con el tipo correcto y rechaza lo que no esté en la lista", async () => {
    const plugin = pyodideAssets();
    let handler!: (req: { url?: string }, res: FakeRes, next: () => void) => void;
    (plugin.configureServer as (s: unknown) => void)({ middlewares: { use: (h: typeof handler) => { handler = h; } } });
    const call = (url: string) => new Promise<{ status: number; type: string | undefined; bytes: number; nexted: boolean }>((resolve) => {
      const res = new FakeRes(() => resolve({ status: res.statusCode, type: res.headers["content-type"], bytes: res.body.length, nexted: false }));
      handler({ url }, res, () => resolve({ status: 0, type: undefined, bytes: 0, nexted: true }));
    });
    const wasm = await call("/pyodide/pyodide.asm.wasm");
    expect(wasm).toMatchObject({ status: 200, type: "application/wasm" });
    expect(wasm.bytes).toBeGreaterThan(1_000_000);
    expect((await call("/pyodide/python_stdlib.zip")).type).toBe("application/zip");
    expect((await call("/pyodide/../package.json")).nexted).toBe(true);   // fuera de la lista: no se sirve
    expect((await call("/pyodide/otro.txt")).nexted).toBe(true);
    expect((await call("/assets/app.js")).nexted).toBe(true);
  });
});

class FakeRes {
  statusCode = 0; headers: Record<string, string> = {}; body: Uint8Array = new Uint8Array(0);
  constructor(private onEnd: () => void) {}
  setHeader(k: string, v: string) { this.headers[k.toLowerCase()] = v; }
  end(b?: Uint8Array) { if (b) this.body = b; this.onEnd(); }
}
