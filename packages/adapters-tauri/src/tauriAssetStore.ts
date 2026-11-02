import { isValidHash, type AssetInfo, type AssetStore } from "@vnote/core";
import type { Invoke } from "./tauriSqlStore";

const check = (hash: string) => {
  if (!isValidHash(hash)) throw new Error("hash inválido");
};

/** AssetStore sobre la carpeta de adjuntos del espacio (Rust). Los bytes viajan en crudo, sin pasar por JSON. */
export class TauriAssetStore implements AssetStore {
  constructor(private invoke: Invoke, private root: string) {}

  async put(data: Uint8Array): Promise<AssetInfo> {
    return (await this.invoke("asset_put", data, { headers: { "x-root": encodeURIComponent(this.root) } })) as AssetInfo;
  }

  async get(hash: string): Promise<Uint8Array | null> {
    check(hash);
    try {
      const buf = (await this.invoke("asset_get", { root: this.root, hash })) as ArrayBuffer;
      return new Uint8Array(buf);
    } catch (e) {
      if (String(e) === "NOT_FOUND") return null;
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  async has(hash: string): Promise<boolean> {
    check(hash);
    return (await this.invoke("asset_has", { root: this.root, hash })) as boolean;
  }

  async delete(hash: string): Promise<void> {
    check(hash);
    await this.invoke("asset_delete", { root: this.root, hash });
  }

  async list(): Promise<string[]> {
    return (await this.invoke("asset_list", { root: this.root })) as string[];
  }
}
