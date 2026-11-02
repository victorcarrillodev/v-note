import type { TreeRow } from "./flatten";

export type Zone = "before" | "inside" | "after";
/** `afterId`: undefined = al final, null = al inicio, id = justo después de esa hermana (igual que PagesRepo.move). */
export type DropTarget = { parentId: string | null; afterId: string | null | undefined };

/** Zona de la fila según la posición vertical del puntero: cuarto superior, mitad central, cuarto inferior. */
export function zoneAt(rowTop: number, pointerY: number, rowHeight: number): Zone {
  const rel = (pointerY - rowTop) / rowHeight;
  return rel < 0.25 ? "before" : rel > 0.75 ? "after" : "inside";
}

/** Nuevo padre y posición para soltar `dragId` sobre `overId` en una zona. `null` si no cambiaría nada o no es válido. */
export function dropTarget(rows: readonly TreeRow[], dragId: string, overId: string, zone: Zone): DropTarget | null {
  if (dragId === overId) return null;
  const over = rows.find((r) => r.node.page.id === overId);
  if (!over) return null;
  if (zone === "inside") return { parentId: overId, afterId: undefined };

  // Hermanas visibles de la fila destino (mismo padre), sin la arrastrada: la posición se calcula sobre las que quedan
  const siblings = rows.filter((r) => r.parentId === over.parentId).map((r) => r.node.page.id);
  const others = siblings.filter((s) => s !== dragId);
  const afterId = zone === "after" ? overId : (others[others.indexOf(overId) - 1] ?? null);

  // Sin cambio: ya está justo en esa posición dentro del mismo padre
  if (siblings.includes(dragId)) {
    const targetIdx = afterId === null ? 0 : others.indexOf(afterId) + 1;
    if (siblings.indexOf(dragId) === targetIdx) return null;
  }
  return { parentId: over.parentId, afterId };
}
