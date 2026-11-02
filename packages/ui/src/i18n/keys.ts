const flatten = (o: Record<string, unknown>, prefix = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flatten(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`]));

/** Compara dos árboles de traducciones: devuelve las claves que faltan en cada uno. */
export function findMissingKeys(a: Record<string, unknown>, b: Record<string, unknown>) {
  const ka = new Set(flatten(a));
  const kb = new Set(flatten(b));
  return {
    missingInB: [...ka].filter((k) => !kb.has(k)).sort(),
    missingInA: [...kb].filter((k) => !ka.has(k)).sort(),
  };
}
