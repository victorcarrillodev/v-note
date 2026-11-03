// U-002 (spec 002, plan 16.2): el lector de respaldo v1 tolera campos adicionales en una página, de modo que añadir un campo opcional
// (como el ancho completo) no obliga a subir la versión del formato.
import { describe, it, expect } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { para, updateFor } from "../../tests/support/builders";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { FakeClock } from "../clock";
import { MemoryAssetStore } from "../assets/memoryAssetStore";
import { PageService } from "../pages/pageService";
import { serializeWorkspace } from "./serialize";
import { validateBackup } from "./restore";

describe("tolerancia del lector del formato v1 a campos adicionales", () => {
  it("una página con un campo extra se valida y el campo se ignora", async () => {
    const db = await createNodeSqliteStore(":memory:");
    await migrate(db, migrations);
    const svc = new PageService(db, new FakeClock(1_000));
    const p = await svc.create({ title: "Con extra" });
    if (!p.ok) throw new Error("x");
    await svc.saveUpdate(p.value.id, updateFor([para("hola")]));
    const out = await serializeWorkspace({ store: db, assets: new MemoryAssetStore() }, { id: "ws", name: "Personal" });
    const files = new Map(out.files);
    const path = `data/${p.value.id}.json`;
    const json = JSON.parse(new TextDecoder().decode(files.get(path)!));
    json.fullWidth = true;
    json.campoFuturo = { a: 1 };
    files.set(path, new TextEncoder().encode(JSON.stringify(json)));
    const v = await validateBackup(files);
    expect(v.ok).toBe(true);
    expect(v.ok && v.value.pages.find((x) => x.id === p.value.id)?.title).toBe("Con extra");
  });
});
