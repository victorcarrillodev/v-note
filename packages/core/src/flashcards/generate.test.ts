// study-features-2 T-4 (prueba primero): tarjetas sugeridas a partir del texto de las notas.
import { describe, it, expect } from "vitest";
import type { Block, Inline } from "../blocks/types";
import { draftsFromBlocks, withoutExisting } from "./generate";

const t = (text: string, styles: Record<string, true | string> = {}): Inline => ({ type: "text", text, styles });
const b = (type: string, content: Inline[] | undefined, children: Block[] = [], props: Record<string, unknown> = {}): Block => ({ id: Math.random().toString(36).slice(2), type, props, content, children });
const p = (text: string, children: Block[] = []) => b("paragraph", [t(text)], children);

describe("tarjetas sugeridas", () => {
  it("un toggle con contenido: el título es la pregunta y lo de dentro la respuesta", () => {
    const d = draftsFromBlocks([b("toggleListItem", [t("¿Qué es una pila?")], [p("Estructura LIFO."), p("Se opera por un extremo.")])]);
    expect(d).toEqual([{ front: "¿Qué es una pila?", back: "Estructura LIFO.\nSe opera por un extremo." }]);
  });
  it("un toggle sin hijos no genera tarjeta", () => {
    expect(draftsFromBlocks([b("toggleListItem", [t("Solo título")])])).toEqual([]);
  });
  it("«Término :: definición» (también en listas)", () => {
    const d = draftsFromBlocks([p("Cola :: estructura FIFO"), b("bulletListItem", [t("Pila :: estructura LIFO")])]);
    expect(d).toEqual([{ front: "Cola", back: "estructura FIFO" }, { front: "Pila", back: "estructura LIFO" }]);
  });
  it("«**Término**: definición» con el término en negrita", () => {
    const d = draftsFromBlocks([b("paragraph", [t("Heap", { bold: true }), t(": árbol casi completo con la propiedad de montículo")])]);
    expect(d).toEqual([{ front: "Heap", back: "árbol casi completo con la propiedad de montículo" }]);
  });
  it("una frase normal con dos puntos NO genera tarjeta", () => {
    expect(draftsFromBlocks([p("Nota: mañana hay clase"), p("Ver https://a.b/c: es útil")])).toEqual([]);
  });
  it("una pregunta seguida de un párrafo toma el párrafo como respuesta, y ese párrafo no se reutiliza", () => {
    const d = draftsFromBlocks([p("¿Qué es un grafo?"), p("Un conjunto de nodos y aristas."), p("Texto suelto")]);
    expect(d).toEqual([{ front: "¿Qué es un grafo?", back: "Un conjunto de nodos y aristas." }]);
  });
  it("una pregunta al final, sin respuesta, no genera tarjeta", () => {
    expect(draftsFromBlocks([p("¿Y esto?")])).toEqual([]);
  });
  it("busca también dentro de bloques anidados y respeta el orden del documento", () => {
    const d = draftsFromBlocks([b("bulletListItem", [t("Tema")], [p("A :: uno"), p("B :: dos")])]);
    expect(d.map((x) => x.front)).toEqual(["A", "B"]);
  });
  it("las tarjetas que ya existen en la página no se duplican", () => {
    const drafts = [{ front: "Pila", back: "LIFO" }, { front: "Cola", back: "FIFO" }];
    expect(withoutExisting(drafts, ["  pila "])).toEqual([{ front: "Cola", back: "FIFO" }]);
  });
  it("ignora bloques que ya son tarjetas y bloques sin texto", () => {
    expect(draftsFromBlocks([b("flashcard", undefined, [], { front: "X :: Y", back: "" }), b("divider", undefined)])).toEqual([]);
  });
});
