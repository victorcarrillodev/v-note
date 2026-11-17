// Spec 006 (T-085, RF-2.5, CL-9, RNF-5): el tema es del dispositivo; un respaldo no lo contiene y restaurarlo no cambia el del dispositivo.
import { describe, it, expect, beforeEach } from "vitest";
import { MemoryAssetStore, migrate, migrations, serializeWorkspace, restoreFromFiles, PageService, FakeClock } from "@vnote/core";
import { createNodeSqliteStore } from "../../../core/tests/support/nodeSqliteStore";
import { para, updateFor } from "../../../core/tests/support/builders";
import { PALETTE_IDS } from "../design/themes";
import { applyTheme } from "../theme/applyTheme";
import { LocalStoragePreferences } from "../theme/theme";

const fresh = async () => { const store = await createNodeSqliteStore(":memory:"); await migrate(store, migrations); return { store, assets: new MemoryAssetStore() }; };
beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute("data-palette"); });

describe("el tema no viaja en el respaldo", () => {
  it("el respaldo no contiene la preferencia ni los nombres de los temas, y restaurar no cambia el tema del dispositivo", async () => {
    const prefs = new LocalStoragePreferences();
    prefs.set("theme", "ambar");
    applyTheme(document.documentElement, prefs.get("theme"), false);

    const source = await fresh();
    const svc = new PageService(source.store, new FakeClock(1_000));
    const created = await svc.create({ title: "Proyectos" });
    if (!created.ok) throw new Error("x");
    await svc.saveUpdate(created.value.id, updateFor([para("plan general")]));
    const out = await serializeWorkspace(source, { id: "w", name: "Personal" });
    const all = [...out.files.values()].map((b) => new TextDecoder().decode(b)).join("\n");
    expect(all).not.toMatch(/vnote:theme|data-palette/);
    for (const id of PALETTE_IDS) expect(all, id).not.toContain(`"${id}"`);
    expect(all).not.toMatch(/"theme"/);

    const target = await fresh();
    const r = await restoreFromFiles(out.files, target);
    expect(r.ok).toBe(true);
    expect(prefs.get("theme")).toBe("ambar");
    expect(document.documentElement.getAttribute("data-palette")).toBe("ambar");
  });
});
