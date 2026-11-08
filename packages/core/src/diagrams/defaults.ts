// Estilos predeterminados de los diagramas, por espacio de trabajo (plan 003, §7.6): viven en la tabla `meta` de cada espacio.
import { appError, err, ok, type Result } from "../result";
import type { SqlExecutor, SqlStore } from "../ports/sqlStore";
import { stableJson } from "../backup/stableJson";
import { CAPS, DASHES, EDGE_WIDTHS, NODE_STROKE_WIDTHS, ROUTES, completeEdgeStyle, completeNodeStyle, isColor, isFillColor, type EdgeStyle, type NodeStyle, type Route } from "./style";

export type DiagramDefaults = { shape?: NodeStyle; edge?: { style: EdgeStyle; route: Route } };
const KEY_SHAPE = "diagram.default.shape", KEY_EDGE = "diagram.default.edge";
const bad = (message: string) => err(appError("INVALID", message, { reason: "DIAGRAM_DEFAULTS" }));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const oneOf = (set: readonly unknown[], v: unknown) => set.includes(v);

function nodeProblem(s: Record<string, unknown>): string | null {
  const ok_ = (k: string, f: (v: unknown) => boolean) => (s[k] === undefined || f(s[k]) ? null : `El estilo predeterminado «${k}» de la forma no es válido`);
  return [ok_("fill", isFillColor), ok_("stroke", isColor), ok_("textColor", isColor), ok_("strokeDash", (v) => oneOf(DASHES, v)), ok_("strokeWidth", (v) => oneOf(NODE_STROKE_WIDTHS, v)), ok_("fillOpacity", (v) => typeof v === "number" && v >= 0 && v <= 1)].find((p) => p !== null) ?? null;
}
function edgeProblem(s: Record<string, unknown>): string | null {
  const ok_ = (k: string, f: (v: unknown) => boolean) => (s[k] === undefined || f(s[k]) ? null : `El estilo predeterminado «${k}» del conector no es válido`);
  return [ok_("color", isColor), ok_("textColor", isColor), ok_("dash", (v) => oneOf(DASHES, v)), ok_("width", (v) => oneOf(EDGE_WIDTHS, v)), ok_("startCap", (v) => oneOf(CAPS, v)), ok_("endCap", (v) => oneOf(CAPS, v))].find((p) => p !== null) ?? null;
}

/** Valida y completa un objeto de predeterminados (de la base o de `diagram-defaults.json`). */
export function parseDiagramDefaults(raw: unknown): Result<DiagramDefaults> {
  if (!isObj(raw)) return bad("Los estilos predeterminados de diagramas tienen un formato inválido");
  const out: DiagramDefaults = {};
  if (raw.shape !== undefined) {
    if (!isObj(raw.shape)) return bad("El estilo predeterminado de la forma no es válido");
    const p = nodeProblem(raw.shape); if (p) return bad(p);
    out.shape = completeNodeStyle("process", raw.shape as Partial<NodeStyle>);
  }
  if (raw.edge !== undefined) {
    if (!isObj(raw.edge) || !oneOf(ROUTES, raw.edge.route)) return bad("El estilo predeterminado del conector no es válido");
    if (raw.edge.style !== undefined && !isObj(raw.edge.style)) return bad("El estilo predeterminado del conector no es válido");
    const p = edgeProblem((raw.edge.style as Record<string, unknown> | undefined) ?? {}); if (p) return bad(p);
    out.edge = { style: completeEdgeStyle(raw.edge.style as Partial<EdgeStyle> | undefined), route: raw.edge.route as Route };
  }
  return ok(out);
}

const getMeta = async (s: SqlStore, key: string) => (await s.query<{ value: string }>("SELECT value FROM meta WHERE key = ?", [key]))[0]?.value ?? null;
const setMeta = (s: SqlExecutor, key: string, value: string) => s.exec("INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)", [key, value]);

/** Lee los predeterminados del espacio; un valor dañado se ignora (se usa el del sistema). */
export async function loadDiagramDefaults(store: SqlStore): Promise<DiagramDefaults> {
  const out: DiagramDefaults = {};
  for (const [key, field] of [[KEY_SHAPE, "shape"], [KEY_EDGE, "edge"]] as const) {
    const text = await getMeta(store, key);
    if (text === null) continue;
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { continue; }
    const r = parseDiagramDefaults({ [field]: raw });
    if (r.ok) Object.assign(out, r.value);
  }
  return out;
}
export const saveShapeDefault = (store: SqlExecutor, style: NodeStyle) => setMeta(store, KEY_SHAPE, stableJson(style));
export const saveEdgeDefault = (store: SqlExecutor, style: EdgeStyle, route: Route) => setMeta(store, KEY_EDGE, stableJson({ style, route }));
export async function clearDiagramDefaults(store: SqlStore): Promise<void> {
  await store.exec("DELETE FROM meta WHERE key = ?", [KEY_SHAPE]);
  await store.exec("DELETE FROM meta WHERE key = ?", [KEY_EDGE]);
}
/** Guarda en la base los predeterminados leídos de un respaldo (restauración). */
export async function restoreDiagramDefaults(store: SqlExecutor, d: DiagramDefaults): Promise<void> {
  if (d.shape) await saveShapeDefault(store, d.shape);
  if (d.edge) await saveEdgeDefault(store, d.edge.style, d.edge.route);
}
/** Contenido de `diagram-defaults.json` para el respaldo: JSON determinista, o `null` si el espacio no definió ninguno (no se escribe el archivo). */
export function serializeDiagramDefaults(d: DiagramDefaults): Uint8Array | null {
  if (!d.shape && !d.edge) return null;
  return new TextEncoder().encode(stableJson(d));
}

/** Lo que se pasa a `addNode`/`connect` para que un elemento nuevo nazca con el predeterminado de su tipo (o con el del sistema si no hay). */
export function applyDefaultsToDiagramParts(d: DiagramDefaults): { node?: NodeStyle; edge: { route?: Route; style?: EdgeStyle } } {
  return { ...(d.shape ? { node: d.shape } : {}), edge: d.edge ? { route: d.edge.route, style: d.edge.style } : {} };
}
