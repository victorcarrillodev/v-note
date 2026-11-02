export type AssetInfo = { hash: string; size: number };

/**
 * Puerto de almacenamiento de adjuntos por contenido (plan D-25): el nombre del archivo vive en el documento,
 * aquí solo hay bytes direccionados por su hash SHA-256. Mismo contenido = un solo archivo; contenidos distintos nunca se pisan.
 */
export interface AssetStore {
  put(data: Uint8Array): Promise<AssetInfo>;
  get(hash: string): Promise<Uint8Array | null>;
  has(hash: string): Promise<boolean>;
  delete(hash: string): Promise<void>;
  list(): Promise<string[]>;
}
