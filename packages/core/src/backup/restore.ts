import { parseDiagramDefaults, restoreDiagramDefaults, type DiagramDefaults } from "../diagrams/defaults";
import * as Y from "yjs";
import { appError, err, ok, type AppError, type Result } from "../result";
import type { AssetStore } from "../assets/assetStore";
import { sha256Hex } from "../assets/hash";
import type { SqlStore } from "../ports/sqlStore";
import type { Block } from "../blocks/types";
import { toYjs } from "../blocks/toYjs";
import { blocksToPlainText } from "../search/plainText";
import { SearchIndex } from "../search/searchIndex";
import { indexPageLinksIn } from "../links/linkIndex";
import { systemClock } from "../clock";
import { FORMAT_VERSION } from "./serialize";
import { insertTags, validateTags, type TagsFile } from "./tags";
import { insertDatabases, validateDatabases, type DbFile, type RemindersFile } from "./databases";
import type { BackupError, CommitSummary, GitHubClient } from "./githubClient";
import { styleToText } from "../pages/style";

const dec = new TextDecoder();
const KINDS = new Set(["note", "board", "database"]);
const invalid = (message: string, details?: Record<string, unknown>) => err(appError("INVALID", message, details));
const fromBackupError = (e: BackupError): Result<never> => err(appError("STORAGE", e.message, { kind: e.kind }));

/** Respaldos disponibles (commits) del repositorio, el más reciente primero. */
export async function listBackups(client: GitHubClient, branch: string): Promise<Result<CommitSummary[]>> {
  const head = await client.getHead(branch);
  if (!head.ok) return fromBackupError(head.error);
  if (head.value === null) return ok([]);
  const r = await client.listCommits(branch, 50);
  return r.ok ? ok(r.value) : fromBackupError(r.error);
}

const NEEDED = (p: string) => p === "workspace.json" || p === "trash.json" || p === "reminders.json" || p === "tags.json" || p === "diagram-defaults.json" || p.startsWith("databases/") || p.startsWith("data/") || p.startsWith("assets/");

/** Descarga de un commit los archivos necesarios para restaurar (no los Markdown, que son solo de lectura). */
export async function readBackup(client: GitHubClient, commitSha: string): Promise<Result<Map<string, Uint8Array>>> {
  const commit = await client.getCommit(commitSha);
  if (!commit.ok) return fromBackupError(commit.error);
  const tree = await client.listTree(commit.value.treeSha);
  if (!tree.ok) return fromBackupError(tree.error);
  const files = new Map<string, Uint8Array>();
  for (const [path, sha] of [...tree.value].filter(([p]) => NEEDED(p)).sort(([a], [b]) => (a < b ? -1 : 1))) {
    const blob = await client.getBlob(sha);
    if (!blob.ok) return fromBackupError(blob.error);
    files.set(path, blob.value);
  }
  return ok(files);
}

type PageData = {
  id: string; parentId: string | null; position: string; title: string; icon: string | null; cover: string | null; kind: string;
  favorite: boolean; fullWidth: boolean; createdAt: number; updatedAt: number; deletedAt: number | null; deletedRootId: string | null; blocks: Block[];
};

function parseJson(bytes: Uint8Array | undefined, what: string): Result<Record<string, any>> { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!bytes) return invalid(`Falta ${what} en el respaldo`);
  try {
    const v = JSON.parse(dec.decode(bytes));
    return v && typeof v === "object" ? ok(v) : invalid(`${what} no es un objeto válido`);
  } catch {
    return invalid(`${what} está dañado`);
  }
}

