import type { AssetStore } from "../assets/assetStore";
import type { Clock } from "../clock";
import type { CustomAccent } from "../pages/accent";
import type { WorkspaceManager } from "../workspaces/workspaceManager";
import {
  syncWithDestination,
  type BackupDestination,
  type RemoteManifest,
  type SyncOutcome,
} from "./destination";
import type { Skipped } from "./runBackup";
import { serializeWorkspace } from "./serialize";
import { stableJson } from "./stableJson";

const enc = new TextEncoder();

export type UnifiedWorkspaceMeta = {
  id: string;
  name: string;
  isCaptureDefault: boolean;
  color?: CustomAccent;
};

export type UnifiedAppMetadata = {
  version: 3;
  workspaces: UnifiedWorkspaceMeta[];
};

export type UnifiedSnapshot = {
  files: Map<string, Uint8Array>;
  skipped: Skipped;
};

/**
 * Coordina el respaldo unificado de toda la aplicación (todos los espacios + preferencias globales)
 * usando caché incremental por espacio para no re-serializar espacios que no cambiaron.
 */
export class AppBackupService {
  private workspaceCache = new Map<string, { files: Map<string, Uint8Array>; skipped: Skipped }>();
  private lastManifest: RemoteManifest | null | undefined = undefined;

  constructor(
    private d: {
      workspaces: WorkspaceManager;
      assetsFor: (location: string) => AssetStore;
      clock: Clock;
      preferences?: () => Record<string, unknown>;
    },
  ) {}

  /** Invalida la caché de un espacio concreto (o de todos si no se indica id). */
  invalidateWorkspace(workspaceId?: string): void {
    if (workspaceId === undefined) this.workspaceCache.clear();
    else this.workspaceCache.delete(workspaceId);
  }

  /** Reinicia la caché de manifiesto (p. ej. al cambiar de destino). */
  resetManifestCache(): void {
    this.lastManifest = undefined;
  }

  async buildSnapshot(opts: { maxAssetBytes?: number; dirtyWorkspaceIds?: ReadonlySet<string> } = {}): Promise<UnifiedSnapshot> {
    const listRes = await this.d.workspaces.list();
    if (!listRes.ok) throw new Error(listRes.error.message);
    const workspaces = listRes.value;

    const files = new Map<string, Uint8Array>();
    const skipped: Skipped = [];

    const appMeta: UnifiedAppMetadata = {
      version: 3,
      workspaces: workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        isCaptureDefault: w.isCaptureDefault,
        ...(w.color ? { color: w.color } : {}),
      })),
    };
    files.set("app/workspaces.json", enc.encode(stableJson(appMeta)));

    if (this.d.preferences) {
      files.set("app/preferences.json", enc.encode(stableJson(this.d.preferences())));
    }

    const activeIds = new Set(workspaces.map((w) => w.id));
    for (const cachedId of this.workspaceCache.keys()) {
      if (!activeIds.has(cachedId)) this.workspaceCache.delete(cachedId);
    }

    for (const ws of workspaces) {
      const mustRebuild =
        !this.workspaceCache.has(ws.id) ||
        opts.dirtyWorkspaceIds === undefined ||
        opts.dirtyWorkspaceIds.has(ws.id);

      let entry = this.workspaceCache.get(ws.id);
      if (mustRebuild || !entry) {
        const opened = await this.d.workspaces.open(ws.id);
        if (!opened.ok) throw new Error(opened.error.message);
        const snap = await serializeWorkspace(
          { store: opened.value.store, assets: this.d.assetsFor(ws.location) },
          { id: ws.id, name: ws.name },
          opts.maxAssetBytes === undefined ? {} : { maxAssetBytes: opts.maxAssetBytes },
        );
        entry = { files: snap.files, skipped: snap.skipped };
        this.workspaceCache.set(ws.id, entry);
      }

      for (const [relPath, bytes] of entry.files) {
        files.set(`workspaces/${ws.id}/${relPath}`, bytes);
      }
      skipped.push(...entry.skipped);
    }

    return { files, skipped };
  }

  async syncTo(
    destination: BackupDestination,
    opts: { maxAssetBytes?: number; dirtyWorkspaceIds?: ReadonlySet<string>; signal?: AbortSignal } = {},
  ): Promise<SyncOutcome> {
    const snap = await this.buildSnapshot(opts);
    const outcome = await syncWithDestination(destination, snap.files, this.d.clock.now(), {
      ...(this.lastManifest !== undefined ? { cachedManifest: this.lastManifest } : {}),
      ...(opts.signal ? { signal: opts.signal } : {}),
    });
    if (outcome.status === "success") this.lastManifest = outcome.receipt.manifest;
    else if (outcome.status === "unchanged") this.lastManifest = outcome.manifest;
    return outcome;
  }
}
