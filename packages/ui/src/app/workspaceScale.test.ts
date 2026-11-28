// B-13: tiempos con miles de páginas en lo que se usa a diario. Los topes son holgados: detectan saltos de orden de magnitud.
import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { AssetTextService, FakeClock, MemoryAssetStore, migrate, migrations, serializeWorkspace, TagService, toYjs, gcAssets } from "@vnote/core";
import { createNodeSqliteStore } from "../../../core/tests/support/nodeSqliteStore";
import { WorkspaceController } from "../workspace/controller";

const N = 5_000;

describe("espacio grande", () => {
  it("árbol, búsqueda, etiquetas, retroenlaces, PDF pendientes, limpieza y respaldo", async () => {
    const store = await createNodeSqliteStore(":memory:");
    await migrate(store, migrations);
    const clock = new FakeClock(1_000);
    const doc = new Y.Doc();
    toYjs([{ id: "b", type: "paragraph", props: {}, content: [{ type: "text", text: "apuntes de redes y árboles", styles: {} }], children: [] }], doc.getXmlFragment("doc"));
    const update = Y.encodeStateAsUpdate(doc);
    const tag = await new TagService(store, clock).create({ name: "Examen", color: "red" });
    if (!tag.ok) throw new Error("tag");
    await store.transaction(async (tx) => {
      for (let i = 0; i < N; i++) {
        const id = `p${String(i).padStart(5, "0")}`;
        await tx.exec("INSERT INTO pages(id, parent_id, position, title, kind, created_at, updated_at) VALUES (?, NULL, ?, ?, 'note', 1, 1)", [id, String(i).padStart(6, "0"), `Página ${i}`]);
        await tx.exec("INSERT INTO page_docs(page_id, seq, kind, data, created_at) VALUES (?, 0, 'snapshot', ?, 1)", [id, update]);
        await tx.exec("INSERT INTO page_text(page_id, title, body) VALUES (?, ?, ?)", [id, `Página ${i}`, "apuntes de redes y árboles"]);
        await tx.exec("INSERT INTO page_tags(page_id, tag_id) VALUES (?, ?)", [id, tag.value.id]);
      }
    });
    const controller = new WorkspaceController(store, clock);
    const assets = new MemoryAssetStore();
    const times: Record<string, number> = {};
    const time = async (name: string, f: () => Promise<unknown>) => { const t = performance.now(); await f(); times[name] = Math.round(performance.now() - t); };
    await time("abrir", () => controller.refresh());
    await time("buscar", () => controller.search({ query: "redes" }));
    await time("etiqueta", () => controller.search({ query: "", tagIds: [tag.value.id] }));
    await time("retroenlaces", () => controller.backlinks("p00001"));
    await time("pdfPendientes", () => new AssetTextService(store, clock).pending());
    await time("limpieza", () => gcAssets({ store, assets }));
    await time("respaldo", () => serializeWorkspace({ store, assets }, { id: "w", name: "W" }));
    console.log("TIEMPOS", JSON.stringify(times));
    for (const [name, max] of [["abrir", 3_000], ["buscar", 1_000], ["etiqueta", 1_000], ["retroenlaces", 200], ["pdfPendientes", 500], ["limpieza", 20_000], ["respaldo", 30_000]] as const) expect(times[name], name).toBeLessThan(max);
  }, 120_000);
});
