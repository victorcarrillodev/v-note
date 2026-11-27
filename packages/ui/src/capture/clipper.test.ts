// backlog-b7-b11 T-5 (prueba primero): recortador web por marcador y portapapeles.
import { describe, it, expect } from "vitest";
import { clipMarkdown, bookmarkletCode } from "./clipper";

describe("recortador web", () => {
  it("arma título, enlace y selección citada línea por línea", () => {
    expect(clipMarkdown({ title: " Árboles AVL ", url: "https://ejemplo.mx/avl", selection: "Son balanceados.\n\nRotan." }))
      .toBe("Árboles AVL\nhttps://ejemplo.mx/avl\n> Son balanceados.\n> Rotan.");
  });
  it("sin título usa la dirección y sin selección solo deja el enlace", () => {
    expect(clipMarkdown({ title: "", url: "https://a.mx", selection: "" })).toBe("https://a.mx\nhttps://a.mx");
  });
  it("el marcador es javascript:, copia al portapapeles y produce el mismo texto que clipMarkdown", async () => {
    const code = bookmarkletCode("Copiado");
    expect(code.startsWith("javascript:")).toBe(true);
    let copied = "";
    const run = new Function("document", "location", "navigator", "window", "alert", "prompt", decodeURIComponent(code.slice("javascript:".length)));
    run({ title: "T" }, { href: "https://a.mx" }, { clipboard: { writeText: async (s: string) => { copied = s; } } }, { getSelection: () => "uno\n\ndos" }, () => {}, () => null);
    expect(copied).toBe(clipMarkdown({ title: "T", url: "https://a.mx", selection: "uno\n\ndos" }));
  });
});
