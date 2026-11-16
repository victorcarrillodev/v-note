/** Copia con las claves de cada objeto ordenadas (los arreglos conservan su orden). */
export const sortKeys = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object" && !(v instanceof Uint8Array)) {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
};

/** JSON determinista (RNF-7): claves ordenadas, 2 espacios, fin de línea LF y un solo salto final. Omite `undefined`. */
export const stableJson = (value: unknown): string => JSON.stringify(sortKeys(value), null, 2) + "\n";
