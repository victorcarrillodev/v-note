// T-040, T-041, T-042 (prueba primero): ejecutor de migraciones versionadas (constitución, art. 5).
import { describe, it, expect, vi } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { migrate, type Migration } from "./migrate";

const sample: Migration[] = [
  { version: 1, name: "crea a", up: async (tx) => tx.exec("CREATE TABLE a(id INTEGER)") },
  { version: 2, name: "crea b", up: async (tx) => tx.exec("CREATE TABLE b(id INTEGER)") },
  { version: 3, name: "crea c", up: async (tx) => tx.exec("CREATE TABLE c(id INTEGER)") },
];
const version = async (db: Awaited<ReturnType<typeof createNodeSqliteStore>>) =>
  ((await db.query<{ user_version: number }>("PRAGMA user_version"))[0] as { user_version: number }).user_version;
const tables = async (db: Awaited<ReturnType<typeof createNodeSqliteStore>>) =>
  (await db.query<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).map((r) => r.name);

describe("migrate", () => {
  it("aplica las migraciones en orden y es idempotente", async () => {
    const db = await createNodeSqliteStore(":memory:");
    const r1 = await migrate(db, sample);
    expect(r1).toEqual({ ok: true, value: { from: 0, to: 3, applied: [1, 2, 3] } });
    expect(await version(db)).toBe(3);
    expect(await tables(db)).toEqual(["a", "b", "c"]);
    const r2 = await migrate(db, sample);
    expect(r2).toEqual({ ok: true, value: { from: 3, to: 3, applied: [] } });
  });

  it("aplica solo las pendientes cuando la base ya estaba en una versión intermedia", async () => {
    const db = await createNodeSqliteStore(":memory:");
    await migrate(db, sample.slice(0, 1));
    const r = await migrate(db, sample);
    expect(r).toEqual({ ok: true, value: { from: 1, to: 3, applied: [2, 3] } });
  });

  it("ordena las migraciones aunque se declaren desordenadas", async () => {
    const db = await createNodeSqliteStore(":memory:");
    const r = await migrate(db, [sample[2]!, sample[0]!, sample[1]!]);
    expect(r).toEqual({ ok: true, value: { from: 0, to: 3, applied: [1, 2, 3] } });
  });

  it("rechaza versiones repetidas o con huecos sin tocar la base", async () => {
    const db = await createNodeSqliteStore(":memory:");
    const dup = await migrate(db, [sample[0]!, { ...sample[1]!, version: 1 }]);
    const gap = await migrate(db, [sample[0]!, sample[2]!]);
    expect(dup.ok === false && dup.error.code).toBe("INVALID");
    expect(gap.ok === false && gap.error.code).toBe("INVALID");
    expect(await version(db)).toBe(0);
  });

  it("T-041: una migración que falla se revierte, deja la versión anterior y se hizo copia previa una sola vez", async () => {
    const db = await createNodeSqliteStore(":memory:");
    const backup = vi.fn(async () => {});
    const broken: Migration[] = [
      sample[0]!,
      { version: 2, name: "falla", up: async (tx) => { await tx.exec("CREATE TABLE b(id INTEGER)"); await tx.exec("SENTENCIA INVALIDA"); } },
      sample[2]!,
    ];
    const r = await migrate(db, broken, { beforeMigrate: backup });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error.code).toBe("STORAGE");
    expect(r.ok === false && r.error.details).toMatchObject({ version: 2 });
    expect(await version(db)).toBe(1); // la 1 quedó aplicada y confirmada; la 2 se revirtió
    expect(await tables(db)).toEqual(["a"]); // b no quedó a medias
    expect(backup).toHaveBeenCalledTimes(1);
    expect(backup).toHaveBeenCalledWith({ from: 0, to: 3 });
  });

  it("no hace copia previa si no hay nada pendiente", async () => {
    const db = await createNodeSqliteStore(":memory:");
    await migrate(db, sample);
    const backup = vi.fn(async () => {});
    await migrate(db, sample, { beforeMigrate: backup });
    expect(backup).not.toHaveBeenCalled();
  });

  it("si la copia previa falla, no se migra nada", async () => {
    const db = await createNodeSqliteStore(":memory:");
    const r = await migrate(db, sample, { beforeMigrate: async () => { throw new Error("disco lleno"); } });
    expect(r.ok === false && r.error.code).toBe("STORAGE");
    expect(await version(db)).toBe(0);
  });

  it("T-042: rechaza una base con esquema más nuevo que el soportado sin modificarla ni hacer copia", async () => {
    const db = await createNodeSqliteStore(":memory:");
    await db.exec("PRAGMA user_version = 9");
    const backup = vi.fn(async () => {});
    const r = await migrate(db, sample, { beforeMigrate: backup });
    expect(r.ok === false && r.error.code).toBe("UNSUPPORTED_VERSION");
    expect(r.ok === false && r.error.details).toEqual({ found: 9, supported: 3 });
    expect(await version(db)).toBe(9);
    expect(backup).not.toHaveBeenCalled();
  });
});
