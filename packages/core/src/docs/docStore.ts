import * as Y from "yjs";
import { appError, err, ok, type Result } from "../result";
import type { Clock } from "../clock";
import type { SqlExecutor, SqlStore } from "../ports/sqlStore";

type Row = { seq: number; kind: "snapshot" | "update"; data: Uint8Array };

/** Almacén de documentos Yjs por página: registro de actualizaciones + instantáneas, todo en transacciones (plan 2.4, D-6). */
export class DocStore {
  constructor(private db: SqlStore, private clock: Clock) {}

  /** Añade una actualización incremental. Atómico: o queda guardada completa o no queda nada. */
  async appendUpdate(pageId: string, update: Uint8Array): Promise<Result<void>> {
    try {
      return await this.db.transaction((tx) => this.appendUpdateIn(tx, pageId, update));
    } catch (e) {
      return err(appError("STORAGE", "No se pudo guardar el documento", { cause: String(e) }));
    }
  }

  /** Igual que `appendUpdate` pero dentro de una transacción ya abierta por quien llama. */
  async appendUpdateIn(ex: SqlExecutor, pageId: string, update: Uint8Array): Promise<Result<void>> {
    const page = await ex.query("SELECT 1 FROM pages WHERE id = ?", [pageId]);
    if (page.length === 0) return err(appError("NOT_FOUND", "La página no existe", { pageId }));
    const next = await ex.query<{ n: number }>("SELECT COALESCE(MAX(seq), -1) + 1 AS n FROM page_docs WHERE page_id = ?", [pageId]);
    await ex.exec("INSERT INTO page_docs(page_id, seq, kind, data, created_at) VALUES (?, ?, 'update', ?, ?)", [
      pageId, next[0]!.n, update, this.clock.now(),
    ]);
    return ok(undefined);
  }

  /** Carga el documento usando un ejecutor dado (p. ej. dentro de una transacción). */
  async loadIn(ex: SqlExecutor, pageId: string): Promise<Y.Doc> {
    const rows = await ex.query<Row>("SELECT seq, kind, data FROM page_docs WHERE page_id = ? ORDER BY seq", [pageId]);
    const doc = new Y.Doc();
    for (const r of rows) Y.applyUpdate(doc, new Uint8Array(r.data));
    return doc;
  }

  /** Reconstruye el documento: instantánea más actualizaciones, en orden. Sin filas = documento vacío. */
  async load(pageId: string): Promise<Result<Y.Doc>> {
    try {
      return ok(await this.loadIn(this.db, pageId));
    } catch (e) {
      return err(appError("STORAGE", "No se pudo cargar el documento", { cause: String(e) }));
    }
  }

  /** Reemplaza todas las filas por una sola instantánea del estado completo. Atómico. */
  async compact(pageId: string): Promise<Result<void>> {
    const loaded = await this.load(pageId);
    if (!loaded.ok) return loaded;
    try {
      await this.db.transaction(async (tx) => {
        await tx.exec("DELETE FROM page_docs WHERE page_id = ?", [pageId]);
        await tx.exec("INSERT INTO page_docs(page_id, seq, kind, data, created_at) VALUES (?, 0, 'snapshot', ?, ?)", [
          pageId, Y.encodeStateAsUpdate(loaded.value), this.clock.now(),
        ]);
      });
      return ok(undefined);
    } catch (e) {
      return err(appError("STORAGE", "No se pudo compactar el documento", { cause: String(e) }));
    }
  }
}
