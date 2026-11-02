import { ok, type Result } from "../result";
import type { Clock } from "../clock";
import type { SqlStore } from "../ports/sqlStore";
import { PagesRepo, type Page } from "../pages/pagesRepo";
import { PageService } from "../pages/pageService";

const KEY = "inbox_page_id";

/** Devuelve la Bandeja de entrada del espacio; la crea o la recrea si falta o está en la papelera (CL-16). */
export async function ensureInbox(store: SqlStore, clock: Clock, title: string): Promise<Result<Page>> {
  const pages = new PagesRepo(store, clock);
  const stored = (await store.query<{ value: string }>("SELECT value FROM meta WHERE key = ?", [KEY]))[0]?.value;
  if (stored) {
    const existing = await pages.get(stored);
    if (existing.ok && existing.value.deletedAt === null) return existing;
  }
  const created = await new PageService(store, clock).create({ title });
  if (!created.ok) return created;
  await store.exec("INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)", [KEY, created.value.id]);
  return ok(created.value);
}
