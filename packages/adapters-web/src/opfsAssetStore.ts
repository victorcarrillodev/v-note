import { isValidHash, sha256Hex, type AssetInfo, type AssetStore } from "@vnote/core";

/** Subconjunto de FileSystemDirectoryHandle que se usa (permite probar con un directorio simulado). */
export interface DirLike {
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<{
    createWritable(): Promise<{ write(data: Uint8Array): Promise<void>; close(): Promise<void> }>;
    getFile(): Promise<{ arrayBuffer(): Promise<ArrayBuffer> }>;
  }>;
  removeEntry(name: string): Promise<void>;
  keys(): AsyncIterable<string>;
}

const notFound = (e: unknown) => e instanceof Error && e.name === "NotFoundError";
const check = (hash: string) => {
  if (!isValidHash(hash)) throw new Error("hash inválido");
};

/** AssetStore del navegador sobre OPFS. `createWritable` confirma la escritura al cerrar (atómico según la especificación). */
export class OpfsAssetStore implements AssetStore {
  constructor(private dir: DirLike) {}

  async put(data: Uint8Array): Promise<AssetInfo> {
    const hash = await sha256Hex(data);
    if (!(await this.has(hash))) {
      const handle = await this.dir.getFileHandle(hash, { create: true });
      const w = await handle.createWritable();
      await w.write(data);
      await w.close();
    }
    return { hash, size: data.length };
  }

  async get(hash: string): Promise<Uint8Array | null> {
    check(hash);
    try {
      const f = await (await this.dir.getFileHandle(hash)).getFile();
      return new Uint8Array(await f.arrayBuffer());
    } catch (e) {
      if (notFound(e)) return null;
      throw e;
    }
  }

  async has(hash: string): Promise<boolean> {
    check(hash);
    try {
      await this.dir.getFileHandle(hash);
      return true;
    } catch (e) {
      if (notFound(e)) return false;
      throw e;
    }
  }

  async delete(hash: string): Promise<void> {
    check(hash);
    try {
      await this.dir.removeEntry(hash);
    } catch (e) {
      if (!notFound(e)) throw e;
    }
  }

  async list(): Promise<string[]> {
    const out: string[] = [];
    for await (const name of this.dir.keys()) if (isValidHash(name)) out.push(name);
    return out;
  }
}
