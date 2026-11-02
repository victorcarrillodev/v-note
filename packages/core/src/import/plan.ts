import Papa from "papaparse";
import { newId } from "../ids";
import { assetUrl } from "../assets/attach";
import { sha256Hex } from "../assets/hash";
import type { Block, Inline } from "../blocks/types";
import { markdownToBlocks } from "./markdown";
import { cleanPath } from "./zip";
import type { ImportKind, ImportPlan, ImportReport, PlanDatabase, PlanPage, SourceFile } from "./types";

export type PlanOptions = { kind: ImportKind; name: string; signal?: AbortSignal; onProgress?: (done: number, total: number) => void };

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp"]);
const NOTION_ID = /\s+[0-9a-f]{32}$/i;
const tick = () => new Promise<void>((r) => setTimeout(r, 0));
const extOf = (p: string) => (p.includes(".") ? p.slice(p.lastIndexOf(".") + 1).toLowerCase() : "");
const dirOf = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
const baseOf = (p: string) => p.slice(p.lastIndexOf("/") + 1);
const stem = (name: string) => (name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : name);
const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
const isExternal = (href: string) => /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("#") || href.startsWith("//");
/** Resuelve una ruta relativa contra la carpeta de un archivo. Devuelve null si sale de la raíz. */
function resolveRel(fromDir: string, rel: string): string | null {
  const parts = fromDir === "" ? [] : fromDir.split("/");
  for (const seg of rel.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") { if (parts.length === 0) return null; parts.pop(); } else parts.push(seg);
  }
  return cleanPath(parts.join("/"));
}

type MdFile = { path: string; title: string; page: PlanPage };
type Node = { name: string; page: PlanPage | null; children: Map<string, Node>; hasContent: boolean };

