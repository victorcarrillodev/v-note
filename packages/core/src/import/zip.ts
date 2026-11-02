import { unzipSync } from "fflate";
import { appError, err, ok, type Result } from "../result";
import type { SourceFile } from "./types";

const JUNK = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)(\/|$)/;

/** Normaliza la ruta de una entrada: `/` como separador, sin `./` ni `..`, en forma NFC. */
export function cleanPath(path: string): string | null {
  const parts = path.replace(/\\/g, "/").normalize("NFC").split("/").filter((p) => p !== "" && p !== ".");
  return parts.length === 0 || parts.includes("..") ? null : parts.join("/");
}

/** Lee un ZIP completo en memoria. Omite carpetas y basura del sistema; un archivo dañado devuelve un error (nunca lanza). */
export function readZip(bytes: Uint8Array): Result<SourceFile[]> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch (e) {
    return err(appError("INVALID", "El archivo ZIP está dañado o no es un ZIP válido", { cause: e instanceof Error ? e.message : String(e) }));
  }
  const files: SourceFile[] = [];
  for (const [raw, data] of Object.entries(entries)) {
    if (raw.endsWith("/") || JUNK.test(raw)) continue;
    const path = cleanPath(raw);
    if (path) files.push({ path, data });
  }
  if (files.length === 0) return err(appError("INVALID", "El ZIP no contiene archivos", { reason: "EMPTY" }));
  return ok(files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)));
}
