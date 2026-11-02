import type { Block } from "../blocks/types";

/** Archivo leído de una carpeta o ZIP; la ruta es relativa a la raíz, con `/` como separador. */
export type SourceFile = { path: string; data: Uint8Array };
export type ImportKind = "markdown" | "obsidian" | "notion";

export type ReportItem = { path: string; message: string };
/** Resultado de una importación (RF-23, CL-27): qué entró, qué se aproximó, qué se omitió y qué enlaces quedaron rotos. */
export type ImportReport = { source: ImportKind; imported: ReportItem[]; approximated: ReportItem[]; omitted: ReportItem[]; brokenLinks: ReportItem[] };

export type PlanDatabase = {
  columns: { name: string; type: "text" | "number" | "checkbox" | "date" }[];
  /** `title` es el valor de la primera columna; `values` va por nombre de columna. */
  rows: { title: string; values: Record<string, string>; blocks: Block[]; /** Id reservado (para que los enlaces a la página de la fila funcionen). */ pageId?: string }[];
};
export type PlanPage = { id: string; title: string; blocks: Block[]; children: PlanPage[]; database?: PlanDatabase };
export type ImportPlan = { root: PlanPage; assets: Map<string, Uint8Array>; report: ImportReport; pageCount: number };
