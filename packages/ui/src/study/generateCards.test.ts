// study-features-2 T-4 (prueba primero): del documento del editor a las tarjetas nuevas que hay que insertar.
import { describe, it, expect } from "vitest";
import { cardsToInsert } from "./generateCards";

const text = (t: string, styles: Record<string, unknown> = {}) => ({ type: "text", text: t, styles });
const block = (type: string, content: unknown, children: unknown[] = [], props: Record<string, unknown> = {}) => ({ id: type + Math.random(), type, props, content, children });

describe("tarjetas a insertar desde el editor", () => {
  it("convierte los bloques del editor (texto con estilos, menciones, ecuaciones en línea y enlaces)", () => {
    const doc = [
      block("paragraph", [text("Heap", { bold: true }), text(": árbol de "), { type: "math", props: { formula: "n" } }, text(" nodos")]),
      block("paragraph", [{ type: "link", href: "https://a.b", content: [text("Pila")] }, text(" :: LIFO con "), { type: "mention", props: { pageId: "p", title: "Stack" } }]),
    ];
    expect(cardsToInsert(doc as never, doc as never)).toEqual([
      { type: "flashcard", props: { front: "Heap", back: "árbol de n nodos" } },
      { type: "flashcard", props: { front: "Pila", back: "LIFO con Stack" } },
    ]);
  });

  it("solo mira la selección, pero no duplica tarjetas que ya existen en todo el documento", () => {
    const a = block("paragraph", [text("A :: uno")]);
    const b = block("paragraph", [text("B :: dos")]);
    const existing = block("flashcard", undefined, [], { front: "A", back: "x" });
    expect(cardsToInsert([a, b] as never, [a, b, existing] as never)).toEqual([{ type: "flashcard", props: { front: "B", back: "dos" } }]);
  });

  it("sin patrones reconocibles no devuelve nada", () => {
    expect(cardsToInsert([block("paragraph", [text("Hola mundo")])] as never, [] as never)).toEqual([]);
  });
});
