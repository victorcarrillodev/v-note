import { appError, err, ok, type Result } from "../result";
import type { WorkspaceManager } from "./workspaceManager";

/** Operaciones de carpetas que el cascarón de escritorio implementa (la lógica de mover no toca el sistema de archivos). */
export interface FolderOps {
  inspect(path: string): Promise<{ exists: boolean; writable: boolean; freeBytes: number }>;
  sizeOf(path: string): Promise<number>;
  /** Copia recursiva completa de `from` a `to` (crea `to`). */
  copyTree(from: string, to: string): Promise<void>;
  /** Huella (p. ej. SHA-256) de cada archivo, por ruta relativa. */
  checksums(path: string): Promise<Record<string, string>>;
  removeTree(path: string): Promise<void>;
}

/** Comprueba que la carpeta existe, se puede escribir y cabe el espacio, ANTES de mover nada (RF-25). */
export async function validateTargetFolder(ops: FolderOps, folder: string, requiredBytes: number): Promise<Result<void>> {
  const info = await ops.inspect(folder);
  if (!info.exists) return err(appError("INVALID", "La carpeta elegida no existe", { reason: "FOLDER_MISSING", folder }));
  if (!info.writable) return err(appError("INVALID", "No se puede escribir en la carpeta elegida", { reason: "NOT_WRITABLE", folder }));
  if (info.freeBytes < requiredBytes) {
    return err(appError("INVALID", "La carpeta elegida no tiene espacio suficiente", { reason: "NO_SPACE", folder, neededBytes: requiredBytes, freeBytes: info.freeBytes }));
  }
  return ok(undefined);
}

const same = (a: Record<string, string>, b: Record<string, string>) => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
};

/**
 * Mueve un espacio a otra carpeta: valida, copia, verifica huellas y SOLO entonces cambia la ubicación y borra la anterior.
 * Cualquier fallo antes del cambio deja la ubicación anterior intacta y elimina la copia parcial (RF-25, CL-36).
 */
export async function moveWorkspace(mgr: WorkspaceManager, ops: FolderOps, id: string, targetFolder: string): Promise<Result<{ location: string; oldRemoved: boolean }>> {
  const list = await mgr.list();
  if (!list.ok) return list;
  const ws = list.value.find((w) => w.id === id);
  if (!ws) return err(appError("NOT_FOUND", "El espacio de trabajo no existe", { id }));

  const valid = await validateTargetFolder(ops, targetFolder, await ops.sizeOf(ws.location));
  if (!valid.ok) return valid;

  const target = `${targetFolder.replace(/[\\/]+$/, "")}/${ws.id}`;
  await mgr.closeWorkspace(id); // vacía y cierra la base para copiar un estado consistente
  const cleanup = () => ops.removeTree(target).catch(() => {});

  try {
    await ops.copyTree(ws.location, target);
  } catch (e) {
    await cleanup();
    return err(appError("STORAGE", e instanceof Error ? e.message : "No se pudo copiar el espacio", { reason: "COPY_FAILED" }));
  }
  let verified = false;
  try {
    verified = same(await ops.checksums(ws.location), await ops.checksums(target));
  } catch { /* se trata como no verificado */ }
  if (!verified) {
    await cleanup();
    return err(appError("STORAGE", "La copia no coincide con el original; no se cambió nada", { reason: "VERIFY_FAILED" }));
  }

  try {
    await mgr.relocate(id, target);
  } catch (e) {
    await cleanup();
    return err(appError("STORAGE", e instanceof Error ? e.message : "No se pudo guardar la nueva ubicación", { reason: "SWITCH_FAILED" }));
  }

  let oldRemoved = true;
  try { await ops.removeTree(ws.location); } catch { oldRemoved = false; }
  return ok({ location: target, oldRemoved });
}
