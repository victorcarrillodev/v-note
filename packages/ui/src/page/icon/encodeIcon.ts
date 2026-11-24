// Imagen de ícono: recorte cuadrado centrado, reducido a 256 px como máximo y guardado como PNG (conserva la transparencia).
import { blobBytes } from "../cover/encode";

export const ICON_MAX_PX = 256;

/** Bytes de entrada → PNG cuadrado. Lanza si el navegador no puede decodificar la imagen. */
export async function encodeIconPng(bytes: Uint8Array): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart]), { imageOrientation: "from-image" });
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const out = Math.min(ICON_MAX_PX, side);
    const sx = (bitmap.width - side) / 2, sy = (bitmap.height - side) / 2;
    if (typeof OffscreenCanvas !== "undefined") {
      const c = new OffscreenCanvas(out, out);
      c.getContext("2d")!.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);
      return blobBytes(await c.convertToBlob({ type: "image/png" }));
    }
    const c = document.createElement("canvas");
    c.width = out; c.height = out;
    c.getContext("2d")!.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
    if (!blob) throw new Error("png");
    return blobBytes(blob);
  } finally { bitmap.close(); }
}
