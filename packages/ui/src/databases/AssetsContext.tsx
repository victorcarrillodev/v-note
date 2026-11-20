import { createContext, useContext } from "react";
import type { AssetStore } from "@vnote/core";

/** Almacén de archivos del espacio para las vistas de una base (portadas de las tarjetas); sin él, las imágenes no se pintan. */
export const DatabaseAssetsContext = createContext<AssetStore | undefined>(undefined);
export const useDatabaseAssets = (): AssetStore | undefined => useContext(DatabaseAssetsContext);
