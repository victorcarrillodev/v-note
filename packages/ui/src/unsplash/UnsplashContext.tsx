import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { UnsplashClient, UnsplashKeyStore, type Keychain, type UnsplashFetch } from "@vnote/core";
import type { PreferenceStore } from "../theme/theme";

/** Lo que cada cascarón aporta para usar Unsplash: el llavero, su `fetch` y la plataforma (la web no guarda la clave). */
export type UnsplashRuntime = {
  platform: "desktop" | "web";
  keychain: Keychain;
  fetch: UnsplashFetch;
  /** Solo para pruebas: cómo se crea el cliente. */
  createClient?: (o: { fetch: UnsplashFetch; key: string }) => UnsplashClient;
};

export const UNSPLASH_PREFERENCE = "unsplash.enabled";

export type UnsplashApi = {
  /** El cascarón ofrece Unsplash (si no, no hay nada que activar). */
  supported: boolean;
  platform: "desktop" | "web";
  /** Preferencia del dispositivo, apagada por defecto (RF-9.1). */
  enabled: boolean;
  setEnabled(v: boolean): void;
  keyStore: UnsplashKeyStore | null;
  /**
   * El cliente, creado en el momento de usarlo y solo si Unsplash está activado y hay clave (RF-9.4): con Unsplash apagado
   * no existe ningún cliente ni sale ninguna petición.
   */
  getClient(): Promise<UnsplashClient | null>;
};

const OFF: UnsplashApi = { supported: false, platform: "web", enabled: false, setEnabled: () => {}, keyStore: null, getClient: async () => null };
const Ctx = createContext<UnsplashApi>(OFF);
export const useUnsplash = (): UnsplashApi => useContext(Ctx);

export function UnsplashProvider({ runtime, preferences, children }: { runtime: UnsplashRuntime | undefined; preferences: PreferenceStore; children: ReactNode }) {
  const [enabled, setEnabledState] = useState(() => preferences.get(UNSPLASH_PREFERENCE) === "1");
  const keyStore = useMemo(() => (runtime ? new UnsplashKeyStore(runtime.keychain) : null), [runtime]);
  const setEnabled = useCallback((v: boolean) => { preferences.set(UNSPLASH_PREFERENCE, v ? "1" : "0"); setEnabledState(v); }, [preferences]);
  const getClient = useCallback(async () => {
    if (!runtime || !keyStore || !enabled) return null;
    const key = await keyStore.get();
    if (!key) return null;
    return (runtime.createClient ?? ((o) => new UnsplashClient(o)))({ fetch: runtime.fetch, key });
  }, [runtime, keyStore, enabled]);
  const value = useMemo<UnsplashApi>(
    () => (runtime ? { supported: true, platform: runtime.platform, enabled, setEnabled, keyStore, getClient } : OFF),
    [runtime, enabled, setEnabled, keyStore, getClient],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
