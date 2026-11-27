import { describe, it, expect, vi } from "vitest";
import { UnifiedBackupController } from "./unifiedBackupController";
import type { SyncOutcome } from "./destination";

const clock = { now: () => 0 } as never;
const okDest = () => Promise.resolve({ ok: true as const, value: {} as never });

describe("UnifiedBackupController", () => {
  it("syncNow sincroniza y publica el estado; los errores reintentables no se marcan fatales", async () => {
    const outcomes: SyncOutcome[] = [
      { status: "success", receipt: { manifest: { version: 3, updatedAt: 1, files: {} }, uploaded: 1, updated: 0, removed: 0 } },
      { status: "failed", error: { kind: "OFFLINE", message: "sin red", retryable: true } },
      { status: "failed", error: { kind: "AUTH", message: "token", retryable: false } },
    ];
    const syncTo = vi.fn(async () => outcomes.shift()!);
    const states: string[] = [];
    const c = new UnifiedBackupController({ service: { syncTo, invalidateWorkspace: vi.fn(), resetManifestCache: vi.fn() } as never, destination: okDest, clock });
    c.setContinuous(true);
    c.onStatus((s) => states.push(s.state));
    expect((await c.syncNow()).status).toBe("success");
    expect(c.status().state).toBe("ok");
    await c.syncNow();
    expect(c.status().state).toBe("retrying");
    await c.syncNow();
    expect(c.status().state).toBe("error");
    expect(states).toContain("syncing");
    c.dispose();
  });

  it("notifyChange invalida el espacio y agenda solo si el modo continuo está activo", async () => {
    const invalidate = vi.fn();
    const syncTo = vi.fn(async (): Promise<SyncOutcome> => ({ status: "unchanged", manifest: null }));
    const c = new UnifiedBackupController({ service: { syncTo, invalidateWorkspace: invalidate, resetManifestCache: vi.fn() } as never, destination: okDest, clock, debounceMs: 0, maxWaitMs: 0 });
    c.setContinuous(false);
    c.notifyChange("w1");
    expect(invalidate).toHaveBeenCalledWith("w1");
    await new Promise((r) => setTimeout(r, 20));
    expect(syncTo).not.toHaveBeenCalled();
    c.setContinuous(true);
    await new Promise((r) => setTimeout(r, 30));
    expect(syncTo).toHaveBeenCalledTimes(1);
    c.dispose();
  });

  it("sin destino configurado informa el error sin lanzar", async () => {
    const c = new UnifiedBackupController({
      service: { syncTo: vi.fn(), invalidateWorkspace: vi.fn(), resetManifestCache: vi.fn() } as never,
      destination: async () => ({ ok: false as const, error: { kind: "INVALID" as const, message: "sin destino", retryable: false } }),
      clock,
    });
    const r = await c.syncNow();
    expect(r.status).toBe("failed");
    expect(c.status().state).toBe("error");
    c.dispose();
  });

  it("reutiliza la misma instancia de destino entre respaldos (conserva sus ids remotos) hasta que cambia el destino", async () => {
    const syncTo = vi.fn(async (): Promise<SyncOutcome> => ({ status: "unchanged", manifest: null }));
    const make = vi.fn(async () => ({ ok: true as const, value: {} as never }));
    const reset = vi.fn();
    const c = new UnifiedBackupController({ service: { syncTo, invalidateWorkspace: vi.fn(), resetManifestCache: reset } as never, destination: make, clock });
    await c.syncNow();
    await c.syncNow();
    expect(make).toHaveBeenCalledTimes(1);
    c.destinationChanged();
    expect(reset).toHaveBeenCalled();
    await c.syncNow();
    expect(make).toHaveBeenCalledTimes(2);
    c.dispose();
  });

  it("una excepción en syncTo se informa como reintento y dos syncNow simultáneos comparten el trabajo", async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const syncTo = vi.fn(async (): Promise<SyncOutcome> => { calls++; await gate; return { status: "unchanged", manifest: null }; });
    const c = new UnifiedBackupController({ service: { syncTo, invalidateWorkspace: vi.fn(), resetManifestCache: vi.fn() } as never, destination: okDest, clock });
    const p1 = c.syncNow();
    const p2 = c.syncNow();
    release();
    await Promise.all([p1, p2]);
    expect(calls).toBe(1);

    const boom = new UnifiedBackupController({ service: { syncTo: vi.fn(async () => { throw new Error("explotó"); }), invalidateWorkspace: vi.fn(), resetManifestCache: vi.fn() } as never, destination: okDest, clock });
    boom.setContinuous(true);
    const r = await boom.syncNow();
    expect(r.status).toBe("failed");
    expect(boom.status().state).toBe("retrying");
    c.dispose();
    boom.dispose();
  });

  it("si crear el destino lanza una excepción, informa el error y no deja el estado en «syncing»", async () => {
    const c = new UnifiedBackupController({
      service: { syncTo: vi.fn(), invalidateWorkspace: vi.fn(), resetManifestCache: vi.fn() } as never,
      destination: async () => { throw new Error("llavero bloqueado"); },
      clock,
    });
    const r = await c.syncNow();
    expect(r.status).toBe("failed");
    expect(c.status().state).not.toBe("syncing");
    expect(c.status().message).toContain("llavero bloqueado");
    c.dispose();
  });

  it("un respaldo manual no cancela el respaldo continuo ya pendiente", async () => {
    const syncTo = vi.fn(async (): Promise<SyncOutcome> => ({ status: "unchanged", manifest: null }));
    const c = new UnifiedBackupController({ service: { syncTo, invalidateWorkspace: vi.fn(), resetManifestCache: vi.fn() } as never, destination: okDest, clock, debounceMs: 20, maxWaitMs: 40 });
    c.setContinuous(true);
    c.notifyChange("w1");
    await c.syncNow();
    expect(syncTo).toHaveBeenCalledTimes(1);
    await new Promise((r) => setTimeout(r, 80));
    expect(syncTo).toHaveBeenCalledTimes(2);
    c.dispose();
  });

  it("con el modo continuo apagado, un fallo transitorio del respaldo manual NO promete reintento automático", async () => {
    const syncTo = vi.fn(async (): Promise<SyncOutcome> => ({ status: "failed", error: { kind: "OFFLINE", message: "sin red", retryable: true } }));
    const c = new UnifiedBackupController({ service: { syncTo, invalidateWorkspace: vi.fn(), resetManifestCache: vi.fn() } as never, destination: okDest, clock });
    await c.syncNow();
    expect(c.status().state).toBe("error");
    expect(c.status().message).toBe("sin red");
    c.dispose();
  });
});