/** Construye el plan de importación (sin escribir nada): páginas, adjuntos, bases de datos e informe. Devuelve null si se cancela. */
export async function planImport(input: SourceFile[], opts: PlanOptions): Promise<ImportPlan | null> {
  const notion = opts.kind === "notion";
  const report: ImportReport = { source: opts.kind, imported: [], approximated: [], omitted: [], brokenLinks: [] };
  const clean = (name: string) => (notion ? name.replace(NOTION_ID, "") : name);
  const files = input.flatMap((f) => { const p = cleanPath(f.path); return p ? [{ path: p, data: f.data }] : []; }).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const total = files.length;
  let done = 0;
  const step = async (): Promise<boolean> => {
    done++; opts.onProgress?.(done, total);
    if (done % 25 === 0) await tick();
    return opts.signal?.aborted === true;
  };

  const byPath = new Map<string, string>(); // ruta (minúsculas) del archivo → id de página
  const byTitle = new Map<string, string>(); // título (minúsculas) → id de página (gana el primero)
  const mdFiles: MdFile[] = [];
  const images = new Map<string, Uint8Array>(); // ruta → bytes de imágenes candidatas
  const assets = new Map<string, Uint8Array>();
  const csvs: { path: string; data: Uint8Array }[] = [];
  const utf8 = new TextDecoder("utf-8", { fatal: true });
  const readText = (data: Uint8Array): string | null => { if (data.includes(0)) return null; try { return utf8.decode(data); } catch { return null; } };

  // 1) Clasificar cada archivo
  const pending: { path: string; text: string }[] = [];
  for (const f of files) {
    if (opts.signal?.aborted) return null;
    const ext = extOf(f.path);
    if (f.path.split("/").some((seg) => seg.startsWith(".") && seg.length > 1)) report.omitted.push({ path: f.path, message: "Configuración de otra aplicación (no es contenido)" });
    else if (ext === "md" || ext === "markdown") {
      const text = readText(f.data);
      if (text === null) report.omitted.push({ path: f.path, message: "El archivo está dañado o no es texto" });
      else pending.push({ path: f.path, text });
    } else if (ext === "csv" && notion) csvs.push(f);
    else if (IMAGE_EXT.has(ext)) images.set(f.path, f.data);
    else report.omitted.push({ path: f.path, message: ext === "csv" ? "Los CSV solo se importan desde Notion" : "Tipo de archivo sin equivalente" });
    if (await step()) return null;
  }

  // 2) Convertir cada Markdown a bloques
  for (const { path, text } of pending) {
    const title = clean(stem(baseOf(path))).trim() || "Sin título";
    const md = markdownToBlocks(text, { wikilinks: opts.kind === "obsidian" });
    const page: PlanPage = { id: newId(), title, blocks: md.blocks, children: [] };
    const imageSrc = new Map(md.images.map((i) => [i.blockId, i.src]));
    attachImages(page.blocks, path, imageSrc);
    for (const a of md.approximations) report.approximated.push({ path, message: a });
    byPath.set(path.toLowerCase(), page.id);
    if (!byTitle.has(title.toLowerCase())) byTitle.set(title.toLowerCase(), page.id);
    mdFiles.push({ path, title, page });
    if (await step()) return null;
  }

  function attachImages(blocks: Block[], filePath: string, srcs: Map<string, string>): void {
    const walk = (list: Block[]) => {
      for (const b of list) {
        const src = srcs.get(b.id);
        if (src !== undefined && b.type === "image") {
          if (/^(https?:|data:image\/)/i.test(src)) { /* imagen remota: se conserva la URL */ }
          else {
            const target = resolveRel(dirOf(filePath), decode(src));
            const bytes = target ? images.get(target) ?? findCaseInsensitive(images, target) : undefined;
            if (bytes && target) { b.props.url = `pending:${target}`; b.props.name = baseOf(target); }
            else { b.type = "paragraph"; b.props = {}; b.content = [{ type: "text", text: `[imagen no encontrada: ${src}]`, styles: {} }]; report.brokenLinks.push({ path: filePath, message: `Imagen no encontrada: ${src}` }); }
          }
        }
        walk(b.children);
      }
    };
    walk(blocks);
  }
  function findCaseInsensitive(map: Map<string, Uint8Array>, key: string): Uint8Array | undefined {
    const k = key.toLowerCase();
    for (const [p, v] of map) if (p.toLowerCase() === k) return v;
    return undefined;
  }

  // 3) Hashear las imágenes referenciadas y sustituir el marcador por la URL del adjunto
  const hashes = new Map<string, string>();
  const resolveImages = async (blocks: Block[]): Promise<void> => {
    for (const b of blocks) {
      const url = typeof b.props.url === "string" ? b.props.url : "";
      if (b.type === "image" && url.startsWith("pending:")) {
        const p = url.slice("pending:".length);
        let h = hashes.get(p);
        if (!h) {
          const bytes = images.get(p) ?? findCaseInsensitive(images, p)!;
          h = await sha256Hex(bytes);
          hashes.set(p, h); assets.set(h, bytes);
        }
        b.props.url = assetUrl(h);
      }
      await resolveImages(b.children);
    }
  };
  for (const f of mdFiles) { await resolveImages(f.page.blocks); if (opts.signal?.aborted) return null; }
  const usedImages = new Set(hashes.keys());
  for (const p of images.keys()) if (!usedImages.has(p)) report.omitted.push({ path: p, message: "Imagen que ninguna página usa" });

  // 4) Enlaces entre páginas: menciones [[ ]] y enlaces relativos a otros .md
  const mentionOf = (id: string, title: string): Inline => ({ type: "mention", pageId: id, title });
  const resolveLinks = (f: MdFile) => {
    const rewrite = (items: Inline[]): Inline[] => items.flatMap<Inline>((i) => {
      if (i.type === "mention" && i.pageId === "") {
        const name = i.title;
        const id = byPath.get(`${name}.md`.toLowerCase()) ?? byPath.get(`${name}.md`.toLowerCase().replace(/^.*\//, "")) ?? byPath.get(`${name.toLowerCase()}`) ?? byTitle.get(name.replace(/^.*\//, "").toLowerCase());
        const target = id ? mdFiles.find((m) => m.page.id === id) : undefined;
        if (target) return [mentionOf(target.page.id, target.title)];
        report.brokenLinks.push({ path: f.path, message: `Enlace [[${name}]] sin página de destino` });
        return [{ type: "text", text: name, styles: {} }];
      }
      if (i.type === "link" && !isExternal(i.href)) {
        const rel = decode(i.href.split("#")[0]!);
        const ext = extOf(rel);
        if (ext === "md" || ext === "markdown") {
          const target = resolveRel(dirOf(f.path), rel);
          const id = target ? byPath.get(target.toLowerCase()) : undefined;
          const tp = id ? mdFiles.find((m) => m.page.id === id) : undefined;
          if (tp) return [mentionOf(tp.page.id, tp.title)];
          report.brokenLinks.push({ path: f.path, message: `Enlace roto a ${rel}` });
        }
      }
      return [i];
    });
    const walk = (list: Block[]) => {
      for (const b of list) {
        if (Array.isArray(b.content)) b.content = rewrite(b.content);
        else if (b.content?.type === "table") b.content = { type: "table", rows: b.content.rows.map((row) => row.map(rewrite)) };
        walk(b.children);
      }
    };
    walk(f.page.blocks);
  };
  for (const f of mdFiles) resolveLinks(f);

  // 5) Bases de datos de Notion (CSV)
  const dbPages = new Map<string, PlanPage>(); // ruta del csv → página de base de datos
  const consumed = new Set<string>(); // md que pasan a ser filas
  for (const c of csvs) {
    const text = readText(c.data);
    const parsed = text === null ? null : Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
    if (!parsed || parsed.errors.length > 0 || !parsed.meta.fields || parsed.meta.fields.length === 0) {
      report.omitted.push({ path: c.path, message: "El CSV está dañado o no se pudo leer" });
      continue;
    }
    const [titleCol, ...cols] = parsed.meta.fields as [string, ...string[]];
    const folder = c.path.replace(/\.csv$/i, "");
    const rowFiles = mdFiles.filter((m) => dirOf(m.path) === folder);
    const database: PlanDatabase = { columns: cols.map((name) => ({ name, type: inferType(parsed.data.map((r) => r[name] ?? "")) })), rows: [] };
    for (const row of parsed.data) {
      const title = (row[titleCol] ?? "").trim();
      const match = rowFiles.find((m) => !consumed.has(m.path) && m.title.trim().toLowerCase() === title.toLowerCase());
      if (match) consumed.add(match.path);
      database.rows.push({ title, values: Object.fromEntries(cols.map((n) => [n, row[n] ?? ""])), blocks: match?.page.blocks ?? [], ...(match ? { pageId: match.page.id } : {}) });
    }
    const page: PlanPage = { id: newId(), title: clean(stem(baseOf(c.path))).trim() || "Base de datos", blocks: [], children: [], database };
    dbPages.set(c.path, page);
    report.imported.push({ path: c.path, message: `Base de datos con ${database.rows.length} fila(s) y ${cols.length + 1} columna(s)` });
  }

  // 6) Árbol de páginas a partir de las carpetas (una carpeta y un .md con el mismo nombre forman una sola página)
  const root: Node = { name: "", page: null, children: new Map(), hasContent: true };
  const nodeFor = (dirParts: string[]): Node => {
    let n = root;
    for (const part of dirParts) {
      let c = n.children.get(part);
      if (!c) { c = { name: part, page: null, children: new Map(), hasContent: false }; n.children.set(part, c); }
      n = c;
    }
    return n;
  };
  const markContent = (dirParts: string[]) => { let n = root; for (const part of dirParts) { n = n.children.get(part)!; n.hasContent = true; } };
  const pageOfFile = (m: MdFile) => m.page;
  const entries: { path: string; page: PlanPage }[] = [
    ...mdFiles.filter((m) => !consumed.has(m.path)).map((m) => ({ path: m.path, page: pageOfFile(m) })),
    ...[...dbPages].map(([path, page]) => ({ path, page })),
  ];
  for (const e of entries) {
    const dir = dirOf(e.path) === "" ? [] : dirOf(e.path).split("/");
    const holder = nodeFor(dir);
    markContent(dir);
    const name = stem(baseOf(e.path));
    const sibling = holder.children.get(name);
    if (sibling && sibling.page === null) { sibling.page = e.page; sibling.hasContent = true; }
    else if (!sibling) holder.children.set(name, { name, page: e.page, children: new Map(), hasContent: true });
    else holder.children.set(`${name}\u0000${e.path}`, { name, page: e.page, children: new Map(), hasContent: true });
  }
  const build = (n: Node): PlanPage[] => {
    const out: PlanPage[] = [];
    const kids = [...n.children.values()].filter((c) => c.hasContent).sort((a, b) => {
      const ta = (a.page?.title ?? clean(a.name)).toLowerCase(), tb = (b.page?.title ?? clean(b.name)).toLowerCase();
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });
    for (const c of kids) {
      const page = c.page ?? { id: newId(), title: clean(c.name).trim() || "Carpeta", blocks: [], children: [] };
      page.children.push(...build(c));
      out.push(page);
    }
    return out;
  };
  const container: PlanPage = { id: newId(), title: opts.name, blocks: [], children: build(root) };

  let pageCount = 1;
  const count = (p: PlanPage) => { for (const c of p.children) { pageCount++; count(c); } if (p.database) pageCount += p.database.rows.length; };
  count(container);
  for (const m of mdFiles) if (!consumed.has(m.path)) report.imported.push({ path: m.path, message: `Página «${m.title}»` });
  for (const m of mdFiles) if (consumed.has(m.path)) report.imported.push({ path: m.path, message: `Fila «${m.title}» de una base de datos` });

  return { root: container, assets, report, pageCount };
}

function inferType(values: string[]): "text" | "number" | "checkbox" | "date" {
  const v = values.map((x) => x.trim()).filter((x) => x !== "");
  if (v.length === 0) return "text";
  if (v.every((x) => /^(yes|no|true|false|sí|si)$/i.test(x))) return "checkbox";
  if (v.every((x) => /^-?\d+(\.\d+)?$/.test(x))) return "number";
  if (v.every((x) => /^\d{4}-\d{2}-\d{2}$/.test(x))) return "date";
  return "text";
}