/** Valida TODO el respaldo antes de escribir nada. */
export async function validateBackup(files: Map<string, Uint8Array>): Promise<Result<{ diagramDefaults: DiagramDefaults; pages: PageData[]; assets: [string, Uint8Array][]; databases: DbFile[]; reminders: RemindersFile | null; tags: TagsFile | null }>> {
  const ws = parseJson(files.get("workspace.json"), "workspace.json");
  if (!ws.ok) return ws;
  if (typeof ws.value.formatVersion !== "number") return invalid("workspace.json no indica la versión del formato");
  if (ws.value.formatVersion > FORMAT_VERSION) {
    return err(appError("UNSUPPORTED_VERSION", "Este respaldo es de una versión más nueva de la aplicación", { found: ws.value.formatVersion, supported: FORMAT_VERSION }));
  }

  const pages: PageData[] = [];
  for (const [path, bytes] of files) {
    if (!path.startsWith("data/")) continue;
    const d = parseJson(bytes, path);
    if (!d.ok) return d;
    const p = d.value;
    if (typeof p.id !== "string" || path !== `data/${p.id}.json`) return invalid(`La ruta ${path} no coincide con el id de la página`);
    if (typeof p.title !== "string" || typeof p.position !== "string" || !KINDS.has(p.kind)) return invalid(`La página ${p.id} tiene campos inválidos`);
    if (!Array.isArray(p.blocks)) return invalid(`La página ${p.id} no tiene una lista de bloques`);
    if (typeof p.createdAt !== "number" || typeof p.updatedAt !== "number") return invalid(`La página ${p.id} no tiene fechas válidas`);
    pages.push({
      id: p.id, parentId: p.parentId ?? null, position: p.position, title: p.title, icon: p.icon ?? null, cover: p.cover ?? null, kind: p.kind,
      favorite: p.favorite === true, fullWidth: p.fullWidth === true, createdAt: p.createdAt, updatedAt: p.updatedAt, deletedAt: p.deletedAt ?? null, deletedRootId: p.deletedRootId ?? null, blocks: p.blocks,
    });
  }
  const byId = new Map(pages.map((p) => [p.id, p]));
  if (byId.size !== pages.length) return invalid("Hay páginas con el mismo id");
  for (const p of pages) {
    if (p.parentId !== null && !byId.has(p.parentId)) return invalid(`La página ${p.id} apunta a un padre que no existe`, { parentId: p.parentId });
    let cur: PageData | undefined = p, steps = 0;
    while (cur?.parentId) { cur = byId.get(cur.parentId); if (++steps > pages.length) return invalid("La jerarquía de páginas tiene un ciclo"); }
  }

  const assets: [string, Uint8Array][] = [];
  for (const [path, bytes] of files) {
    if (!path.startsWith("assets/")) continue;
    const hash = path.slice("assets/".length);
    if ((await sha256Hex(bytes)) !== hash) return invalid(`El adjunto ${hash} está dañado (su contenido no coincide con su huella)`);
    assets.push([hash, bytes]);
  }

  const parsed: { path: string; data: unknown }[] = [];
  for (const [path, bytes] of [...files].filter(([p]) => p.startsWith("databases/")).sort(([a], [b]) => (a < b ? -1 : 1))) {
    const d = parseJson(bytes, path);
    if (!d.ok) return d;
    parsed.push({ path, data: d.value });
  }
  let remindersRaw: unknown;
  if (files.has("reminders.json")) {
    const r = parseJson(files.get("reminders.json"), "reminders.json");
    if (!r.ok) return r;
    remindersRaw = r.value;
  }
  const dbs = validateDatabases(parsed, remindersRaw, new Set(pages.map((p) => p.id)));
  if (!dbs.ok) return dbs;
  let tagsRaw: unknown;
  if (files.has("tags.json")) {
    const r = parseJson(files.get("tags.json"), "tags.json");
    if (!r.ok) return r;
    tagsRaw = r.value;
  }
  const tags = validateTags(tagsRaw, new Set(pages.map((p) => p.id)));
  if (!tags.ok) return tags;
  let diagramDefaults: DiagramDefaults = {};
  if (files.has("diagram-defaults.json")) {
    const r = parseJson(files.get("diagram-defaults.json"), "diagram-defaults.json");
    if (!r.ok) return r;
    const dd = parseDiagramDefaults(r.value);
    if (!dd.ok) return dd;
    diagramDefaults = dd.value;
  }
  return ok({ pages, assets, databases: dbs.value.databases, reminders: dbs.value.reminders, tags: tags.value, diagramDefaults });
}

/**
 * Reconstruye un espacio de trabajo en un destino VACÍO a partir de los archivos de un respaldo.
 * Primero valida todo; si algo falla no se escribe nada. Nunca sobrescribe un espacio con contenido (constitución, art. 5).
 */
export async function restoreFromFiles(files: Map<string, Uint8Array>, target: { store: SqlStore; assets: AssetStore }): Promise<Result<{ pages: number; assets: number }, AppError>> {
  const v = await validateBackup(files);
  if (!v.ok) return v;

  const existing = (await target.store.query<{ n: number }>("SELECT count(*) AS n FROM pages"))[0]?.n ?? 0;
  if (existing > 0) return err(appError("NEEDS_CONFIRMATION", "El espacio de destino ya tiene contenido; restaurar sobre él exige confirmación explícita"));

  try {
    for (const [, bytes] of v.value.assets) await target.assets.put(bytes);
    const index = new SearchIndex(target.store, systemClock);
    await target.store.transaction(async (tx) => {
      await tx.exec("PRAGMA defer_foreign_keys = ON");
      for (const p of v.value.pages) {
        await tx.exec(
          "INSERT INTO pages(id, parent_id, position, title, icon, cover, kind, favorite, style, created_at, updated_at, deleted_at, deleted_root_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          // Spec 005 (DP-6): el ancho completo de un respaldo se guarda en el estilo de la página.
          [p.id, p.parentId, p.position, p.title, p.icon, p.cover, p.kind, p.favorite ? 1 : 0, p.fullWidth ? styleToText({ spacing: { width: "full" } }) : null, p.createdAt, p.updatedAt, p.deletedAt, p.deletedRootId],
        );
        if (p.blocks.length) {
          const doc = new Y.Doc();
          toYjs(p.blocks, doc.getXmlFragment("doc"));
          await tx.exec("INSERT INTO page_docs(page_id, seq, kind, data, created_at) VALUES (?, 0, 'snapshot', ?, ?)", [p.id, Y.encodeStateAsUpdate(doc), p.updatedAt]);
        }
        await index.upsertIn(tx, p.id, p.title, blocksToPlainText(p.blocks));
        await indexPageLinksIn(tx, p.id, p.blocks); // las menciones vuelven a ser enlaces
      }
      await insertDatabases(tx, v.value.databases, v.value.reminders);
      await insertTags(tx, v.value.tags);
      await restoreDiagramDefaults(tx, v.value.diagramDefaults);
    });
    return ok({ pages: v.value.pages.length, assets: v.value.assets.length });
  } catch (e) {
    return invalid("No se pudo reconstruir el espacio a partir del respaldo", { cause: e instanceof Error ? e.message : String(e) });
  }
}
