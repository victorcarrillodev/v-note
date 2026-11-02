// T-102 (prueba primero): solo un contexto (pestaña/ventana) puede editar un espacio a la vez (CL-22).
import { describe, it, expect } from "vitest";
import { WebInstanceLock, type LockManagerLike } from "./webInstanceLock";

/** Simula la semántica de Web Locks para `ifAvailable`: el bloqueo se mantiene mientras la promesa del callback no se resuelva. */
class FakeLocks implements LockManagerLike {
  private held = new Set<string>();
  async request<T>(name: string, opts: { ifAvailable: true }, cb: (lock: object | null) => Promise<T> | T): Promise<T> {
    void opts;
    if (this.held.has(name)) return cb(null);
    this.held.add(name);
    try {
      return await cb({});
    } finally {
      this.held.delete(name);
    }
  }
}

describe("WebInstanceLock", () => {
  it("el primer contexto obtiene el bloqueo y el segundo no", async () => {
    const locks = new FakeLocks();
    const a = await new WebInstanceLock(locks).acquire("espacio-1");
    const b = await new WebInstanceLock(locks).acquire("espacio-1");
    expect(a).not.toBeNull();
    expect(b).toBeNull();
  });
  it("espacios distintos no se bloquean entre sí", async () => {
    const locks = new FakeLocks();
    expect(await new WebInstanceLock(locks).acquire("a")).not.toBeNull();
    expect(await new WebInstanceLock(locks).acquire("b")).not.toBeNull();
  });
  it("al liberar, otro contexto puede obtenerlo", async () => {
    const locks = new FakeLocks();
    const a = await new WebInstanceLock(locks).acquire("e");
    await a!.release();
    expect(await new WebInstanceLock(locks).acquire("e")).not.toBeNull();
  });
  it("liberar dos veces no falla", async () => {
    const a = await new WebInstanceLock(new FakeLocks()).acquire("e");
    await a!.release();
    await expect(a!.release()).resolves.toBeUndefined();
  });
  it("si el navegador no soporta Web Locks, avisa en vez de permitir ediciones simultáneas", async () => {
    await expect(new WebInstanceLock(null).acquire("e")).rejects.toThrow(/Web Locks/);
  });
});
