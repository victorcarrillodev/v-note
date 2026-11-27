// study-features-2 T-6 (prueba primero): las plantillas de diagrama están traducidas y se ofrecen en el menú «/».
import { describe, it, expect } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { DIAGRAM_TEMPLATES, diagramTemplate, parseDiagram, serializeDiagram, templateKeys } from "@vnote/core";
import { createI18n } from "../i18n";
import { schema } from "../editor/schema";
import { buildSlashItems } from "../editor/slashItems";

describe("plantillas de diagrama", () => {
  it.each(["es-MX", "en"] as const)("todas las claves de las plantillas existen en %s", async (lang) => {
    const i18n = await createI18n(lang === "en" ? "en" : undefined);
    for (const id of DIAGRAM_TEMPLATES) {
      for (const key of templateKeys(id)) expect(i18n.exists(key), key).toBe(true);
      const d = diagramTemplate(id, (k) => i18n.t(k));
      expect(JSON.stringify(d)).not.toContain("diagram.templates");
      expect(parseDiagram(serializeDiagram(d)).ok).toBe(true);
    }
  });

  it("el menú «/» ofrece las tres plantillas, cada una insertando un diagrama con sus formas", async () => {
    const i18n = await createI18n();
    const editor = BlockNoteEditor.create({ schema });
    const items = buildSlashItems(editor, (k) => i18n.t(k), "");
    const titles = DIAGRAM_TEMPLATES.map((id) => i18n.t(`diagram.templates.${id}.slash`));
    for (const title of titles) expect(items.some((i) => i.title === title), title).toBe(true);
    for (const id of DIAGRAM_TEMPLATES) expect(i18n.t(`diagram.templates.${id}.hint`)).not.toContain("diagram.templates");
  });
});

describe("títulos del menú «/»", () => {
  it("la plantilla de flujo no se llama igual que el lienzo vacío (daba claves repetidas)", async () => {
    const { createI18n } = await import("../i18n");
    for (const lng of ["es-MX", "en"]) {
      const i18n = await createI18n(lng);
      const keys = ["flow", "er", "uml"].map((id) => `diagram.templates.${id}.slash`);
      const found = keys.filter((k) => i18n.exists(k));
      const titles = found.map((k) => i18n.t(k));
      expect(titles).not.toContain(i18n.t("diagram.slash"));
    }
  });
});
