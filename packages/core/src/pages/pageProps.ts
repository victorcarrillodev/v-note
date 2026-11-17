// Historial de propiedades de página (plan 005, §7.4 y DP-8): portada, crédito, estilo, descripción y bloqueo.
// Los cambios de la cabecera, la portada y el menú se deshacen aquí; el contenido del editor usa el historial de Yjs.
import { stableJson } from "../backup/stableJson";
import { Snapshots } from "../diagrams/history";
import type { Result } from "../result";
import type { CoverCredit } from "./cover";
import type { Page, PagesRepo } from "./pagesRepo";
import type { PageStyle } from "./style";

export type PageProps = { cover: string | null; coverCredit: CoverCredit | null; style: PageStyle; description: string | null; locked: boolean };

export const propsOf = (p: Page): PageProps => ({ cover: p.cover, coverCredit: p.coverCredit, style: p.style, description: p.description, locked: p.locked });

/** Pila de deshacer y rehacer por página (límite 100). Una llamada a `set` = una entrada, aunque cambie varias propiedades. */
export class PagePropsHistory {
  private readonly stacks = new Map<string, Snapshots<PageProps>>();
  constructor(private readonly repo: PagesRepo, private readonly limit = 100) {}

  canUndo(pageId: string): boolean { return this.stacks.get(pageId)?.canUndo ?? false; }
  canRedo(pageId: string): boolean { return this.stacks.get(pageId)?.canRedo ?? false; }

  /** Escribe el cambio (una sentencia) y, si se guardó, lo apila. Un fallo de escritura no entra al historial. */
  async set(pageId: string, patch: Partial<PageProps>): Promise<Result<Page>> {
    const before = await this.repo.get(pageId);
    if (!before.ok) return before;
    const after = await this.repo.setProps(pageId, patch);
    if (!after.ok) return after;
    const stack = this.stacks.get(pageId) ?? new Snapshots<PageProps>(propsOf(before.value), stableJson, this.limit);
    stack.push(propsOf(after.value));
    this.stacks.set(pageId, stack);
    return after;
  }

  /** «Restablecer estilo» (RF-8.4): todo el estilo a predeterminado en una entrada; no toca portada, descripción ni bloqueo. */
  resetStyle(pageId: string): Promise<Result<Page>> {
    return this.set(pageId, { style: {} });
  }

  /** Vuelve al estado anterior; `null` si no hay nada que deshacer. */
  async undo(pageId: string): Promise<Result<Page> | null> {
    const prev = this.stacks.get(pageId)?.undo();
    return prev ? this.repo.setProps(pageId, prev) : null;
  }

  async redo(pageId: string): Promise<Result<Page> | null> {
    const next = this.stacks.get(pageId)?.redo();
    return next ? this.repo.setProps(pageId, next) : null;
  }
}
