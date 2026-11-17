import * as Y from "yjs";
import type { SqlStore } from "../ports/sqlStore";
import type { AssetStore } from "./assetStore";
import { DocStore } from "../docs/docStore";
import { systemClock } from "../clock";
import { fromYjs } from "../blocks/fromYjs";
import { appError, err, ok, type Result } from "../result";
import { isValidHash } from "./hash";

// Cualquier SHA-256 cuenta: `asset:<hash>` (portadas, documentos) y también `{"hash": "<hash>"}` (celdas de archivos).
// En un tramo hexadecimal más largo (p. ej. bytes de Yjs pegados al texto) cuenta cada ventana de 64: ser conservador
// solo cuesta conservar algún archivo de más; quedarse corto borraría datos.
const HEX_RUN = /[0-9a-f]{64,}/g;
const DOCS_TABLE = "page_docs";
const decoder = new TextDecoder("utf-8", { fatal: false });

/** Añade a `into` cada posible hash de archivo (64 hexadecimales en minúscula) que aparezca en el texto. */
export function assetRefsIn(text: string, into: Set<string>): void {
  for (const [run] of text.matchAll(HEX_RUN)) for (let i = 0; i + 64 <= run.length; i++) into.add(run.slice(i, i + 64));
}

/**
 * Referencias a archivos de todo el espacio (plan 005, §5.4 y DP-9): cualquier texto guardado en cualquier tabla
 * (portadas de páginas vivas y en la papelera, celdas, vistas, `meta`…) y el contenido de cada documento Yjs.
 * Recorre todas las tablas a propósito: una tabla nueva que guarde `asset:` queda cubierta sin tocar este código.
 * Si cualquier lectura falla, devuelve error: quien limpia no debe borrar con una lista incompleta.
 */
export async function collectAssetRefs(db: SqlStore): Promise<Result<Set<string>>> {
  const refs = new Set<string>();
  try {
    const tables = await db.query<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    for (const { name } of tables) {
      if (name === DOCS_TABLE) continue;
      for (const row of await db.query(`SELECT * FROM "${name.replaceAll('"', '""')}"`)) {
        for (const v of Object.values(row)) if (typeof v === "string") assetRefsIn(v, refs);
      }
    }
    const docs = new DocStore(db, systemClock);
    for (const { page_id } of await db.query<{ page_id: string }>(`SELECT DISTINCT page_id FROM ${DOCS_TABLE} ORDER BY page_id`)) {
      const doc = await docs.loadIn(db, page_id);
      // Estado completo (atributos de cualquier tipo raíz, también diagramas) y bloques ya convertidos (texto partido en varios items).
      assetRefsIn(decoder.decode(Y.encodeStateAsUpdate(doc)), refs);
      assetRefsIn(JSON.stringify(fromYjs(doc.getXmlFragment("doc"))), refs);
    }
  } catch (e) {
    return err(appError("STORAGE", "No se pudieron leer las referencias a archivos", { cause: String(e) }));
  }
  return ok(refs);
}

/**
 * Borra del almacén los archivos que nada usa (RF-2.8). Se llama al abrir el espacio, no durante la sesión,
 * para que deshacer un cambio de portada siga encontrando su archivo. La lista del almacén se toma ANTES de
 * recoger referencias: un archivo guardado mientras tanto no está en la lista y no se borra.
 * Si algo falla antes de borrar, no se borra nada (DP-9). Idempotente.
 */
export async function gcAssets(deps: { store: SqlStore; assets: AssetStore }): Promise<Result<{ removed: string[] }>> {
  let stored: string[];
  try {
    stored = await deps.assets.list();
  } catch (e) {
    return err(appError("STORAGE", "No se pudo listar el almacén de archivos", { cause: String(e) }));
  }
  const refs = await collectAssetRefs(deps.store);
  if (!refs.ok) return refs;
  const removed: string[] = [];
  for (const hash of [...stored].sort()) {
    if (refs.value.has(hash) || !isValidHash(hash)) continue; // un nombre raro en el almacén nunca se toca
    try {
      await deps.assets.delete(hash);
      removed.push(hash);
    } catch (e) {
      return err(appError("STORAGE", "No se pudo borrar un archivo sin uso", { cause: String(e), removed }));
    }
  }
  return ok({ removed });
}
