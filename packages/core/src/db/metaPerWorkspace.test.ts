// G-006: cada espacio de trabajo tiene su propia base y su propia tabla `meta` (los estilos predeterminados de diagramas viven ahí, RF-14).
import { describe, it, expect } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { migrate } from "./migrate";
import { migrations } from "./migrations";

const newStore = async () => { const d = await createNodeSqliteStore(":memory:"); await migrate(d, migrations); return d; };
const get = async (s: Awaited<ReturnType<typeof newStore>>, key: string) => (await s.query<{ value: string }>("SELECT value FROM meta WHERE key = ?", [key]))[0]?.value ?? null;

describe("meta por espacio de trabajo", () => {
  it("dos espacios guardan valores distintos para la misma clave y no se ven entre sí", async () => {
    const a = await newStore(), b = await newStore();
    await a.exec("INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)", ["diagram.default.shape", '{"fill":"palette:green"}']);
    await b.exec("INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)", ["diagram.default.shape", '{"fill":"palette:red"}']);
    expect(await get(a, "diagram.default.shape")).toBe('{"fill":"palette:green"}');
    expect(await get(b, "diagram.default.shape")).toBe('{"fill":"palette:red"}');
    await a.exec("DELETE FROM meta WHERE key = ?", ["diagram.default.shape"]);
    expect(await get(a, "diagram.default.shape")).toBeNull();
    expect(await get(b, "diagram.default.shape")).toBe('{"fill":"palette:red"}');
  });
});
