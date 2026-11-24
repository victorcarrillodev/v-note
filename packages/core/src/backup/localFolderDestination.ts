import { err, ok } from "../result";
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

/** Puerto de almacenamiento en carpeta local o sincronizada (Tauri fs / File System Access API). */
export interface FolderSyncPort {
  readonly label: string;
  readFile(relPath: string): Promise<Uint8Array | null>;
  writeFile(relPath: string, bytes: Uint8Array): Promise<void>;
  removeFile(relPath: string): Promise<void>;
  listFiles(): Promise<string[]>;
}

/** Destino de respaldo en carpeta local o sincronizada (Drive/Dropbox/OneDrive de escritorio). */
export class LocalFolderDestination implements BackupDestination {
  readonly kind = "local-folder" as const;

  constructor(private port: FolderSyncPort) {}

  async checkConnection(): Promise<DestResult<DestinationInfo>> {
    try {
      await this.port.listFiles();
      return ok({ kind: "local-folder", label: this.port.label, writable: true });
    } catch (e) {
      return err({ kind: "UNKNOWN", message: e instanceof Error ? e.message : String(e), retryable: false });
    }
  }

  async readManifest(): Promise<DestResult<RemoteManifest | null>> {
    try {
      const raw = await this.port.readFile(MANIFEST_PATH);
      if (!raw) return ok(null);
      const parsed = JSON.parse(dec.decode(raw)) as RemoteManifest;
      return ok(parsed);
    } catch (e) {
      return err({ kind: "UNKNOWN", message: e instanceof Error ? e.message : String(e), retryable: false });
    }
  }

  async applyChanges(
    ops: { put: FileChange[]; remove: string[]; nextManifest: RemoteManifest },
    opts?: { signal?: AbortSignal },
  ): Promise<DestResult<SyncReceipt>> {
    try {
      let uploaded = 0;
      let updated = 0;
      const prev = await this.port.readFile(MANIFEST_PATH);
      const prevFiles = prev ? (JSON.parse(dec.decode(prev)) as RemoteManifest).files : {};

      for (const f of ops.put) {
        if (opts?.signal?.aborted) return err({ kind: "UNKNOWN", message: "Cancelado", retryable: false });
        await this.port.writeFile(f.path, f.bytes);
        if (prevFiles[f.path]) updated++;
        else uploaded++;
      }
      for (const p of ops.remove) {
        if (opts?.signal?.aborted) return err({ kind: "UNKNOWN", message: "Cancelado", retryable: false });
        await this.port.removeFile(p);
      }
      await this.port.writeFile(MANIFEST_PATH, enc.encode(JSON.stringify(ops.nextManifest, null, 2)));
      return ok({ manifest: ops.nextManifest, uploaded, updated, removed: ops.remove.length });
    } catch (e) {
      return err({ kind: "UNKNOWN", message: e instanceof Error ? e.message : String(e), retryable: true });
    }
  }

  async downloadAll(): Promise<DestResult<Map<string, Uint8Array>>> {
    try {
      const out = new Map<string, Uint8Array>();
      const paths = await this.port.listFiles();
      for (const p of paths) {
        if (p === MANIFEST_PATH) continue;
        const bytes = await this.port.readFile(p);
        if (bytes) out.set(p, bytes);
      }
      return ok(out);
    } catch (e) {
      return err({ kind: "UNKNOWN", message: e instanceof Error ? e.message : String(e), retryable: true });
    }
  }
}
