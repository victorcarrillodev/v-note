// Importar una imagen como portada (plan 005, §5.1): validar, decodificar y optimizar, guardar y escribir las propiedades.
// Cualquier fallo en cualquier paso deja la portada anterior intacta (RF-2.3).
import { isLowResolution, validateCoverInput, MAX_COVER_INPUT_BYTES, type AssetStore, type CoverCredit, type Result } from "@vnote/core";
import { blobBytes, type EncodedCover } from "./encode";
import { optimizeCover } from "./optimize";

export type CoverImportError = "empty" | "tooLarge" | "unsupported" | "corrupt" | "save";
export type CoverImportResult = { ok: true; lowRes: boolean } | { ok: false; error: CoverImportError };

export type CoverImportDeps = {
  assets: AssetStore;
  /** Escribe las propiedades de la página (portada y crédito en una sola entrada del historial). */
  setProps: (patch: { cover: string; coverCredit: CoverCredit | null }) => Promise<Result<unknown>>;
  optimize?: (bytes: Uint8Array) => Promise<EncodedCover>;
};

export async function importCoverImage(file: Blob, deps: CoverImportDeps): Promise<CoverImportResult> {
  if (file.size > MAX_COVER_INPUT_BYTES) return { ok: false, error: "tooLarge" };
  let bytes: Uint8Array;
  try { bytes = await blobBytes(file); } catch { return { ok: false, error: "corrupt" }; }
  return importCoverBytes(bytes, deps, null);
}

/**
 * Valida, optimiza, guarda y escribe la portada a partir de los bytes de una imagen (de un archivo o descargada de Unsplash).
 * `credit` se guarda junto con la portada en la misma entrada del historial (RF-2.5).
 */
export async function importCoverBytes(bytes: Uint8Array, deps: CoverImportDeps, credit: CoverCredit | null): Promise<CoverImportResult> {
  const v = validateCoverInput(bytes.subarray(0, 16), bytes.length);
  if (!v.ok) return { ok: false, error: v.error };
  let encoded: EncodedCover;
  try { encoded = await (deps.optimize ?? ((b) => optimizeCover(b)))(bytes); } catch { return { ok: false, error: "corrupt" }; }
  let hash: string;
  try { hash = (await deps.assets.put(encoded.jpeg)).hash; } catch { return { ok: false, error: "save" }; }
  const saved = await deps.setProps({ cover: `asset:${hash}`, coverCredit: credit });
  if (!saved.ok) return { ok: false, error: "save" };
  return { ok: true, lowRes: isLowResolution(encoded.sourceWidth) };
}
