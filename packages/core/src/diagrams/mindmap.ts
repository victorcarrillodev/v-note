// Núcleo del mapa mental (plan 004, §9): posición efectiva, mover ramas, globo nuevo sin choque y estilo por rama. Puro: sin DOM ni React.
import { appError, err, ok, type Result } from "../result";
import { GRID, snapOffset } from "./grid";
import type { Point } from "./geometry";
import { isColor, isFillColor } from "./style";
import { findNode, layoutTree, NODE_H, NODE_W, type TNode, type Tree, type TStyle } from "./tree";

const mapNode = (n: TNode, id: string, f: (n: TNode) => TNode): TNode => (n.id === id ? f(n) : { ...n, children: n.children.map((c) => mapNode(c, id, f)) });
const update = (t: Tree, id: string, f: (n: TNode) => TNode): Tree => ({ ...t, root: mapNode(t.root, id, f) });
const notFound = (id: string) => err(appError("NOT_FOUND", "El nodo no existe", { id }));

/** Ruta de globos desde la raíz hasta `id` (incluidos); vacía si no existe. */
function pathTo(t: Tree, id: string): TNode[] {
  const walk = (n: TNode, acc: TNode[]): TNode[] | null => {
    const here = [...acc, n];
    if (n.id === id) return here;
    for (const c of n.children) { const r = walk(c, here); if (r) return r; }
    return null;
  };
  return walk(t.root, []) ?? [];
}
const sumOff = (nodes: TNode[]): Point => nodes.reduce((s, n) => ({ x: s.x + (n.off?.x ?? 0), y: s.y + (n.off?.y ?? 0) }), { x: 0, y: 0 });

/**
 * Centro de cada globo visible. Mapa mental: distribución automática + desplazamiento propio y de los ancestros (RF-11).
 * El organigrama ignora los desplazamientos.
 */
export function resolveTreeLayout(t: Tree, kind: "orgchart" | "mindmap"): Map<string, Point> {
  const auto = layoutTree(t, kind);
  if (kind === "orgchart") return auto;
  const out = new Map<string, Point>();
  const walk = (n: TNode, acc: Point) => {
    const cur = { x: acc.x + (n.off?.x ?? 0), y: acc.y + (n.off?.y ?? 0) };
    const a = auto.get(n.id);
    if (a) out.set(n.id, { x: a.x + cur.x, y: a.y + cur.y });
    if (!n.collapsed) n.children.forEach((c) => walk(c, cur));
  };
  walk(t.root, { x: 0, y: 0 });
  return out;
}

/** Posición del globo sin su propio desplazamiento: automática más los desplazamientos de sus ancestros. */
export function effectiveBase(t: Tree, id: string): Point {
  const auto = layoutTree(t, "mindmap").get(id) ?? { x: 0, y: 0 };
  const path = pathTo(t, id);
  const off = sumOff(path.slice(0, -1));
  return { x: auto.x + off.x, y: auto.y + off.y };
}

/** Fija el desplazamiento propio de un globo (sin campo si es cero). */
export function setTreeNodeOffset(t: Tree, id: string, off: Point): Tree {
  const zero = off.x === 0 && off.y === 0;
  return update(t, id, (n) => { const { off: _o, ...rest } = n; return zero ? rest : { ...rest, off: { x: off.x, y: off.y } }; });
}

/** Mueve un globo (y su rama) para que su centro quede en `desired`; solo cambia el `off` del globo. */
export function moveBranch(t: Tree, id: string, desired: Point, opts: { snap: boolean }): Tree {
  if (!findNode(t, id)) return t;
  const base = effectiveBase(t, id);
  const off = opts.snap ? snapOffset(desired, base) : { x: desired.x - base.x, y: desired.y - base.y };
  return setTreeNodeOffset(t, id, off);
}

const clearOff = (n: TNode): TNode => { const { off: _o, ...rest } = n; return { ...rest, children: n.children.map(clearOff) }; };
/** «Reordenar automáticamente»: borra todos los desplazamientos. */
export const reflowAuto = (t: Tree): Tree => ({ ...t, root: clearOff(t.root) });

const MAX_ATTEMPTS = 200;
/** Coloca un globo recién creado sin que se superponga con otros visibles: lo baja de celda en celda; si se movió, lo deja en la cuadrícula. */
export function placeNewNode(t: Tree, id: string): Tree {
  const layout = resolveTreeLayout(t, "mindmap");
  const start = layout.get(id);
  if (!start) return t;
  const others = [...layout].filter(([k]) => k !== id).map(([, p]) => p);
  const hits = (p: Point) => others.some((o) => Math.abs(o.x - p.x) < NODE_W && Math.abs(o.y - p.y) < NODE_H);
  if (!hits(start)) return t;
  let cand = { x: start.x, y: start.y };
  for (let i = 0; i < MAX_ATTEMPTS && hits(cand); i++) cand = { x: cand.x, y: cand.y + GRID };
  return moveBranch(t, id, cand, { snap: true });
}

/** Cambia un color del globo; `undefined` lo quita. Rechaza colores inválidos. */
export function setTreeNodeStyle(t: Tree, id: string, key: keyof TStyle, value: string | undefined): Result<Tree> {
  if (!findNode(t, id)) return notFound(id);
  if (value !== undefined && !((key === "fill" || key === "stroke" ? isFillColor : isColor)(value))) return err(appError("INVALID", "Color no válido", { key, value }));
  return ok(update(t, id, (n) => {
    const style: TStyle = { ...(n.style ?? {}) };
    if (value === undefined) delete style[key]; else style[key] = value;
    const { style: _s, ...rest } = n;
    return Object.keys(style).length > 0 ? { ...rest, style } : rest;
  }));
}

/** Copia el estilo del globo a todos sus descendientes actuales (RF-10). Los que se creen después nacen sin estilo propio. */
export function applyStyleToBranch(t: Tree, id: string): Result<Tree> {
  const node = findNode(t, id);
  if (!node) return notFound(id);
  const style = node.style;
  const apply = (n: TNode): TNode => {
    const { style: _s, ...rest } = n;
    return { ...rest, ...(style ? { style: { ...style } } : {}), children: n.children.map(apply) };
  };
  return ok(update(t, id, (n) => ({ ...n, children: n.children.map(apply) })));
}

/** Copia de una rama para el portapapeles interno (el texto y la estructura, con su estilo; sin posiciones). */
export const branchClip = (t: Tree, id: string): TNode | null => { const n = findNode(t, id); return n ? structuredClone(n) : null; };

/** Pega una copia como hija de `parentId`, con identificadores nuevos y sin desplazamientos propios. */
export function pasteBranch(t: Tree, parentId: string, clip: TNode, newId: () => string): Result<{ tree: Tree; node: TNode }> {
  if (!findNode(t, parentId)) return notFound(parentId);
  const fresh = (n: TNode): TNode => { const { off: _o, ...rest } = n; return { ...rest, id: newId(), children: n.children.map(fresh) }; };
  const node = fresh(clip);
  return ok({ tree: update(t, parentId, (p) => ({ ...p, collapsed: false, children: [...p.children, node] })), node });
}
