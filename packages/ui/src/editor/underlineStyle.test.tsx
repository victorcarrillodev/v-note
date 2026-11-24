// Subrayado con estilo en el editor: el esquema lo conoce, ida y vuelta por Yjs, el CSS coincide con el del documento exportado y no hay colores sueltos.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as Y from "yjs";
import { UNDERLINE_COLORS, UNDERLINE_EFFECTS_CSS, UNDERLINE_KINDS, toYjs, fromYjs, type Block } from "@vnote/core";
import { schema } from "./schema";
import { underlineColors } from "../design/tokens";

const css = readFileSync(join(__dirname, "underline.css"), "utf8");
const mini = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim().replace(/\s*([{};,:()])\s*/g, "$1");
const rules = mini(css).split("}").filter(Boolean).map((r) => `${r}}`);

describe("esquema", () => {
  it("el estilo `underlineStyle` existe junto a los de siempre (incluido el subrayado simple)", () => {
    expect(Object.keys(schema.styleSchema)).toEqual(expect.arrayContaining(["bold", "italic", "underline", "strike", "code", "textColor", "backgroundColor", "underlineStyle"]));
    expect(schema.styleSchema.underlineStyle).toMatchObject({ type: "underlineStyle", propSchema: "string" });
  });
});

describe("viaja por Yjs sin perderse", () => {
  const b = (styles: Record<string, true | string>): Block => ({ id: "a", type: "paragraph", props: {}, content: [{ type: "text", text: "hola", styles }], children: [] });
  it("cada tipo y color vuelve igual, junto a otros estilos", () => {
    for (const kind of UNDERLINE_KINDS) for (const color of UNDERLINE_COLORS) {
      const styles = { underlineStyle: `${kind}:${color}`, bold: true as const };
      const doc = new Y.Doc();
      toYjs([b(styles)], doc.getXmlFragment("doc"));
      const back = fromYjs(doc.getXmlFragment("doc"));
      expect((back[0]!.content as { styles: unknown }[])[0]!.styles, `${kind}:${color}`).toEqual(styles);
    }
  });
});

describe("CSS del subrayado", () => {
  it("tiene exactamente las reglas de los tres trazos que viajan en el documento exportado", () => {
    const effects = rules.filter((r) => !r.includes("data-ul-color"));
    expect(effects).toEqual([...UNDERLINE_EFFECTS_CSS]);
  });
  it("define un color por cada nombre, con la variable de los tokens", () => {
    for (const c of UNDERLINE_COLORS) expect(rules, c).toContain(`.ul[data-ul-color=${c}]{--ul:var(--underline-${c});}`);
    expect(Object.keys(underlineColors).sort()).toEqual([...UNDERLINE_COLORS].sort());
  });
  it("no contiene colores sueltos", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/rgba?\(/);
  });
});
