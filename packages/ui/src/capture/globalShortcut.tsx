import { coreText } from "../i18n/coreText";
import { createContext, useContext, useEffect, useState } from "react";
import { toNativeCombo, type GlobalShortcutService } from "@vnote/core";
import { BINDINGS_CHANGED, loadBindings } from "../settings/bindingsStore";
import type { PreferenceStore } from "../theme/theme";

export type GlobalShortcutState = { status: "active" | "unavailable" | "off"; message?: string; /** Orden que un atajo del sistema debe ejecutar para abrir la captura. */ command: string };

const Ctx = createContext<GlobalShortcutState | null>(null);
export const GlobalShortcutProvider = Ctx.Provider;
export const useGlobalShortcutState = (): GlobalShortcutState | null => useContext(Ctx);

/** Mantiene registrado el atajo global de captura según las preferencias; informa si el sistema no lo permite (CL-15). */
export function useGlobalShortcut(service: GlobalShortcutService | undefined, preferences: PreferenceStore, command: string): GlobalShortcutState | null {
  const [state, setState] = useState<GlobalShortcutState | null>(null);
  useEffect(() => {
    if (!service) { setState(null); return; }
    let cancelled = false;
    const apply = async () => {
      const combo = loadBindings(preferences)["capture.open"] ?? null;
      const r = await service.set(combo === null ? null : toNativeCombo(combo));
      if (cancelled) return;
      if (!r.ok) setState({ status: "unavailable", message: coreText(r.error.message), command });
      else setState({ status: combo === null ? "off" : "active", command });
    };
    void apply();
    const onChange = () => void apply();
    window.addEventListener(BINDINGS_CHANGED, onChange);
    return () => { cancelled = true; window.removeEventListener(BINDINGS_CHANGED, onChange); };
  }, [service, preferences, command]);
  return state;
}
