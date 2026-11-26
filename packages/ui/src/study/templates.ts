type T = (key: string) => string;
export type TemplateBlock = { type: string; props?: Record<string, unknown>; content?: unknown };
export const TEMPLATE_IDS = ["classNotes", "algorithm", "comparison"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

const run = (text: string, styles: Record<string, unknown> = {}) => ({ type: "text", text, styles });

/** Bloques de cada plantilla de estudio, en el idioma de la interfaz: secciones con guía y contenido de ejemplo para sobrescribir. */
export function templateBlocks(id: TemplateId, t: T): TemplateBlock[] {
  const x = (key: string) => t(`study.templates.${key}`);
  const h = (key: string): TemplateBlock => ({ type: "heading", props: { level: 2 }, content: x(key) });
  const hint = (key: string): TemplateBlock => ({ type: "paragraph", content: [run(x(key), { italic: true, textColor: "gray" })] });
  const intro = (key: string, variant = "info"): TemplateBlock => ({ type: "callout", props: { variant }, content: x(key) });
  const item = (type: string, key: string): TemplateBlock => ({ type, content: x(key) });
  const labeled = (type: string, key: string): TemplateBlock => ({ type, content: [run(`${x(key)}: `, { bold: true })] });
  const row = (cells: string[]) => ({ cells: cells.map((c) => (c ? [run(c)] : [])) });
  const table = (rows: string[][]): TemplateBlock => ({ type: "table", content: { type: "tableContent", headerRows: 1, rows: rows.map(row) } });
  const keys = (...names: string[]) => names.map(x);

  if (id === "classNotes") {
    return [
      intro("classIntro"),
      h("goal"), hint("goalHint"),
      h("keyIdeas"), item("bulletListItem", "idea1"), item("bulletListItem", "idea2"),
      h("concepts"), table([keys("concept", "definition", "example"), ["", "", ""], ["", "", ""]]),
      h("examples"), hint("examplesHint"), { type: "codeBlock", props: { language: "text" } },
      h("doubts"), item("checkListItem", "doubt1"),
      h("summary"), intro("summaryHint", "success"),
      h("selfTest"), hint("selfTestHint"), { type: "flashcard" },
    ];
  }
  if (id === "algorithm") {
    return [
      intro("algorithmIntro"),
      h("problem"), hint("problemHint"),
      table([keys("part", "description"), [x("input"), ""], [x("output"), ""], [x("constraints"), ""]]),
      h("idea"), item("numberedListItem", "step1"), item("numberedListItem", "step2"), item("numberedListItem", "step3"),
      h("diagram"), { type: "mermaid", props: { code: x("flow") } },
      h("code"), { type: "codeBlock", props: { language: "python" }, content: x("skeleton") },
      h("complexity"), table([keys("case", "time", "space"), [x("best"), "O( )", "O( )"], [x("average"), "O( )", "O( )"], [x("worst"), "O( )", "O( )"]]),
      { type: "equation", props: { formula: "T(n) = 2\\,T\\left(\\frac{n}{2}\\right) + O(n) = O(n \\log n)" } },
      hint("recurrenceHint"),
      h("edgeCases"), item("checkListItem", "edge1"), item("checkListItem", "edge2"), item("checkListItem", "edge3"),
      h("selfTest"), { type: "flashcard" },
    ];
  }
  return [
    intro("comparisonIntro"),
    h("structures"),
    table([
      keys("structure", "access", "search", "insert", "delete"),
      [x("array"), "O(1)", "O(n)", "O(n)", "O(n)"],
      [x("linkedList"), "O(n)", "O(n)", "O(1)", "O(1)"],
      [x("stack"), "O(n)", "O(n)", "O(1)", "O(1)"],
      [x("queue"), "O(n)", "O(n)", "O(1)", "O(1)"],
      [x("hashTable"), "—", "O(1)", "O(1)", "O(1)"],
      [x("tree"), "O(log n)", "O(log n)", "O(log n)", "O(log n)"],
    ]),
    hint("complexityNote"),
    h("whenToUse"),
    ...["array", "linkedList", "stack", "queue", "hashTable", "tree"].map((k): TemplateBlock => ({ type: "bulletListItem", content: [run(`${x(k)}: `, { bold: true }), run(x(`${k}Use`))] })),
    h("decision"), labeled("paragraph", "chosen"), labeled("paragraph", "because"),
  ];
}
