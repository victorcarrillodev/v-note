import { createContext, useContext } from "react";
import type { AssetStore } from "@vnote/core";

/** Almacén de archivos del espacio abierto, para quien pinta imágenes guardadas (íconos de página en la barra lateral, por ejemplo). */
export const WorkspaceAssetsContext = createContext<AssetStore | undefined>(undefined);
export const useWorkspaceAssets = (): AssetStore | undefined => useContext(WorkspaceAssetsContext);
