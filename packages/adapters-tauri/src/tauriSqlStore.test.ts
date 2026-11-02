// T-094 (prueba primero): adaptador SqlStore de Tauri. Se prueba con un `invoke` simulado; el contrato real se ejecuta en la app (T-095).
import { describe, it, expect } from "vitest";
import { TauriSqlStore, encodeParam, decodeValue, type Invoke } from "./tauriSqlStore";

type Call = { cmd: string; args: Record<string, unknown> };
function fake(handler: (c: Call) => unknown = () => null) {
  const calls: Call[] = [];
  const invoke: Invoke = async (cmd, args = {}) => {
    calls.push({ cmd, args: args as Record<string, unknown> });
    return handler({ cmd, args: args as Record<string, unknown> });
  };
  return { calls, invoke };
}

describe("codificación de valores", () => {
  it("convierte binarios, nulos y números al formato del puente", () => {
    expect(encodeParam(new Uint8Array([1, 2, 3]))).toEqual({ $blob: "AQID" });
    expect(encodeParam(null)).toBeNull();
    expect(encodeParam(7)).toBe(7);
    expect(encodeParam("ñ")).toBe("ñ");
    expect(encodeParam(5n)).toBe(5);
  });
  it("rechaza enteros enormes que perderían precisión", () => {
    expect(() => encodeParam(2n ** 60n)).toThrow(/precisi/i);
  });
  it("decodifica binarios de vuelta a Uint8Array", () => {
    expect(decodeValue({ $blob: "AQID" })).toEqual(new Uint8Array([1, 2, 3]));
    expect(decodeValue("x")).toBe("x");
    expect(decodeValue(null)).toBeNull();
  });
});

describe("TauriSqlStore", () => {
  it("open pide un handle al lado nativo y lo usa en las consultas", async () => {
    const { calls, invoke } = fake(({ cmd }) => (cmd === "db_open" ? 7 : cmd === "db_query" ? [{ a: 1, b: { $blob: "AQID" } }] : null));
    const s = await TauriSqlStore.open(invoke, "/datos/espacio.db");
    const rows = await s.query("SELECT a, b FROM t WHERE x = ?", ["z"]);
    expect(calls[0]).toEqual({ cmd: "db_open", args: { path: "/datos/espacio.db" } });
    expect(calls[1]).toEqual({ cmd: "db_query", args: { handle: 7, sql: "SELECT a, b FROM t WHERE x = ?", params: ["z"] } });
    expect(rows).toEqual([{ a: 1, b: new Uint8Array([1, 2, 3]) }]);
  });
  it("exec envía los parámetros codificados", async () => {
    const { calls, invoke } = fake(({ cmd }) => (cmd === "db_open" ? 1 : null));
    const s = await TauriSqlStore.open(invoke, ":memory:");
    await s.exec("INSERT INTO t VALUES (?, ?)", [new Uint8Array([9]), null]);
    expect(calls.at(-1)).toEqual({ cmd: "db_exec", args: { handle: 1, sql: "INSERT INTO t VALUES (?, ?)", params: [{ $blob: "CQ==" }, null] } });
  });
  it("transaction hace begin, la función y commit; devuelve el valor", async () => {
    const { calls, invoke } = fake(({ cmd }) => (cmd === "db_open" ? 1 : null));
    const s = await TauriSqlStore.open(invoke, ":memory:");
    const r = await s.transaction(async (tx) => { await tx.exec("INSERT INTO t VALUES (1)"); return "listo"; });
    expect(r).toBe("listo");
    expect(calls.slice(1).map((c) => c.cmd)).toEqual(["db_begin", "db_exec", "db_commit"]);
  });
  it("si la función falla hace rollback y relanza el error original", async () => {
    const { calls, invoke } = fake(({ cmd }) => (cmd === "db_open" ? 1 : null));
    const s = await TauriSqlStore.open(invoke, ":memory:");
    await expect(s.transaction(async () => { throw new Error("falla"); })).rejects.toThrow("falla");
    expect(calls.slice(1).map((c) => c.cmd)).toEqual(["db_begin", "db_rollback"]);
  });
  it("si el commit falla, intenta rollback y propaga el error", async () => {
    const { calls, invoke } = fake(({ cmd }) => { if (cmd === "db_open") return 1; if (cmd === "db_commit") throw new Error("disco lleno"); return null; });
    const s = await TauriSqlStore.open(invoke, ":memory:");
    await expect(s.transaction(async (tx) => { await tx.exec("x"); })).rejects.toThrow("disco lleno");
    expect(calls.map((c) => c.cmd).slice(-2)).toEqual(["db_commit", "db_rollback"]);
  });
  it("las sentencias fuera de una transacción esperan a que termine la que está en curso", async () => {
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { invoke } = fake(({ cmd, args }) => { if (cmd === "db_open") return 1; order.push(`${cmd}:${String(args.sql ?? "")}`); return null; });
    const s = await TauriSqlStore.open(invoke, ":memory:");
    const tx = s.transaction(async (t) => { await t.exec("dentro"); await gate; await t.exec("dentro2"); });
    
    await new Promise((r) => setTimeout(r, 5));
    const outside = s.exec("fuera");
    await new Promise((r) => setTimeout(r, 5));
    expect(order).not.toContain("db_exec:fuera"); // aún bloqueada
    release();
    await tx; await outside;
    expect(order).toEqual(["db_begin:", "db_exec:dentro", "db_exec:dentro2", "db_commit:", "db_exec:fuera"]);
  });
  it("close cierra el handle", async () => {
    const { calls, invoke } = fake(({ cmd }) => (cmd === "db_open" ? 3 : null));
    const s = await TauriSqlStore.open(invoke, ":memory:");
    await s.close();
    expect(calls.at(-1)).toEqual({ cmd: "db_close", args: { handle: 3 } });
  });
});
