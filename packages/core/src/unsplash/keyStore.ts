import { appError, err, ok, type Result } from "../result";
import type { Keychain } from "../backup/tokenStore";

export type SetKeyOutcome = { persisted: true } | { persisted: false; reason: string };

/**
 * Clave de acceso de Unsplash (RF-9.2). Vive en el llavero del sistema; sin llavero (la web), solo durante la sesión.
 * Nunca se escribe en la base, el respaldo, los registros ni archivos de configuración.
 */
export class UnsplashKeyStore {
  static readonly ACCOUNT = "unsplash-access-key";
  private session: string | null = null;
  /** `null` = aún no se sabe; se actualiza tras el primer acceso al llavero. */
  private available: boolean | null = null;
  constructor(private keychain: Keychain) {}

  get keychainAvailable(): boolean | null { return this.available; }

  async get(): Promise<string | null> {
    if (this.session) return this.session;
    try {
      const k = await this.keychain.get(UnsplashKeyStore.ACCOUNT);
      this.available = true;
      if (k) this.session = k;
      return k;
    } catch {
      this.available = false;
      return null;
    }
  }

  async set(raw: string): Promise<Result<SetKeyOutcome>> {
    const key = raw.trim();
    if (key === "" || /\s/.test(key)) return err(appError("INVALID", "La clave no puede estar vacía ni contener espacios"));
    this.session = key;
    try {
      await this.keychain.set(UnsplashKeyStore.ACCOUNT, key);
      this.available = true;
      return ok({ persisted: true });
    } catch (e) {
      this.available = false;
      return ok({ persisted: false, reason: e instanceof Error ? e.message : String(e) });
    }
  }

  async clear(): Promise<void> {
    this.session = null;
    try { await this.keychain.delete(UnsplashKeyStore.ACCOUNT); } catch { /* sin llavero: nada que borrar */ }
  }
}
