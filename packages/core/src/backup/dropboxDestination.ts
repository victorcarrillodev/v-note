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

function mapDropboxError(status: number, body: string): BackupError {
  if (status === 401) return { kind: "AUTH", message: "Sesión de Dropbox expirada o inválida", retryable: false };
  if (status === 429) return { kind: "RATE_LIMIT", message: "Límite de peticiones de Dropbox alcanzado", retryable: true };
  if (status >= 500) return { kind: "SERVER", message: `Error de Dropbox (${status})`, retryable: true };
  return { kind: "UNKNOWN", message: body || `Error HTTP ${status}`, retryable: false };
}

/**
 * Destino en Dropbox API v2:
 * Sube con `mode: "overwrite"` y `mute: true` para actualizar archivos sin duplicados ni ruido.
 */
export class DropboxDestination implements BackupDestination {
  readonly kind = "dropbox" as const;
  private readonly basePath: string;

  constructor(
    private d: {
      fetch: FetchLike;
      getAccessToken: () => Promise<string | null>;
      basePath?: string;
      label?: string;
    },
  ) {
    this.basePath = (d.basePath ?? "/v-note-backup").replace(/\/+$/, "");
  }

  private fullPath(rel: string): string {
    return `${this.basePath}/${rel.replace(/^\/+/, "")}`;
  }

  async checkConnection(signal?: AbortSignal): Promise<DestResult<DestinationInfo>> {
    const token = await this.d.getAccessToken();
    if (!token) return err({ kind: "AUTH", message: "Falta autorización de Dropbox", retryable: false });
    try {
      const r = await this.d.fetch("https://api.dropboxapi.com/2/users/get_current_account", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        ...(signal ? { signal } : {}),
      });
      if (r.status < 200 || r.status >= 300) return err(mapDropboxError(r.status, await r.text()));
      return ok({ kind: "dropbox", label: this.d.label ?? "Dropbox", writable: true });
    } catch (e) {
      return err({ kind: "OFFLINE", message: e instanceof Error ? e.message : String(e), retryable: true });
    }
  }

  async readManifest(signal?: AbortSignal): Promise<DestResult<RemoteManifest | null>> {
    const token = await this.d.getAccessToken();
    if (!token) return err({ kind: "AUTH", message: "Falta autorización de Dropbox", retryable: false });
    try {
      const r = await this.d.fetch("https://content.dropboxapi.com/2/files/download", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Dropbox-API-Arg": JSON.stringify({ path: this.fullPath(MANIFEST_PATH) }),
        },
        ...(signal ? { signal } : {}),
      });
      if (r.status === 409) return ok(null);
      if (r.status < 200 || r.status >= 300) return err(mapDropboxError(r.status, await r.text()));
      return ok((await r.json()) as RemoteManifest);
    } catch (e) {
      return err({ kind: "OFFLINE", message: e instanceof Error ? e.message : String(e), retryable: true });
    }
  }

  async applyChanges(
    ops: { put: FileChange[]; remove: string[]; nextManifest: RemoteManifest },
    opts?: { signal?: AbortSignal },
  ): Promise<DestResult<SyncReceipt>> {
    const token = await this.d.getAccessToken();
    if (!token) return err({ kind: "AUTH", message: "Falta autorización de Dropbox", retryable: false });

    const prevRes = await this.readManifest(opts?.signal);
    const prevFiles = prevRes.ok && prevRes.value ? prevRes.value.files : {};
    let uploaded = 0;
    let updated = 0;

    try {
      for (const f of ops.put) {
        if (opts?.signal?.aborted) return err({ kind: "UNKNOWN", message: "Cancelado", retryable: false });
        const r = await this.d.fetch("https://content.dropboxapi.com/2/files/upload", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/octet-stream",
            "Dropbox-API-Arg": JSON.stringify({ path: this.fullPath(f.path), mode: "overwrite", mute: true }),
          },
          body: dec.decode(f.bytes),
          ...(opts?.signal ? { signal: opts.signal } : {}),
        });
        if (r.status < 200 || r.status >= 300) return err(mapDropboxError(r.status, await r.text()));
        if (prevFiles[f.path]) updated++;
        else uploaded++;
      }

      for (const p of ops.remove) {
        if (opts?.signal?.aborted) return err({ kind: "UNKNOWN", message: "Cancelado", retryable: false });
        const r = await this.d.fetch("https://api.dropboxapi.com/2/files/delete_v2", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ path: this.fullPath(p) }),
          ...(opts?.signal ? { signal: opts.signal } : {}),
        });
        if (r.status !== 409 && (r.status < 200 || r.status >= 300)) return err(mapDropboxError(r.status, await r.text()));
      }

      const mRes = await this.d.fetch("https://content.dropboxapi.com/2/files/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
          "Dropbox-API-Arg": JSON.stringify({ path: this.fullPath(MANIFEST_PATH), mode: "overwrite", mute: true }),
        },
        body: JSON.stringify(ops.nextManifest, null, 2),
        ...(opts?.signal ? { signal: opts.signal } : {}),
      });
      if (mRes.status < 200 || mRes.status >= 300) return err(mapDropboxError(mRes.status, await mRes.text()));

      return ok({ manifest: ops.nextManifest, uploaded, updated, removed: ops.remove.length });
    } catch (e) {
      return err({ kind: "OFFLINE", message: e instanceof Error ? e.message : String(e), retryable: true });
    }
  }

  async downloadAll(opts?: { signal?: AbortSignal }): Promise<DestResult<Map<string, Uint8Array>>> {
    const mRes = await this.readManifest(opts?.signal);
    if (!mRes.ok) return mRes;
    const manifest = mRes.value;
    if (!manifest) return ok(new Map());

    const token = await this.d.getAccessToken();
    if (!token) return err({ kind: "AUTH", message: "Falta autorización de Dropbox", retryable: false });

    const out = new Map<string, Uint8Array>();
    try {
      for (const path of Object.keys(manifest.files)) {
        const r = await this.d.fetch("https://content.dropboxapi.com/2/files/download", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Dropbox-API-Arg": JSON.stringify({ path: this.fullPath(path) }),
          },
          ...(opts?.signal ? { signal: opts.signal } : {}),
        });
        if (r.status < 200 || r.status >= 300) return err(mapDropboxError(r.status, await r.text()));
        out.set(path, enc.encode(await r.text()));
      }
      return ok(out);
    } catch (e) {
      return err({ kind: "OFFLINE", message: e instanceof Error ? e.message : String(e), retryable: true });
    }
  }
}
