// T-096 y T-097 (prueba primero): el adaptador web cumple la MISMA suite de contrato que el nativo.
// En Node se usa SQLite WASM en memoria con un "worker" de bucle local; la persistencia en OPFS se valida en el navegador (spike T-013 y e2e web).
import { describe, it, expect } from "vitest";
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { runSqlStoreContract } from "@vnote/core/src/ports/sqlStore.contract";
import { WasmSqlStore, createWorkerHost, type WorkerLike } from "./wasmSqlStore";

async function loopbackWorker(): Promise<WorkerLike> {
  const sqlite3 = await sqlite3InitModule();
  const host = createWorkerHost(async () => new sqlite3.oo1.DB(":memory:", "c"));
  const worker: WorkerLike = {
    onmessage: null,
    postMessage(msg: unknown) {
      void host(msg as Parameters<typeof host>[0]).then((res) => worker.onmessage?.({ data: res }));
    },
    terminate() {},
  };
  return worker;
}

runSqlStoreContract("SQLite WASM (worker de bucle local)", async () => WasmSqlStore.open(await loopbackWorker(), ":memory:"));

describe("WasmSqlStore (T-096)", () => {
  it("una consulta de prueba funciona y los binarios viajan como Uint8Array", async () => {
    const s = await WasmSqlStore.open(await loopbackWorker(), ":memory:");
    await s.exec("CREATE TABLE t(b BLOB, n INTEGER, s TEXT)");
    await s.exec("INSERT INTO t VALUES (?, ?, ?)", [new Uint8Array([1, 2, 3]), 5, "ñ"]);
    const rows = await s.query<{ b: Uint8Array; n: number; s: string }>("SELECT * FROM t");
    expect(rows[0]!.n).toBe(5);
    expect(rows[0]!.s).toBe("ñ");
    expect([...(rows[0]!.b as Uint8Array)]).toEqual([1, 2, 3]);
    await s.close();
  });
  it("un error del lado del worker se propaga como excepción", async () => {
    const s = await WasmSqlStore.open(await loopbackWorker(), ":memory:");
    await expect(s.exec("SENTENCIA INVALIDA")).rejects.toThrow();
  });
  it("responde a cada petición con su propio identificador aunque lleguen varias a la vez", async () => {
    const s = await WasmSqlStore.open(await loopbackWorker(), ":memory:");
    await s.exec("CREATE TABLE t(v INTEGER)");
    await Promise.all(Array.from({ length: 20 }, (_, i) => s.exec("INSERT INTO t VALUES (?)", [i])));
    expect((await s.query<{ n: number }>("SELECT count(*) AS n FROM t"))[0]!.n).toBe(20);
  });
});
