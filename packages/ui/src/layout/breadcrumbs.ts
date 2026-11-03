export type Crumb = { id: string; title: string };
export type CrumbPart = { kind: "item"; item: Crumb } | { kind: "gap"; hidden: Crumb[] };

/**
 * Migas de pan con truncado desde el MEDIO: conserva la primera y las últimas, y agrupa el resto en un «…» (con sus migas ocultas).
 * La página actual (la última) siempre se conserva. `max` es el número de partes visibles, contando el «…».
 */
export function truncateBreadcrumbs(items: readonly Crumb[], max: number): CrumbPart[] {
  const toItem = (c: Crumb): CrumbPart => ({ kind: "item", item: c });
  if (items.length <= max) return items.map(toItem);
  const tail = Math.max(1, max - 2);
  const first = items[0]!;
  const hidden = items.slice(1, items.length - tail);
  return [toItem(first), { kind: "gap", hidden: [...hidden] }, ...items.slice(items.length - tail).map(toItem)];
}
