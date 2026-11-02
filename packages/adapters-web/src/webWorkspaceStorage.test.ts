// @vitest-environment jsdom
// T-104 (prueba primero): configuración en localStorage y almacenamiento de espacios en OPFS vía worker.
import { describe, it, expect, beforeEach } from "vitest";
import { LocalStorageConfigStore, WebWorkspaceStorage } from "./webWorkspaceStorage";
import type { WorkerLike } from "./wasmSqlStore";

describe("LocalStorageConfigStore", () => {
  beforeEach(() => localStorage.clear());
  it("lee null si no hay registro y devuelve lo escrito", async () => {
    const s = new LocalStorageConfigStore();
    expect(await s.read()).toBeNull();
    await s.write("{\"version\":1}");
    expect(await s.read()).toBe("{\"version\":1}");
    expect(localStorage.getItem("vnote:config")).toBe("{\"version\":1}");
  });
  it("si localStorage falla al escribir, lanza un error en vez de perder el registro en silencio", async () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error("cuota excedida"); };
    try { await expect(new LocalStorageConfigStore().write("x")).rejects.toThrow("cuota excedida"); }
    finally { Storage.prototype.setItem = orig; }
  });
});

function fakeWorkerFactory() {
  const sent: any[] = [];
  const created: WorkerLike[] = [];
  const factory = (): WorkerLike => {
    const w: WorkerLike = {
      onmessage: null,
      postMessage(msg: any) { sent.push(msg); queueMicrotask(() => w.onmessage?.({ data: { id: msg.id, ok: true } })); },
      terminate() {},
    };
    created.push(w);
    return w;
  };
  return { factory, sent, created };
}

describe("WebWorkspaceStorage", () => {
  it("la ubicación por defecto es una ruta propia del espacio", () => {
    const s = new WebWorkspaceStorage(fakeWorkerFactory().factory);
    expect(s.defaultLocation("abc")).toBe("/workspaces/abc/space.db");
  });
  it("open crea un worker y le pide abrir esa ruta", async () => {
    const f = fakeWorkerFactory();
    const s = new WebWorkspaceStorage(f.factory);
    await s.open("/workspaces/abc/space.db");
    expect(f.created).toHaveLength(1);
    expect(f.sent[0]).toMatchObject({ op: "open", path: "/workspaces/abc/space.db" });
  });
  it("exists es verdadero (el registro de espacios ya es la fuente de verdad en el navegador)", async () => {
    expect(await new WebWorkspaceStorage(fakeWorkerFactory().factory).exists("/x")).toBe(true);
  });
  it("remove pide al worker borrar la base", async () => {
    const f = fakeWorkerFactory();
    await new WebWorkspaceStorage(f.factory).remove("/workspaces/abc/space.db");
    expect(f.sent.map((m) => m.op)).toEqual(["unlink"]);
    expect(f.sent[0].path).toBe("/workspaces/abc/space.db");
  });
});
