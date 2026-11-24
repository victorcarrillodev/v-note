import { err, ok } from "../result";
import type { BackupError, FetchLike } from "./githubClient";
import {
  MANIFEST_PATH,
  type BackupDestination,
  type DestinationInfo,
  type DestResult,
  type FileChange,
  type RemoteManifest,
  type SyncReceipt,
} from "./destination";

const enc = new TextEncoder();
const dec = new TextDecoder();

function mapDriveError(status: number, body: string): BackupError {
  if (status === 401 || status === 403) return { kind: "AUTH", message: "Sesión de Google Drive expirada o sin permisos", retryable: false };
  if (status === 429) return { kind: "RATE_LIMIT", message: "Límite de peticiones de Google Drive alcanzado", retryable: true };
  if (status >= 500) return { kind: "SERVER", message: `Error de Google Drive (${status})`, retryable: true };
  return { kind: "UNKNOWN", message: body || `Error HTTP ${status}`, retryable: false };
}

/**
 * Destino en Google Drive API v3:
 * Guarda `remoteId` por archivo en `backup-manifest.json` y actualiza in-place con `PATCH`
 * para no crear archivos duplicados con el mismo nombre.
 */
export class GoogleDriveDestination implements BackupDestination {
  readonly kind = "google-drive" as const;
  private manifestFileId: string | null = null;
  private prevFiles: RemoteManifest["files"] = {};

  constructor(
    private d: {
      fetch: FetchLike;
      getAccessToken: () => Promise<string | null>;
      folderId: string;
      label?: string;
    },
  ) {}

  private async authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string> | null> {
    const token = await this.d.getAccessToken();
    if (!token) return null;
    return { Authorization: `Bearer ${token}`, ...extra };
  }

