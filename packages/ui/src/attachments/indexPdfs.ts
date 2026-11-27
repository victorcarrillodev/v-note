import { AssetTextService, type AssetStore, type Clock, type SqlStore } from "@vnote/core";

type Reader = (bytes: Uint8Array) => Promise<string>;
const readPdf: Reader = async (bytes) => (await import("./pdf")).extractPdfText(bytes);

/** Lee los PDF que aún no están en la búsqueda, de uno en uno. Uno dañado se guarda vacío y no detiene a los demás. */
export async function indexPendingPdfs(store: SqlStore, assets: AssetStore, clock: Clock, read: Reader = readPdf): Promise<void> {
  const texts = new AssetTextService(store, clock);
  for (const pending of await texts.pending()) {
    const bytes = await assets.get(pending.hash);
    if (!bytes) continue; // el archivo aún no está: se reintenta otro día
    const text = await read(bytes).catch(() => "");
    await texts.save(pending, text);
  }
}
