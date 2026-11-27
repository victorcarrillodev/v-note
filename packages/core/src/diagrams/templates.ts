import { addEdge, addNode, emptyDiagram, resizeNode, type Diagram, type Shape } from "./diagram";
import type { Anchor } from "./anchors";

export const DIAGRAM_TEMPLATES = ["flow", "er", "uml"] as const;
export type DiagramTemplateId = (typeof DIAGRAM_TEMPLATES)[number];

/** Textos de cada plantilla (claves de traducción relativas a `diagram.templates.<id>.`). */
const TEXT_KEYS: Record<DiagramTemplateId, readonly string[]> = {
  flow: ["start", "step", "decision", "yes", "no", "doYes", "doNo", "end"],
  er: ["user", "userFields", "order", "orderFields", "product", "productFields", "places", "contains"],
  uml: ["animal", "animalBody", "dog", "dogBody", "owner", "ownerBody", "inherits", "has"],
};
/** Claves completas que usa la plantilla: la interfaz las traduce al español y al inglés. */
export const templateKeys = (id: DiagramTemplateId): string[] => TEXT_KEYS[id].map((k) => `diagram.templates.${id}.${k}`);

type Builder = { d: Diagram; ids: Record<string, string> };
const put = (b: Builder, key: string, shape: Shape, x: number, y: number, text: string, size?: { w: number; h: number }): void => {
  const added = addNode(b.d, { shape, x, y, text });
  b.d = added.diagram;
  if (size) b.d = resizeNode(b.d, added.node.id, size.w, size.h);
  b.ids[key] = added.node.id;
};
const link = (b: Builder, from: string, to: string, fromAnchor: Anchor, toAnchor: Anchor, label = ""): void => {
  const r = addEdge(b.d, b.ids[from]!, b.ids[to]!, { fromAnchor, toAnchor, route: "orthogonal" });
  if (!r.ok) throw new Error(`plantilla de diagrama inválida: ${from} → ${to}`);
  b.d = { ...r.value.diagram, edges: r.value.diagram.edges.map((e) => (e.id === r.value.edge.id ? { ...e, label } : e)) };
};

/** Diagrama de partida con formas y conectores ya unidos; `t` traduce los textos (clave → texto). */
export function diagramTemplate(id: DiagramTemplateId, t: (key: string) => string): Diagram {
  const b: Builder = { d: emptyDiagram(), ids: {} };
  const tx = (k: string) => t(`diagram.templates.${id}.${k}`);
  /** Cuerpo de una clase UML: cada línea traducida lleva la visibilidad pública (+). */
  const members = (k: string) => tx(k).split("\n").map((l) => `+ ${l}`).join("\n");
  if (id === "flow") {
    put(b, "start", "terminator", 200, 0, tx("start"));
    put(b, "step", "process", 200, 90, tx("step"));
    put(b, "decision", "decision", 200, 190, tx("decision"));
    put(b, "yes", "process", 200, 320, tx("doYes"));
    put(b, "no", "process", 420, 200, tx("doNo"));
    put(b, "end", "terminator", 200, 430, tx("end"));
    link(b, "start", "step", "s", "n");
    link(b, "step", "decision", "s", "n");
    link(b, "decision", "yes", "s", "n", tx("yes"));
    link(b, "decision", "no", "e", "w", tx("no"));
    link(b, "yes", "end", "s", "n");
    link(b, "no", "end", "s", "e");
  } else if (id === "er") {
    const box = { w: 180, h: 110 };
    put(b, "user", "process", 0, 0, `${tx("user")}\n${tx("userFields")}`, box);
    put(b, "order", "process", 300, 0, `${tx("order")}\n${tx("orderFields")}`, box);
    put(b, "product", "process", 600, 0, `${tx("product")}\n${tx("productFields")}`, box);
    link(b, "user", "order", "e", "w", `1:N ${tx("places")}`);
    link(b, "order", "product", "e", "w", `N:M ${tx("contains")}`);
  } else {
    const box = { w: 200, h: 130 };
    put(b, "animal", "process", 150, 0, `${tx("animal")}\n${members("animalBody")}`, box);
    put(b, "dog", "process", 150, 220, `${tx("dog")}\n${members("dogBody")}`, box);
    put(b, "owner", "process", 480, 220, `${tx("owner")}\n${members("ownerBody")}`, box);
    link(b, "dog", "animal", "n", "s", tx("inherits"));
    link(b, "owner", "dog", "w", "e", tx("has"));
  }
  return b.d;
}

