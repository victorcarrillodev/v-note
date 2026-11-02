const HASH = /^[0-9a-f]{64}$/;

/** Un hash válido son 64 hexadecimales en minúscula: nunca una ruta (evita escapar de la carpeta de adjuntos). */
export const isValidHash = (s: string): boolean => HASH.test(s);

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
