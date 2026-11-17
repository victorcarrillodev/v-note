import { useEffect, useState } from "react";
import type { AssetStore } from "@vnote/core";

/** URL local de una imagen del almacén (`blob:` o, sin soporte, `data:`); se libera al cambiar o desmontar. `null` mientras carga o si falta. */
export function useCoverImage(assets: AssetStore | undefined, hash: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(null);
    if (!assets || !hash) return;
    let alive = true, made: string | null = null;
    void assets.get(hash).then((bytes) => {
      if (!alive || !bytes) return;
      if (typeof URL.createObjectURL === "function") { made = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "image/jpeg" })); setUrl(made); return; }
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      setUrl(`data:image/jpeg;base64,${btoa(bin)}`);
    }).catch(() => { /* sin imagen: se ve el fondo neutro */ });
    return () => { alive = false; if (made && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(made); };
  }, [assets, hash]);
  return url;
}
