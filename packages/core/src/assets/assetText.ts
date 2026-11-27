import type { Block } from "../blocks/types";
import { fromYjs } from "../blocks/fromYjs";
import { DocStore } from "../docs/docStore";
import type { Clock } from "../clock";
import type { SqlExecutor, SqlStore } from "../ports/sqlStore";
import { blocksToPlainText } from "../search/plainText";
import { parseAssetUrl } from "./attach";

/** Tope de texto indexado por adjunto: de sobra para un libro y sin inflar la base. */
const MAX_TEXT = 500_000;

/** Hashes de los PDF adjuntos en los bloques (sin repetir, también anidados). */
export function pdfHashesIn(blocks: Block[]): string[] {
  const found = new Set<string>();
  const walk = (list: Block[]) => {
    for (const b of list) {
      if (b.type === "file" && typeof b.props.name === "string" && /\.pdf$/i.test(b.props.name) && typeof b.props.url === "string") {
        const hash = parseAssetUrl(b.props.url);
        if (hash) found.add(hash);
      }
      walk(b.children);
    }
  };
  walk(blocks);
  return [...found];
}

/** Cuerpo del índice de búsqueda: el texto de la página más el de sus PDF ya leídos. */
export async function searchBodyIn(ex: SqlExecutor, blocks: Block[]): Promise<string> {
  const lines = [blocksToPlainText(blocks)];
  for (const hash of pdfHashesIn(blocks)) {
    const row = (await ex.query<{ text: string }>("SELECT text FROM asset_text WHERE hash = ?", [hash]))[0];
    if (row?.text) lines.push(row.text);
  }
  return lines.join("\n");
}

export type PendingPdf = { hash: string; pageIds: string[] };

/** Texto extraído de los adjuntos. Es un índice derivado: no se respalda y se vuelve a leer del archivo. */
export class AssetTextService {
  private docs: DocStore;
  constructor(private db: SqlStore, clock: Clock) { this.docs = new DocStore(db, clock); }

  /** PDF usados en páginas que todavía no se han leído. */
  async pending(): Promise<PendingPdf[]> {
    // El nombre del archivo ya está en el índice: solo se abren los documentos que mencionan un .pdf.
    const pages = await this.db.query<{ page_id: string }>("SELECT page_id FROM page_text WHERE body LIKE '%.pdf%'");
    const found = new Map<string, string[]>();
    for (const { page_id } of pages) {
      const doc = await this.docs.loadIn(this.db, page_id);
      for (const hash of pdfHashesIn(fromYjs(doc.getXmlFragment("doc")))) found.set(hash, [...(found.get(hash) ?? []), page_id]);
    }
    const read = new Set((await this.db.query<{ hash: string }>("SELECT hash FROM asset_text")).map((r) => r.hash));
    return [...found].filter(([hash]) => !read.has(hash)).map(([hash, pageIds]) => ({ hash, pageIds }));
  }

  /** Guarda el texto (vacío si no tiene o no se pudo leer, para no reintentar) y reindexa sus páginas. */
  async save({ hash, pageIds }: PendingPdf, text: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.exec("INSERT OR REPLACE INTO asset_text(hash, text) VALUES (?, ?)", [hash, text.slice(0, MAX_TEXT)]);
      for (const id of pageIds) {
        const page = (await tx.query<{ title: string }>("SELECT title FROM pages WHERE id = ?", [id]))[0];
        if (!page) continue;
        const doc = await this.docs.loadIn(tx, id);
        const body = await searchBodyIn(tx, fromYjs(doc.getXmlFragment("doc")));
        await tx.exec("DELETE FROM page_text WHERE page_id = ?", [id]);
        await tx.exec("INSERT INTO page_text(page_id, title, body) VALUES (?, ?, ?)", [id, page.title, body]);
      }
    });
  }
}
