import config from "../../../brand.config.json";

/** Único punto de acceso al nombre del producto (constitución, art. 7). */
export const brand = {
  name: config.name,
  appId: config.appId,
  /** «propietario/repositorio» de GitHub Releases donde se publican las versiones de escritorio; vacío = sin aviso de actualizaciones (P-2). */
  updateRepo: config.updateRepo,
} as const;
