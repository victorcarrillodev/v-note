// Codificación de la portada (plan 005, §5.1 y DP-4): decodificar respetando EXIF, reducir a 2560 px, aplanar sobre blanco y
// guardar JPEG 0,85. Es lo mismo en el worker y en el hilo principal; solo cambia quién aporta el lienzo.
import { coverOutputSize } from "@vnote/core";

export const COVER_JPEG_QUALITY = 0.85;

export type CoverErrorCode = "corrupt";
export class CoverImageError extends Error {
  constructor(readonly code: CoverErrorCode, message = "No se pudo procesar la imagen") { super(message); this.name = "CoverImageError"; }
}

export type Ctx2D = { fillStyle: string; fillRect(x: number, y: number, w: number, h: number): void; drawImage(image: never, x: number, y: number, w: number, h: number): void };
export type CoverCanvas = { getContext(type: "2d"): Ctx2D | null; convertToBlob(o: { type: string; quality: number }): Promise<Blob> };
export type Decoded = { width: number; height: number; close?: () => void };
export type EncodeDeps = { createBitmap: (blob: Blob, opts: { imageOrientation: "from-image" }) => Promise<Decoded>; makeCanvas: (w: number, h: number) => CoverCanvas };
export type EncodedCover = { jpeg: Uint8Array; sourceWidth: number; sourceHeight: number };

/** Bytes de un `Blob` (los navegadores tienen `arrayBuffer`; el entorno de pruebas solo `FileReader`). */
export const blobBytes = (blob: Blob): Promise<Uint8Array> =>
  typeof blob.arrayBuffer === "function"
    ? blob.arrayBuffer().then((b) => new Uint8Array(b))
    : new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer)); r.onerror = () => reject(r.error); r.readAsArrayBuffer(blob); });

/** Dibuja el mapa de bits sobre fondo blanco (el JPEG no admite transparencia) y lo codifica. */
export async function encodeCover(bitmap: Decoded, makeCanvas: EncodeDeps["makeCanvas"]): Promise<EncodedCover> {
  const { width, height } = coverOutputSize(bitmap.width, bitmap.height);
  const ctx = makeCanvas(width, height);
  const g = ctx.getContext("2d");
  if (!g) throw new CoverImageError("corrupt", "El lienzo no está disponible");
  g.fillStyle = "white";
  g.fillRect(0, 0, width, height);
  g.drawImage(bitmap as never, 0, 0, width, height);
  const blob = await ctx.convertToBlob({ type: "image/jpeg", quality: COVER_JPEG_QUALITY });
  const jpeg = await blobBytes(blob);
  bitmap.close?.();
  return { jpeg, sourceWidth: bitmap.width, sourceHeight: bitmap.height };
}

/** Decodifica los bytes (con la orientación EXIF) y los codifica. Un fallo de decodificación es «imagen dañada». */
export async function decodeAndEncode(bytes: Uint8Array, deps: EncodeDeps): Promise<EncodedCover> {
  let bitmap: Decoded;
  try {
    bitmap = await deps.createBitmap(new Blob([bytes as BlobPart]), { imageOrientation: "from-image" });
  } catch {
    throw new CoverImageError("corrupt");
  }
  return encodeCover(bitmap, deps.makeCanvas);
}

/** Dependencias reales del navegador (`createImageBitmap` y `OffscreenCanvas`). */
export const browserEncodeDeps = (): EncodeDeps => ({
  createBitmap: (blob, opts) => createImageBitmap(blob, opts),
  makeCanvas: (w, h) => new OffscreenCanvas(w, h) as unknown as CoverCanvas,
});
