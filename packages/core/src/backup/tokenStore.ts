import { appError, err, ok, type Result } from "../result";

/** Puerto del llavero del sistema (libsecret, Credential Manager, Keychain). En el navegador no existe: se usa solo memoria. */
export interface Keychain {
  get(account: string): Promise<string | null>;
  set(account: string, secret: string): Promise<void>;
  delete(account: string): Promise<void>;
}

/** «Llavero» solo en memoria (web y pruebas): el secreto se pierde al recargar y nunca toca el disco (constitución, art. 6). */
export class MemoryKeychain implements Keychain {
  private data = new Map<string, string>();
  async get(account: string) { return this.data.get(account) ?? null; }
  async set(account: string, secret: string) { this.data.set(account, secret); }
  async delete(account: string) { this.data.delete(account); }
}

export type SetTokenOutcome = { persisted: true } | { persisted: false; reason: string };

/**
 * Token de GitHub de un espacio de trabajo. Vive en el llavero; si no hay llavero, solo durante la sesión (en memoria)
 * y habrá que pedirlo de nuevo la próxima vez. Nunca se escribe en la base, el respaldo, los registros ni archivos de configuración.
 */
export class GitHubTokenStore {
  private session: string | null = null;
  /** `null` = aún no se sabe; se actualiza tras el primer acceso al llavero. */
  private available: boolean | null = null;

  constructor(private keychain: Keychain, private workspaceId: string) {}

  private get account() { return `github-token:${this.workspaceId}`; }
  get keychainAvailable(): boolean | null { return this.available; }

  async get(): Promise<string | null> {
    if (this.session) return this.session;
    try {
      const t = await this.keychain.get(this.account);
      this.available = true;
      if (t) this.session = t;
      return t;
    } catch {
      this.available = false;
      return null;
    }
  }

  async set(raw: string): Promise<Result<SetTokenOutcome>> {
    const token = raw.trim();
    if (token === "" || /\s/.test(token)) return err(appError("INVALID", "El token no puede estar vacío ni contener espacios"));
    this.session = token;
    try {
      await this.keychain.set(this.account, token);
      this.available = true;
      return ok({ persisted: true });
    } catch (e) {
      this.available = false;
      return ok({ persisted: false, reason: e instanceof Error ? e.message : String(e) });
    }
  }

  async clear(): Promise<void> {
    this.session = null;
    try { await this.keychain.delete(this.account); } catch { /* sin llavero: nada que borrar */ }
  }
}
