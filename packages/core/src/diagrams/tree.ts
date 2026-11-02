import { hierarchy, tree as d3tree } from "d3-hierarchy";
import { appError, err, ok, type Result } from "../result";
import { newId } from "../ids";
import { stableJson } from "../backup/stableJson";

export type TNode = { id: string; text: string; children: TNode[]; collapsed?: boolean };
export type Tree = { root: TNode };
export const NODE_W = 160;
export const NODE_H = 40;
const SIBLING_GAP = 20, LEVEL_GAP = 40, MAP_LEVEL_GAP = 60;

export const newTree = (text: string): Tree => ({ root: { id: "root", text, children: [] } });

const mapNode = (n: TNode, id: string, f: (n: TNode) => TNode): TNode => (n.id === id ? f(n) : { ...n, children: n.children.map((c) => mapNode(c, id, f)) });
export function findNode(t: Tree, id: string): TNode | null {
  const walk = (n: TNode): TNode | null => (n.id === id ? n : n.children.reduce<TNode | null>((found, c) => found ?? walk(c), null));
  return walk(t.root);
}
const count = (n: TNode): number => 1 + n.children.reduce((s, c) => s + count(c), 0);
const parentOf = (t: Tree, id: string): TNode | null => {
  const walk = (n: TNode): TNode | null => (n.children.some((c) => c.id === id) ? n : n.children.reduce<TNode | null>((f, c) => f ?? walk(c), null));
  return walk(t.root);
};
const notFound = (id: string) => err(appError("NOT_FOUND", "El nodo no existe", { id }));

export function addChild(t: Tree, parentId: string, text: string, id?: string): Result<{ tree: Tree; node: TNode }> {
  if (!findNode(t, parentId)) return notFound(parentId);
  const node: TNode = { id: id ?? newId(), text, children: [] };
  return ok({ tree: { root: mapNode(t.root, parentId, (p) => ({ ...p, children: [...p.children, node], collapsed: false })) }, node });
}
export function addSibling(t: Tree, nodeId: string, text: string, id?: string): Result<{ tree: Tree; node: TNode }> {
  if (!findNode(t, nodeId)) return notFound(nodeId);
  const parent = parentOf(t, nodeId);
  if (!parent) return err(appError("INVALID", "La idea central no tiene hermanos", { reason: "ROOT" }));
  const node: TNode = { id: id ?? newId(), text, children: [] };
  const i = parent.children.findIndex((c) => c.id === nodeId);
  return ok({ tree: { root: mapNode(t.root, parent.id, (p) => ({ ...p, children: [...p.children.slice(0, i + 1), node, ...p.children.slice(i + 1)] })) }, node });
}
export const renameNode = (t: Tree, id: string, text: string): Tree => ({ root: mapNode(t.root, id, (n) => ({ ...n, text })) });
export function deleteTreeNode(t: Tree, id: string): Result<{ tree: Tree; removed: number }> {
  const node = findNode(t, id);
  if (!node) return notFound(id);
  const parent = parentOf(t, id);
  if (!parent) return err(appError("INVALID", "La idea central no se puede eliminar", { reason: "ROOT" }));
  return ok({ tree: { root: mapNode(t.root, parent.id, (p) => ({ ...p, children: p.children.filter((c) => c.id !== id) })) }, removed: count(node) });
}
export const toggleCollapsed = (t: Tree, id: string): Tree =>
  ({ root: mapNode(t.root, id, (n) => (n.children.length === 0 ? n : { ...n, collapsed: n.collapsed ? false : true })) });

/** Reubica un nodo (con su subárbol) bajo otro padre en una posición; nunca dentro de sí mismo ni de sus descendientes. */
export function moveTreeNode(t: Tree, id: string, newParentId: string, index: number): Result<Tree> {
  const node = findNode(t, id), target = findNode(t, newParentId);
  if (!node || !target) return notFound(!node ? id : newParentId);
  const oldParent = parentOf(t, id);
  if (!oldParent) return err(appError("INVALID", "La idea central no se puede mover", { reason: "ROOT" }));
  if (findNode({ root: node }, newParentId)) return err(appError("CYCLE", "No se puede mover un nodo dentro de sí mismo ni de sus descendientes", { id, newParentId }));
  const without = { root: mapNode(t.root, oldParent.id, (p) => ({ ...p, children: p.children.filter((c) => c.id !== id) })) };
  return ok({ root: mapNode(without.root, newParentId, (p) => { const i = Math.max(0, Math.min(index, p.children.length)); return { ...p, collapsed: false, children: [...p.children.slice(0, i), node, ...p.children.slice(i)] }; }) });
}

export type VisibleNode = { id: string; text: string; depth: number; hasChildren: boolean; collapsed: boolean };
export function visibleNodes(t: Tree): VisibleNode[] {
  const out: VisibleNode[] = [];
  const walk = (n: TNode, depth: number) => {
    out.push({ id: n.id, text: n.text, depth, hasChildren: n.children.length > 0, collapsed: n.collapsed === true });
    if (!n.collapsed) n.children.forEach((c) => walk(c, depth + 1));
  };
  walk(t.root, 0);
  return out;
}

export const serializeTree = (t: Tree): string => stableJson(t);
const invalid = (m: string) => err(appError("INVALID", m, { reason: "TREE" }));
export function parseTree(text: string): Result<Tree> {
  if (text.trim() === "") return ok(newTree(""));
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return invalid("El organizador está dañado"); }
  const ids = new Set<string>();
  const check = (n: unknown): n is TNode => {
    const x = n as Partial<TNode> | null;
    if (!x || typeof x.id !== "string" || typeof x.text !== "string" || !Array.isArray(x.children) || ids.has(x.id)) return false;
    ids.add(x.id);
    return x.children.every(check);
  };
  const root = (raw as { root?: unknown } | null)?.root;
  return check(root) ? ok({ root }) : invalid("El organizador no tiene el formato esperado");
}
export const treeText = (t: Tree): string => { const out: string[] = []; const walk = (n: TNode) => { if (n.text.trim() !== "") out.push(n.text); n.children.forEach(walk); }; walk(t.root); return out.join("\n"); };

const asHier = (n: TNode): TNode => ({ ...n, children: n.collapsed ? [] : n.children.map(asHier) });

/** Posición del centro de cada nodo visible. Organigrama: de arriba abajo. Mapa mental: ramas repartidas a izquierda y derecha. */
export function layoutTree(t: Tree, kind: "orgchart" | "mindmap"): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  const root = asHier(t.root);
  if (kind === "orgchart") {
    const h = d3tree<TNode>().nodeSize([NODE_W + SIBLING_GAP, NODE_H + LEVEL_GAP])(hierarchy(root));
    h.each((n) => out.set(n.data.id, { x: n.x, y: n.y }));
    return out;
  }
  out.set(root.id, { x: 0, y: 0 });
  const sides: [TNode[], 1 | -1][] = [[root.children.filter((_, i) => i % 2 === 0), 1], [root.children.filter((_, i) => i % 2 === 1), -1]];
  for (const [kids, sign] of sides) {
    if (kids.length === 0) continue;
    const h = d3tree<TNode>().nodeSize([NODE_H + SIBLING_GAP, NODE_W + MAP_LEVEL_GAP])(hierarchy({ ...root, children: kids }));
    h.each((n) => { if (n.depth > 0) out.set(n.data.id, { x: sign * n.y, y: n.x }); });
  }
  return out;
}
