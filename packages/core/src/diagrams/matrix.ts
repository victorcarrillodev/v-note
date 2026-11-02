import { appError, err, ok, type Result } from "../result";
import { newId } from "../ids";
import { stableJson } from "../backup/stableJson";

export type MLine = { id: string; title: string };
export type MItem = { id: string; text: string; row: string; col: string };
export type Matrix = { rows: MLine[]; cols: MLine[]; items: MItem[] };

export const emptyMatrix = (): Matrix => ({ rows: [{ id: newId(), title: "" }], cols: [{ id: newId(), title: "" }], items: [] });
/** Plantilla 2×2 clásica (importante/urgente). */
export const template2x2 = (): Matrix => ({
  rows: [{ id: newId(), title: "Importante" }, { id: newId(), title: "No importante" }],
  cols: [{ id: newId(), title: "Urgente" }, { id: newId(), title: "No urgente" }],
  items: [],
});

const notFound = (what: string, id: string) => err(appError("NOT_FOUND", `${what} no existe`, { id }));
export const addRow = (m: Matrix, title: string, id?: string): Result<Matrix> => ok({ ...m, rows: [...m.rows, { id: id ?? newId(), title }] });
export const addCol = (m: Matrix, title: string, id?: string): Result<Matrix> => ok({ ...m, cols: [...m.cols, { id: id ?? newId(), title }] });
export const renameRow = (m: Matrix, id: string, title: string): Matrix => ({ ...m, rows: m.rows.map((r) => (r.id === id ? { ...r, title } : r)) });
export const renameCol = (m: Matrix, id: string, title: string): Matrix => ({ ...m, cols: m.cols.map((c) => (c.id === id ? { ...c, title } : c)) });

export function deleteRow(m: Matrix, id: string): Result<{ matrix: Matrix; removedItems: number }> {
  if (!m.rows.some((r) => r.id === id)) return notFound("La fila", id);
  if (m.rows.length <= 1) return err(appError("INVALID", "Una matriz necesita al menos una fila", { reason: "LAST" }));
  const items = m.items.filter((i) => i.row !== id);
  return ok({ matrix: { ...m, rows: m.rows.filter((r) => r.id !== id), items }, removedItems: m.items.length - items.length });
}
export function deleteCol(m: Matrix, id: string): Result<{ matrix: Matrix; removedItems: number }> {
  if (!m.cols.some((c) => c.id === id)) return notFound("La columna", id);
  if (m.cols.length <= 1) return err(appError("INVALID", "Una matriz necesita al menos una columna", { reason: "LAST" }));
  const items = m.items.filter((i) => i.col !== id);
  return ok({ matrix: { ...m, cols: m.cols.filter((c) => c.id !== id), items }, removedItems: m.items.length - items.length });
}

export function addItem(m: Matrix, row: string, col: string, text: string, id?: string): Result<{ matrix: Matrix; item: MItem }> {
  if (!m.rows.some((r) => r.id === row)) return notFound("La fila", row);
  if (!m.cols.some((c) => c.id === col)) return notFound("La columna", col);
  const item: MItem = { id: id ?? newId(), text, row, col };
  return ok({ matrix: { ...m, items: [...m.items, item] }, item });
}
export const editItem = (m: Matrix, id: string, text: string): Matrix => ({ ...m, items: m.items.map((i) => (i.id === id ? { ...i, text } : i)) });
export const deleteItem = (m: Matrix, id: string): Matrix => ({ ...m, items: m.items.filter((i) => i.id !== id) });
export function moveItem(m: Matrix, id: string, row: string, col: string): Result<Matrix> {
  if (!m.items.some((i) => i.id === id)) return notFound("El elemento", id);
  if (!m.rows.some((r) => r.id === row)) return notFound("La fila", row);
  if (!m.cols.some((c) => c.id === col)) return notFound("La columna", col);
  return ok({ ...m, items: m.items.map((i) => (i.id === id ? { ...i, row, col } : i)) });
}

export const serializeMatrix = (m: Matrix): string => stableJson(m);
export function parseMatrix(text: string): Result<Matrix> {
  if (text.trim() === "") return ok(emptyMatrix());
  const bad = (msg: string) => err(appError("INVALID", msg, { reason: "MATRIX" }));
  let raw: Partial<Matrix> | null;
  try { raw = JSON.parse(text) as Partial<Matrix> | null; } catch { return bad("La matriz está dañada"); }
  if (!raw || !Array.isArray(raw.rows) || !Array.isArray(raw.cols) || !Array.isArray(raw.items) || raw.rows.length < 1 || raw.cols.length < 1) return bad("La matriz no tiene el formato esperado");
  const lineOk = (l: Partial<MLine>) => !!l && typeof l.id === "string" && typeof l.title === "string";
  if (!raw.rows.every(lineOk) || !raw.cols.every(lineOk)) return bad("Una fila o columna de la matriz es inválida");
  const rows = new Set(raw.rows.map((r) => r.id)), cols = new Set(raw.cols.map((c) => c.id));
  if (rows.size !== raw.rows.length || cols.size !== raw.cols.length) return bad("Hay filas o columnas repetidas");
  for (const i of raw.items as Partial<MItem>[]) if (!i || typeof i.id !== "string" || typeof i.text !== "string" || !rows.has(i.row as string) || !cols.has(i.col as string)) return bad("Un elemento de la matriz es inválido");
  return ok(raw as Matrix);
}
export const matrixText = (m: Matrix): string => [...m.rows.map((r) => r.title), ...m.cols.map((c) => c.title), ...m.items.map((i) => i.text)].filter((t) => t.trim() !== "").join("\n");
