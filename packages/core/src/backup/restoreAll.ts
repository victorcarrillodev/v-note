import { appError, err, ok, type Result } from "../result";
import type { AssetStore } from "../assets/assetStore";
import type { Workspace, WorkspaceManager } from "../workspaces/workspaceManager";
import { restoreAsNewWorkspace } from "./restoreFlows";
import type { UnifiedAppMetadata, UnifiedWorkspaceMeta } from "./appBackupService";

const dec = new TextDecoder();

export type SplitBackup = {
  workspaces: { meta: UnifiedWorkspaceMeta; files: Map<string, Uint8Array> }[];
  preferences: Record<string, unknown>;
};

/** Separa un respaldo unificado en un mapa por espacio (sin el prefijo `workspaces/<id>/`) y las preferencias globales. */
export function splitUnifiedBackup(files: Map<string, Uint8Array>): Result<SplitBackup> {
  const rawMeta = files.get("app/workspaces.json");
  if (!rawMeta) return err(appError("INVALID", "El respaldo no contiene app/workspaces.json"));
  let meta: UnifiedAppMetadata;
  try {
    meta = JSON.parse(dec.decode(rawMeta)) as UnifiedAppMetadata;
  } catch {
    return err(appError("INVALID", "app/workspaces.json está dañado"));
  }
  if (!Array.isArray(meta.workspaces)) return err(appError("INVALID", "app/workspaces.json no es válido"));
  let preferences: Record<string, unknown> = {};
  const rawPrefs = files.get("app/preferences.json");
  if (rawPrefs) {
    try { preferences = JSON.parse(dec.decode(rawPrefs)) as Record<string, unknown>; } catch { /* las preferencias son opcionales */ }
  }
  const workspaces = meta.workspaces.map((m) => {
    const prefix = `workspaces/${m.id}/`;
    const own = new Map<string, Uint8Array>();
    for (const [p, b] of files) if (p.startsWith(prefix)) own.set(p.slice(prefix.length), b);
    return { meta: m, files: own };
  });
  return ok({ workspaces, preferences });
}

/**
 * Restaura TODOS los espacios de un respaldo unificado como espacios nuevos (nunca sobrescribe los existentes).
 * Si un espacio falla, los ya restaurados se conservan y el fallo se informa.
 */
export async function restoreAllFromBackup(
  mgr: WorkspaceManager,
  assetsFor: (location: string) => AssetStore,
  files: Map<string, Uint8Array>,
): Promise<Result<{ restored: Workspace[]; failed: { name: string; message: string }[]; preferences: Record<string, unknown> }>> {
  const split = splitUnifiedBackup(files);
  if (!split.ok) return split;
  // Los espacios actuales no pierden su condición de predeterminado de captura: solo se asigna uno si no había ninguno.
  const existing = await mgr.list();
  let hadDefault = existing.ok && existing.value.some((w) => w.isCaptureDefault);
  const restored: Workspace[] = [];
  const failed: { name: string; message: string }[] = [];
  for (const w of split.value.workspaces) {
    const r = await restoreAsNewWorkspace(mgr, assetsFor, w.files, { name: `${w.meta.name} (restaurado)` });
    if (r.ok) {
      restored.push(r.value.workspace);
      if (w.meta.isCaptureDefault && !hadDefault) {
        const d = await mgr.setCaptureDefault(r.value.workspace.id).catch(() => null); // no es crítico: el espacio ya está restaurado
        hadDefault = d?.ok === true;
      }
    } else failed.push({ name: w.meta.name, message: r.error.message });
  }
  return ok({ restored, failed, preferences: split.value.preferences });
}
