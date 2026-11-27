import { describe, it, expect } from "vitest";
import { MemoryConfigStore, MemoryWorkspaceStorage } from "../../tests/support/memoryPorts";
import { FakeClock } from "../clock";
import { WorkspaceManager } from "./workspaceManager";

describe("aviso de escritura por espacio", () => {
  it("avisa con el id del espacio al escribir (exec y transacción) y no al leer", async () => {
    const mgr = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), new FakeClock(1_000));
    const seen: string[] = [];
    const off = mgr.onWrite((id) => seen.push(id));
    const created = await mgr.create({ name: "A" });
    if (!created.ok) throw new Error("create");
    const id = created.value.id;
    const opened = await mgr.open(id);
    if (!opened.ok) throw new Error("open");
    const { store } = opened.value;

    seen.length = 0;
    await store.query("SELECT 1 AS x");
    expect(seen).toEqual([]);

    await store.exec("CREATE TABLE IF NOT EXISTS t_notify (a INTEGER)");
    expect(seen).toEqual([id]);

    seen.length = 0;
    await store.transaction(async (tx) => { await tx.exec("INSERT INTO t_notify (a) VALUES (1)"); });
    expect(seen).toEqual([id]);

    off();
    seen.length = 0;
    await store.exec("INSERT INTO t_notify (a) VALUES (2)");
    expect(seen).toEqual([]);
  });

  it("un exec o una transacción que fallan no avisan", async () => {
    const mgr = new WorkspaceManager(new MemoryConfigStore(), new MemoryWorkspaceStorage(), new FakeClock(1_000));
    const seen: string[] = [];
    mgr.onWrite((id) => seen.push(id));
    const created = await mgr.create({ name: "A" });
    if (!created.ok) throw new Error("create");
    const id = created.value.id;
    const first = await mgr.open(id);
    if (!first.ok) throw new Error("open");
    seen.length = 0;
    await expect(first.value.store.exec("INSERT INTO tabla_inexistente VALUES (1)")).rejects.toBeTruthy();
    await expect(first.value.store.transaction(async () => { throw new Error("falla"); })).rejects.toThrow("falla");
    expect(seen).toEqual([]);

    await first.value.store.exec("CREATE TABLE IF NOT EXISTS t3 (a INTEGER)");
    expect(seen).toEqual([id]); // y una escritura correcta posterior sí avisa
  });
});
