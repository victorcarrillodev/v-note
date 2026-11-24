// Subir una imagen como ícono de página: validar, recortar y reducir, guardar en el almacén y escribir el campo `icon`.
// Cualquier fallo deja el ícono anterior intacto.
import { formatIconImage, validateCoverInput, MAX_COVER_INPUT_BYTES, type AssetStore, type Result } from "@vnote/core";
import { blobBytes } from "../cover/encode";
import { encodeIconPng } from "./encodeIcon";

export type IconImportError = "empty" | "tooLarge" | "unsupported" | "corrupt" | "save";
export type IconImportDeps = { assets: AssetStore; setIcon: (icon: string) => Promise<Result<unknown>>; encode?: (bytes: Uint8Array) => Promise<Uint8Array> };

export async function importIconImage(file: Blob, deps: IconImportDeps): Promise<{ ok: true } | { ok: false; error: IconImportError }> {
  if (file.size > MAX_COVER_INPUT_BYTES) return { ok: false, error: "tooLarge" };
  let bytes: Uint8Array;
  try { bytes = await blobBytes(file); } catch { return { ok: false, error: "corrupt" }; }
  const v = validateCoverInput(bytes.subarray(0, 16), bytes.length);
  if (!v.ok) return { ok: false, error: v.error };
  let png: Uint8Array;
  try { png = await (deps.encode ?? encodeIconPng)(bytes); } catch { return { ok: false, error: "corrupt" }; }
  let hash: string;
  try { hash = (await deps.assets.put(png)).hash; } catch { return { ok: false, error: "save" }; }
  const saved = await deps.setIcon(formatIconImage(hash));
  return saved.ok ? { ok: true } : { ok: false, error: "save" };
}
