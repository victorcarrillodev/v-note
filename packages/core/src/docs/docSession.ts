import * as Y from "yjs";
import type { PageService } from "../pages/pageService";
import type { DocStore } from "./docStore";

/** Estado de guardado observable (para el indicador de la cabecera). */
export type DocStatusEvent = { type: "edit" } | { type: "saved" } | { type: "failed"; message: string };

export type DocSessionOptions = {
  /** Pausa de escritura antes de guardar (junta varios cambios en una sola fila). */
  debounceMs?: number;
  /** Espera antes de reintentar un guardado fallido. */
  retryMs?: number;
  /** Cada cuántos guardados se compactan las actualizaciones en una instantánea. */
  compactAfter?: number;
  onError?: (message: string) => void;
  /** Se llama al cambiar el documento («edit»), al guardar todo lo pendiente («saved») y si guardar falla («failed»). */
  onStatus?: (e: DocStatusEvent) => void;
};

/**
 * Sesión de edición de una página: observa el documento Yjs y persiste sus cambios automáticamente (RF-4).
 * Nunca descarta cambios: si guardar falla, los conserva y reintenta.
 */
export class DocSession {
  private pending: Uint8Array[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private saving: Promise<void> | null = null;
  private disposed = false;
  private savesSinceCompact = 0;

  private constructor(
    readonly doc: Y.Doc,
    private svc: PageService,
    private docs: DocStore,
    private pageId: string,
    private opts: Required<Omit<DocSessionOptions, "onError" | "onStatus">> & Pick<DocSessionOptions, "onError" | "onStatus">,
  ) {
    doc.on("update", this.onUpdate);
  }

  static async open(svc: PageService, docs: DocStore, pageId: string, options: DocSessionOptions = {}): Promise<DocSession> {
    const loaded = await docs.load(pageId);
    if (!loaded.ok) throw new Error(loaded.error.message);
    const { onError, onStatus, ...rest } = options;
    return new DocSession(loaded.value, svc, docs, pageId, { debounceMs: 300, retryMs: 2000, compactAfter: 200, ...rest, ...(onError ? { onError } : {}), ...(onStatus ? { onStatus } : {}) });
  }

  private onUpdate = (update: Uint8Array, origin: unknown) => {
    if (this.disposed || origin === "remote") return;
    this.pending.push(update);
    this.opts.onStatus?.({ type: "edit" });
    this.schedule(this.opts.debounceMs);
  };

  private schedule(ms: number) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), ms);
  }

  /** Guarda de inmediato lo pendiente. Si falla, lo conserva y reintenta más tarde. */
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    if (this.saving) await this.saving;
    if (this.pending.length === 0) return;
    this.saving = this.saveBatch().finally(() => { this.saving = null; });
    await this.saving;
  }

  private async saveBatch(): Promise<void> {
    const batch = this.pending.slice();
    const r = await this.svc.saveUpdate(this.pageId, Y.mergeUpdates(batch));
    if (!r.ok) {
      this.opts.onError?.(r.error.message);
      this.opts.onStatus?.({ type: "failed", message: r.error.message });
      if (!this.disposed) this.schedule(this.opts.retryMs);
      return;
    }
    this.pending.splice(0, batch.length);
    if (this.pending.length) this.schedule(this.opts.debounceMs); // llegaron cambios mientras se guardaba
    else this.opts.onStatus?.({ type: "saved" });
    if (++this.savesSinceCompact >= this.opts.compactAfter) {
      this.savesSinceCompact = 0;
      await this.docs.compact(this.pageId);
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    await this.flush();
    this.disposed = true;
    clearTimeout(this.timer);
    this.doc.off("update", this.onUpdate);
  }
}
