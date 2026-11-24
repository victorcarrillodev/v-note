import type { BackupError } from "./githubClient";

export type DestinationKind = "local-folder" | "google-drive" | "dropbox" | "github";

export type ManifestEntry = {
  sha256: string;
  size: number;
  /** Identificador remoto del archivo (p. ej. fileId en Google Drive) para actualizar in-place sin duplicados. */
  remoteId?: string;
};

export type RemoteManifest = {
  version: 3;
  updatedAt: number;
  files: Record<string, ManifestEntry>;
};

export type FileChange = {
  path: string;
  bytes: Uint8Array;
  sha256: string;
  size: number;
  /** Presente si el archivo ya existía en el manifiesto remoto y tiene remoteId. */
  remoteId?: string;
};

export type SyncReceipt = {
  manifest: RemoteManifest;
  uploaded: number;
  updated: number;
  removed: number;
};

export type DestinationInfo = {
  kind: DestinationKind;
  label: string;
  writable: boolean;
};

export type DestResult<T> = { ok: true; value: T } | { ok: false; error: BackupError };

/** Puerto único para cualquier destino de respaldo unificado (carpeta local, Drive, Dropbox, GitHub). */
export interface BackupDestination {
  readonly kind: DestinationKind;
  checkConnection(signal?: AbortSignal): Promise<DestResult<DestinationInfo>>;
  readManifest(signal?: AbortSignal): Promise<DestResult<RemoteManifest | null>>;
  applyChanges(
    ops: { put: FileChange[]; remove: string[]; nextManifest: RemoteManifest },
    opts?: { signal?: AbortSignal },
  ): Promise<DestResult<SyncReceipt>>;
  downloadAll(opts?: { signal?: AbortSignal }): Promise<DestResult<Map<string, Uint8Array>>>;
}

export const MANIFEST_PATH = "backup-manifest.json";

/** Calcula el SHA-256 en hexadecimal minúscula usando Web Crypto (disponible en Bun, navegadores y Workers). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", copy.buffer);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type ManifestDiff = {
  put: FileChange[];
  remove: string[];
  nextManifest: RemoteManifest;
  unchangedCount: number;
};

/**
 * Compara los archivos locales contra el último manifiesto conocido.
 * Solo marca para subida los archivos nuevos o modificados (conservando `remoteId`) y para borrado los eliminados.
 */
export async function diffManifest(
  files: Map<string, Uint8Array>,
  prev: RemoteManifest | null,
  nowMs: number,
): Promise<ManifestDiff> {
  const put: FileChange[] = [];
  const nextFiles: Record<string, ManifestEntry> = {};
  let unchangedCount = 0;

  const sortedPaths = [...files.keys()].sort();
  for (const path of sortedPaths) {
    const bytes = files.get(path)!;
    const sha256 = await sha256Hex(bytes);
    const prevEntry = prev?.files[path];
    if (prevEntry && prevEntry.sha256 === sha256) {
      unchangedCount++;
      nextFiles[path] = prevEntry;
      continue;
    }
    const entry: ManifestEntry = {
      sha256,
      size: bytes.byteLength,
      ...(prevEntry?.remoteId ? { remoteId: prevEntry.remoteId } : {}),
    };
    nextFiles[path] = entry;
    put.push({
      path,
      bytes,
      sha256,
      size: bytes.byteLength,
      ...(prevEntry?.remoteId ? { remoteId: prevEntry.remoteId } : {}),
    });
  }

  const remove: string[] = [];
  if (prev) {
    for (const oldPath of Object.keys(prev.files).sort()) {
      if (!files.has(oldPath)) remove.push(oldPath);
    }
  }

  return {
    put,
    remove,
    nextManifest: { version: 3, updatedAt: nowMs, files: nextFiles },
    unchangedCount,
  };
}

export type SyncOutcome =
  | { status: "unchanged"; manifest: RemoteManifest | null }
  | { status: "success"; receipt: SyncReceipt }
  | { status: "cancelled" }
  | { status: "failed"; error: BackupError };

/** Sincroniza una instantánea con un destino sin escribir nada si no hubo cambios reales. */
export async function syncWithDestination(
  dest: BackupDestination,
  files: Map<string, Uint8Array>,
  nowMs: number,
  opts: { cachedManifest?: RemoteManifest | null; signal?: AbortSignal } = {},
): Promise<SyncOutcome> {
  if (opts.signal?.aborted) return { status: "cancelled" };

  let prev = opts.cachedManifest;
  if (prev === undefined) {
    const read = await dest.readManifest(opts.signal);
    if (!read.ok) return { status: "failed", error: read.error };
    prev = read.value;
  }
  if (opts.signal?.aborted) return { status: "cancelled" };

  const diff = await diffManifest(files, prev, nowMs);
  if (diff.put.length === 0 && diff.remove.length === 0) {
    return { status: "unchanged", manifest: prev };
  }
  if (opts.signal?.aborted) return { status: "cancelled" };

  const applied = await dest.applyChanges(
    { put: diff.put, remove: diff.remove, nextManifest: diff.nextManifest },
    opts.signal ? { signal: opts.signal } : undefined,
  );
  if (!applied.ok) return { status: "failed", error: applied.error };
  return { status: "success", receipt: applied.value };
}
