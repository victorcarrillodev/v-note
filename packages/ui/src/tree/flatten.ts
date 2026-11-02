import type { PageNode } from "@vnote/core";

export type TreeRow = { node: PageNode; depth: number; hasChildren: boolean; expanded: boolean; parentId: string | null };

/** Aplana el árbol a la lista de filas visibles (solo hijos de nodos expandidos). Iterativo: soporta mucha profundidad. */
export function flattenTree(nodes: readonly PageNode[], expanded: ReadonlySet<string>): TreeRow[] {
  const out: TreeRow[] = [];
  const stack: { node: PageNode; depth: number; parentId: string | null }[] = [];
  for (let i = nodes.length - 1; i >= 0; i--) stack.push({ node: nodes[i]!, depth: 0, parentId: null });
  while (stack.length) {
    const { node, depth, parentId } = stack.pop()!;
    const hasChildren = node.children.length > 0;
    const isExpanded = hasChildren && expanded.has(node.page.id);
    out.push({ node, depth, hasChildren, expanded: isExpanded, parentId });
    if (isExpanded) for (let i = node.children.length - 1; i >= 0; i--) stack.push({ node: node.children[i]!, depth: depth + 1, parentId: node.page.id });
  }
  return out;
}
