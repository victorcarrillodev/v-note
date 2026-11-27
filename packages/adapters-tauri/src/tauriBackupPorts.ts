import type { FolderSyncPort, OAuthPort } from "@vnote/core";
import type { Invoke } from "./tauriSqlStore";

const toB64 = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Carpeta local elegida por la persona; el acceso a archivos lo hace Rust, acotado a esa carpeta. */
export class TauriFolderPort implements FolderSyncPort {
  readonly label: string;
  constructor(private invoke: Invoke, private root: string) {
    this.label = root.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || root;
  }
  async readFile(rel: string): Promise<Uint8Array | null> {
    const r = (await this.invoke("folder_read", { root: this.root, rel })) as string | null;
    return r === null || r === undefined ? null : fromB64(r);
  }
  async writeFile(rel: string, bytes: Uint8Array): Promise<void> {
    await this.invoke("folder_write", { root: this.root, rel, data: toB64(bytes) });
  }
  async removeFile(rel: string): Promise<void> {
    await this.invoke("folder_remove", { root: this.root, rel });
  }
  async listFiles(): Promise<string[]> {
    return (await this.invoke("folder_list", { root: this.root })) as string[];
  }
}

/** Retorno de OAuth por bucle local (127.0.0.1, puerto efímero): abre el navegador del sistema y espera la redirección. */
export class TauriOAuthPort implements OAuthPort {
  private port = 0;
  constructor(private invoke: Invoke) {}
  get redirectUri(): string { return `http://127.0.0.1:${this.port}/cb`; }

  /** Reserva el puerto local; hay que llamarlo antes de armar la URL de autorización. */
  async prepare(): Promise<void> {
    this.port = (await this.invoke("oauth_listen", {})) as number;
  }

  async authorize(authUrl: string, _redirectUri?: string): Promise<string> {
    if (!this.port) await this.prepare();
    const waiting = this.invoke("oauth_wait", {}) as Promise<string>;
    await this.invoke("open_oauth_url", { url: authUrl });
    return `http://127.0.0.1:${this.port}${await waiting}`;
  }
}
