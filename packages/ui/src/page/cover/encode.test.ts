// E-076 (RF-2.2) y E-077 (RNF-4): codificar la portada a JPEG sobre fondo blanco, en el worker o en el hilo principal.
import { describe, it, expect, vi } from "vitest";
import { encodeCover, decodeAndEncode, type CoverCanvas, type Ctx2D } from "./encode";
import { optimizeCover } from "./optimize";

const calls: string[] = [];
const fakeCanvas = (w: number, h: number, bytes = [0xff, 0xd8, 0xff, 0xe0]): CoverCanvas => ({
  getContext: () => {
    const ctx: Ctx2D = {
      set fillStyle(v: string) { calls.push(`fill:${v}`); },
      get fillStyle() { return ""; },
      fillRect: (x: number, y: number, cw: number, ch: number) => { calls.push(`rect:${x},${y},${cw},${ch}`); },
      drawImage: (_i: never, x: number, y: number, dw: number, dh: number) => { calls.push(`draw:${x},${y},${dw},${dh}`); },
    };
    return ctx;
  },
  convertToBlob: async (o) => { calls.push(`blob:${o.type}:${o.quality}:${w}x${h}`); return new Blob([new Uint8Array(bytes)]); },
});

describe("encodeCover (E-076)", () => {
  it("pinta primero un fondo blanco y después la imagen, y codifica JPEG a 0,85", async () => {
    calls.length = 0;
    const out = await encodeCover({ width: 800, height: 400 }, fakeCanvas);
    expect(calls).toEqual(["fill:white", "rect:0,0,800,400", "draw:0,0,800,400", "blob:image/jpeg:0.85:800x400"]);
    expect([...out.jpeg]).toEqual([0xff, 0xd8, 0xff, 0xe0]);
    expect(out).toMatchObject({ sourceWidth: 800, sourceHeight: 400 });
  });
  it("reduce a 2560 px de ancho sin agrandar las pequeñas", async () => {
    calls.length = 0;
    await encodeCover({ width: 5120, height: 2000 }, fakeCanvas);
    expect(calls).toContain("blob:image/jpeg:0.85:2560x1000");
    calls.length = 0;
    await encodeCover({ width: 300, height: 100 }, fakeCanvas);
    expect(calls).toContain("blob:image/jpeg:0.85:300x100");
  });
  it("libera el mapa de bits", async () => {
    const close = vi.fn();
    await encodeCover({ width: 10, height: 10, close }, fakeCanvas);
    expect(close).toHaveBeenCalled();
  });
  it("sin contexto 2D falla con un error de imagen", async () => {
    await expect(encodeCover({ width: 10, height: 10 }, () => ({ getContext: () => null, convertToBlob: async () => new Blob() }))).rejects.toMatchObject({ code: "corrupt" });
  });
  it("decodeAndEncode respeta la orientación EXIF y trata un fallo de decodificación como imagen dañada", async () => {
    const createBitmap = vi.fn(async () => ({ width: 100, height: 50 }));
    await decodeAndEncode(new Uint8Array([1, 2, 3]), { createBitmap, makeCanvas: fakeCanvas });
    expect(createBitmap).toHaveBeenCalledWith(expect.any(Blob), { imageOrientation: "from-image" });
    await expect(decodeAndEncode(new Uint8Array([1]), { createBitmap: async () => { throw new Error("x"); }, makeCanvas: fakeCanvas })).rejects.toMatchObject({ code: "corrupt" });
  });
});

describe("optimizeCover (E-077)", () => {
  const deps = { createBitmap: async () => ({ width: 640, height: 480 }), makeCanvas: fakeCanvas };
  it("usa el worker cuando existe", async () => {
    const worker = { postMessage: vi.fn(function (this: { onmessage?: (e: { data: unknown }) => void }) { queueMicrotask(() => this.onmessage?.({ data: { ok: true, jpeg: new Uint8Array([9]), sourceWidth: 10, sourceHeight: 5 } })); }), terminate: vi.fn(), onmessage: undefined as never, onerror: undefined as never };
    const r = await optimizeCover(new Uint8Array([1]), { createWorker: () => worker as never, main: deps });
    expect(r).toEqual({ jpeg: new Uint8Array([9]), sourceWidth: 10, sourceHeight: 5 });
    expect(worker.terminate).toHaveBeenCalled();
  });
  it("sin worker, lo hace en el hilo principal tras ceder el turno", async () => {
    const order: string[] = [];
    const p = optimizeCover(new Uint8Array([1]), { createWorker: () => null, main: { createBitmap: async () => { order.push("decode"); return { width: 640, height: 480 }; }, makeCanvas: fakeCanvas } });
    order.push("sync");
    const r = await p;
    expect(order).toEqual(["sync", "decode"]);
    expect(r.sourceWidth).toBe(640);
  });
  it("si el worker falla, cae al hilo principal", async () => {
    const worker = { postMessage() { queueMicrotask(() => (this as never as { onerror: () => void }).onerror()); }, terminate: vi.fn(), onmessage: undefined as never, onerror: undefined as never };
    const r = await optimizeCover(new Uint8Array([1]), { createWorker: () => worker as never, main: deps });
    expect(r.sourceHeight).toBe(480);
  });
  it("un error de imagen dañada del worker no se reintenta en el hilo principal", async () => {
    const worker = { postMessage() { queueMicrotask(() => (this as never as { onmessage: (e: unknown) => void }).onmessage({ data: { ok: false, code: "corrupt" } })); }, terminate: vi.fn(), onmessage: undefined as never, onerror: undefined as never };
    const main = { createBitmap: vi.fn(), makeCanvas: fakeCanvas };
    await expect(optimizeCover(new Uint8Array([1]), { createWorker: () => worker as never, main: main as never })).rejects.toMatchObject({ code: "corrupt" });
    expect(main.createBitmap).not.toHaveBeenCalled();
  });
});
