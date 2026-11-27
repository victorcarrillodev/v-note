import type { DestinationConfig } from "@vnote/core";
import type { PreferenceStore } from "../theme/theme";

const KEY = "backup_unified";

/** Configuración del respaldo unificado. Solo datos no sensibles: los tokens viven en el llavero del sistema. */
export type UnifiedConfig = { destination: DestinationConfig; folderPath: string | null; continuous: boolean };

const DEFAULT: UnifiedConfig = { destination: { kind: "local-folder" }, folderPath: null, continuous: false };

export function loadUnifiedConfig(prefs: PreferenceStore): UnifiedConfig {
  try {
    const raw = prefs.get(KEY);
    if (!raw) return DEFAULT;
    const p = JSON.parse(raw) as Partial<UnifiedConfig>;
    return {
      destination: p.destination && typeof p.destination === "object" && "kind" in p.destination ? p.destination : DEFAULT.destination,
      folderPath: typeof p.folderPath === "string" ? p.folderPath : null,
      continuous: p.continuous === true,
    };
  } catch {
    return DEFAULT;
  }
}

export function saveUnifiedConfig(prefs: PreferenceStore, cfg: UnifiedConfig): void {
  prefs.set(KEY, JSON.stringify(cfg));
}
