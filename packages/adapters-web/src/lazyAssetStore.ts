import type { AssetInfo, AssetStore } from "@vnote/core";

/** AssetStore cuyo almacén real se abre al primer uso (en el navegador, el directorio OPFS se obtiene de forma asíncrona). */
export class LazyAssetStore implements AssetStore {
  private inner: Promise<AssetStore> | null = null;
  constructor(private open: () => Promise<AssetStore>) {}
  private get store(): Promise<AssetStore> {
    return (this.inner ??= this.open());
  }
  async put(data: Uint8Array): Promise<AssetInfo> { return (await this.store).put(data); }
  async get(hash: string): Promise<Uint8Array | null> { return (await this.store).get(hash); }
  async has(hash: string): Promise<boolean> { return (await this.store).has(hash); }
  async delete(hash: string): Promise<void> { return (await this.store).delete(hash); }
  async list(): Promise<string[]> { return (await this.store).list(); }
}
