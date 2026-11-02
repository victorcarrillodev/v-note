import { appError, err, ok, type Result } from "../result";
import { isValidHash } from "./hash";
import type { AssetStore } from "./assetStore";

/** GitHub rechaza archivos de más de 100 MB: por encima de esto el adjunto se guarda pero no entra en el respaldo (RF-3). */
export const MAX_BACKUP_FILE_BYTES = 100 * 1024 * 1024;

const PREFIX = "asset:";
export const assetUrl = (hash: string): string => `${PREFIX}${hash}`;
export function parseAssetUrl(url: string): string | null {
  if (!url.startsWith(PREFIX)) return null;
  const h = url.slice(PREFIX.length);
  return isValidHash(h) ? h : null;
}

export type Attachment = { hash: string; url: string; name: string; size: number; warning: "NOT_BACKED_UP" | null };

/** Guarda el archivo por contenido (el mismo nombre con distinto contenido coexiste, CL-21). Un fallo de almacenamiento no lanza. */
export async function attachFile(store: AssetStore, file: { name: string; data: Uint8Array }): Promise<Result<Attachment>> {
  const name = file.name.trim();
  if (name === "") return err(appError("INVALID", "El archivo necesita un nombre"));
  try {
    const info = await store.put(file.data);
    return ok({ hash: info.hash, url: assetUrl(info.hash), name, size: info.size, warning: info.size > MAX_BACKUP_FILE_BYTES ? "NOT_BACKED_UP" : null });
  } catch (e) {
    return err(appError("STORAGE", e instanceof Error ? e.message : "No se pudo guardar el archivo"));
  }
}
