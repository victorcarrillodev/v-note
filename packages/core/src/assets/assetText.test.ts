// backlog-b7-b11 T-4 (prueba primero): el texto de los PDF adjuntos entra en la búsqueda.
import { describe, it, expect } from "vitest";
import { pdfHashesIn } from "./assetText";
import type { Block } from "../blocks/types";

const H = "a".repeat(64);
const file = (name: string, url: string, children: Block[] = []): Block => ({ id: name, type: "file", props: { name, url }, content: undefined, children });

describe("PDF adjuntos en los bloques", () => {
  it("toma los archivos .pdf guardados como adjunto, también anidados y sin repetir", () => {
    expect(pdfHashesIn([file("Apuntes.PDF", `asset:${H}`, [file("copia.pdf", `asset:${H}`)])])).toEqual([H]);
  });
  it("ignora otros tipos y direcciones externas", () => {
    expect(pdfHashesIn([file("a.zip", `asset:${H}`), file("b.pdf", "https://a.mx/b.pdf")])).toEqual([]);
  });
});
