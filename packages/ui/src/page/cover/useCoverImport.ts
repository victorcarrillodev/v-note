import { useCallback, useState } from "react";
import { unsplashCredit, type AssetStore, type UnsplashErrorKind, type UnsplashPhoto } from "@vnote/core";
import { useUnsplash } from "../../unsplash/UnsplashContext";
import type { WorkspaceController } from "../../workspace/controller";
import { importCoverBytes, importCoverImage, type CoverImportError, type CoverImportDeps } from "./importCoverImage";

/** `stage`: qué se está haciendo mientras `busy`: descargar la foto de Unsplash o optimizar la imagen. */
export type CoverImportState = { busy: boolean; stage: "idle" | "download" | "optimize"; error: CoverImportError | null; unsplashError: UnsplashErrorKind | null; lowRes: boolean };
const IDLE: CoverImportState = { busy: false, stage: "idle", error: null, unsplashError: null, lowRes: false };

/** Estado de la importación de una portada desde un archivo (subir, arrastrar o pegar): progreso, error y aviso de baja resolución. */
export function useCoverImport(controller: WorkspaceController, pageId: string, assets: AssetStore | undefined, optimize?: CoverImportDeps["optimize"]) {
  const [state, setState] = useState<CoverImportState>(IDLE);
  const unsplash = useUnsplash();
  const importFile = useCallback(async (file: Blob) => {
    if (!assets) return;
    setState({ ...IDLE, busy: true, stage: "optimize" });
    const r = await importCoverImage(file, { assets, setProps: (patch) => controller.setPageProps(pageId, patch), ...(optimize ? { optimize } : {}) });
    setState({ ...IDLE, error: r.ok ? null : r.error, lowRes: r.ok && r.lowRes });
  }, [assets, controller, pageId, optimize]);

  /**
   * Elegir una foto de Unsplash (plan §9.3): aviso de descarga, descarga, optimización y portada con su crédito en una sola entrada
   * del historial. Si algo falla antes de escribir, la portada anterior no cambia (CL-8). Devuelve si se aplicó.
   */
  const importUnsplash = useCallback(async (photo: UnsplashPhoto): Promise<boolean> => {
    if (!assets) return false;
    const client = await unsplash.getClient();
    if (!client) { setState({ ...IDLE, unsplashError: "unauthorized" }); return false; }
    setState({ ...IDLE, busy: true, stage: "download" });
    const got = await client.fetchPhoto(photo);
    if (!got.ok) {
      if (got.error.kind === "unauthorized") await unsplash.keyStore?.clear();
      setState({ ...IDLE, unsplashError: got.error.kind });
      return false;
    }
    setState({ ...IDLE, busy: true, stage: "optimize" });
    const r = await importCoverBytes(got.value, { assets, setProps: (patch) => controller.setPageProps(pageId, patch), ...(optimize ? { optimize } : {}) }, unsplashCredit(photo));
    setState({ ...IDLE, error: r.ok ? null : r.error, lowRes: r.ok && r.lowRes });
    return r.ok;
  }, [assets, controller, pageId, optimize, unsplash]);
  const clear = useCallback(() => setState((s) => ({ ...s, error: null, unsplashError: null, lowRes: false })), []);
  return { ...state, importFile, importUnsplash, clear, canImport: assets !== undefined };
}
