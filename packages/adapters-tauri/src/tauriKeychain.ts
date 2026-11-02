import type { Keychain } from "@vnote/core";
import type { Invoke } from "./tauriSqlStore";

/** Llavero del sistema (Secret Service en Linux, Credential Manager en Windows, Keychain en macOS) vía Rust. */
export class TauriKeychain implements Keychain {
  constructor(private invoke: Invoke, private service: string) {}

  private async call<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
    try {
      return (await this.invoke(cmd, { service: this.service, ...args })) as T;
    } catch (e) {
      throw e instanceof Error ? e : new Error(String(e));
    }
  }
  async get(account: string): Promise<string | null> {
    return (await this.call<string | null>("keychain_get", { account })) ?? null;
  }
  async set(account: string, secret: string): Promise<void> {
    await this.call("keychain_set", { account, secret });
  }
  async delete(account: string): Promise<void> {
    await this.call("keychain_delete", { account });
  }
}
