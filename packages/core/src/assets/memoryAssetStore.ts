import type { AssetInfo, AssetStore } from "./assetStore";
import { isValidHash, sha256Hex } from "./hash";

/** Adaptador en memoria: sirve de referencia del contrato y para pruebas. */
export class MemoryAssetStore implements AssetStore {
  private files = new Map<string, Uint8Array>();
  private check(hash: string) {
    if (!isValidHash(hash)) throw new Error("hash inválido");
  }
  async put(data: Uint8Array): Promise<AssetInfo> {
    const hash = await sha256Hex(data);
    if (!this.files.has(hash)) this.files.set(hash, new Uint8Array(data));
    return { hash, size: data.length };
  }
  async get(hash: string) {
    this.check(hash);
    const f = this.files.get(hash);
    return f ? new Uint8Array(f) : null;
  }
  async has(hash: string) { this.check(hash); return this.files.has(hash); }
  async delete(hash: string) { this.check(hash); this.files.delete(hash); }
  async list() { return [...this.files.keys()]; }
}