  async checkConnection(signal?: AbortSignal): Promise<DestResult<DestinationInfo>> {
    const headers = await this.authHeaders();
    if (!headers) return err({ kind: "AUTH", message: "Falta autorización de Google Drive", retryable: false });
    try {
      const r = await this.d.fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(this.d.folderId)}?fields=id,name`, {
        headers,
        ...(signal ? { signal } : {}),
      });
      if (r.status < 200 || r.status >= 300) return err(mapDriveError(r.status, await r.text()));
      const data = (await r.json()) as { name?: string };
      return ok({ kind: "google-drive", label: this.d.label ?? data.name ?? "Google Drive", writable: true });
    } catch (e) {
      return err({ kind: "OFFLINE", message: e instanceof Error ? e.message : String(e), retryable: true });
    }
  }

  async readManifest(signal?: AbortSignal): Promise<DestResult<RemoteManifest | null>> {
    const headers = await this.authHeaders();
    if (!headers) return err({ kind: "AUTH", message: "Falta autorización de Google Drive", retryable: false });
    try {
      const q = encodeURIComponent(`'${this.d.folderId}' in parents and name='${MANIFEST_PATH}' and trashed=false`);
      const listRes = await this.d.fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
        headers,
        ...(signal ? { signal } : {}),
      });
      if (listRes.status < 200 || listRes.status >= 300) return err(mapDriveError(listRes.status, await listRes.text()));
      const listJson = (await listRes.json()) as { files?: { id: string }[] };
      const id = listJson.files?.[0]?.id;
      if (!id) {
        this.manifestFileId = null;
        this.prevFiles = {};
        return ok(null);
      }
      this.manifestFileId = id;
      const dl = await this.d.fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`, {
        headers,
        ...(signal ? { signal } : {}),
      });
      if (dl.status < 200 || dl.status >= 300) return err(mapDriveError(dl.status, await dl.text()));
      const manifest = (await dl.json()) as RemoteManifest;
      this.prevFiles = manifest.files ?? {};
      return ok(manifest);
    } catch (e) {
      return err({ kind: "OFFLINE", message: e instanceof Error ? e.message : String(e), retryable: true });
    }
  }

  private async upsertFile(name: string, bytes: Uint8Array, existingId: string | undefined, signal?: AbortSignal): Promise<DestResult<string>> {
    const headers = await this.authHeaders();
    if (!headers) return err({ kind: "AUTH", message: "Falta autorización de Google Drive", retryable: false });

    if (existingId) {
      const r = await this.d.fetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingId)}?uploadType=media`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/octet-stream" },
        body: dec.decode(bytes),
        ...(signal ? { signal } : {}),
      });
      if (r.status < 200 || r.status >= 300) return err(mapDriveError(r.status, await r.text()));
      return ok(existingId);
    }

    const boundary = "vnote_drive_boundary";
    const metaPart = JSON.stringify({ name, parents: [this.d.folderId] });
    const payload = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaPart}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n${dec.decode(bytes)}\r\n--${boundary}--`;
    const r = await this.d.fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
      method: "POST",
      headers: { ...headers, "Content-Type": `multipart/related; boundary=${boundary}` },
      body: payload,
      ...(signal ? { signal } : {}),
    });
    if (r.status < 200 || r.status >= 300) return err(mapDriveError(r.status, await r.text()));
    const created = (await r.json()) as { id: string };
    return ok(created.id);
  }

  async applyChanges(
    ops: { put: FileChange[]; remove: string[]; nextManifest: RemoteManifest },
    opts?: { signal?: AbortSignal },
  ): Promise<DestResult<SyncReceipt>> {
    const headers = await this.authHeaders();
    if (!headers) return err({ kind: "AUTH", message: "Falta autorización de Google Drive", retryable: false });

    const updatedManifest: RemoteManifest = {
      ...ops.nextManifest,
      files: { ...ops.nextManifest.files },
    };
    let uploaded = 0;
    let updated = 0;

    try {
      for (const f of ops.put) {
        if (opts?.signal?.aborted) return err({ kind: "UNKNOWN", message: "Cancelado", retryable: false });
        const existingId = f.remoteId ?? this.prevFiles[f.path]?.remoteId;
        const up = await this.upsertFile(f.path, f.bytes, existingId, opts?.signal);
        if (!up.ok) return up;
        updatedManifest.files[f.path] = { ...updatedManifest.files[f.path]!, remoteId: up.value };
        if (existingId) updated++;
        else uploaded++;
      }

      for (const p of ops.remove) {
        if (opts?.signal?.aborted) return err({ kind: "UNKNOWN", message: "Cancelado", retryable: false });
        const rid = this.prevFiles[p]?.remoteId;
        if (!rid) continue;
        const del = await this.d.fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(rid)}`, {
          method: "DELETE",
          headers,
          ...(opts?.signal ? { signal: opts.signal } : {}),
        });
        if (del.status < 200 || del.status >= 300) return err(mapDriveError(del.status, await del.text()));
      }

      const manifestBytes = enc.encode(JSON.stringify(updatedManifest, null, 2));
      const mUp = await this.upsertFile(MANIFEST_PATH, manifestBytes, this.manifestFileId ?? undefined, opts?.signal);
      if (!mUp.ok) return mUp;
      this.manifestFileId = mUp.value;
      this.prevFiles = updatedManifest.files;

      return ok({ manifest: updatedManifest, uploaded, updated, removed: ops.remove.length });
    } catch (e) {
      return err({ kind: "OFFLINE", message: e instanceof Error ? e.message : String(e), retryable: true });
    }
  }

  async downloadAll(opts?: { signal?: AbortSignal }): Promise<DestResult<Map<string, Uint8Array>>> {
    const mRes = await this.readManifest(opts?.signal);
    if (!mRes.ok) return mRes;
    const manifest = mRes.value;
    if (!manifest) return ok(new Map());

    const headers = await this.authHeaders();
    if (!headers) return err({ kind: "AUTH", message: "Falta autorización de Google Drive", retryable: false });

    const out = new Map<string, Uint8Array>();
    try {
      for (const [path, entry] of Object.entries(manifest.files)) {
        if (!entry.remoteId) continue;
        const r = await this.d.fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(entry.remoteId)}?alt=media`, {
          headers,
          ...(opts?.signal ? { signal: opts.signal } : {}),
        });
        if (r.status < 200 || r.status >= 300) return err(mapDriveError(r.status, await r.text()));
        out.set(path, enc.encode(await r.text()));
      }
      return ok(out);
    } catch (e) {
      return err({ kind: "OFFLINE", message: e instanceof Error ? e.message : String(e), retryable: true });
    }
  }
}
