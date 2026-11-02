import { attachFile, parseAssetUrl, type AssetStore } from "@vnote/core";

const readBytes = (f: Blob): Promise<Uint8Array> =>
  typeof f.arrayBuffer === "function"
    ? f.arrayBuffer().then((b) => new Uint8Array(b))
    : new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer));
        r.onerror = () => reject(r.error);
        r.readAsArrayBuffer(f);
      });

type Hooks = { onWarning: (fileName: string) => void; onError: (message: string) => void };

/** Puente entre los bloques de archivo/imagen del editor y el AssetStore del espacio. */
export function createFileHandlers(store: AssetStore, hooks: Hooks) {
  const urls = new Map<string, string>(); // hash -> URL de objeto ya creada (evita recrear blobs)
  return {
    async uploadFile(file: File): Promise<string> {
      const data = await readBytes(file);
      const r = await attachFile(store, { name: file.name, data });
      if (!r.ok) { hooks.onError(r.error.message); throw new Error(r.error.message); }
      if (r.value.warning) hooks.onWarning(r.value.name);
      return r.value.url;
    },
    async resolveFileUrl(url: string): Promise<string> {
      const hash = parseAssetUrl(url);
      if (!hash) return url;
      const cached = urls.get(hash);
      if (cached) return cached;
      const bytes = await store.get(hash);
      if (!bytes) return url;
      const objectUrl = URL.createObjectURL(new Blob([bytes as BlobPart]));
      urls.set(hash, objectUrl);
      return objectUrl;
    },
  };
}
