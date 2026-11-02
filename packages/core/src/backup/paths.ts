type PageRef = { id: string; title: string; parentId: string | null; position: string };

/** Nombre de archivo seguro y legible: minúsculas, sin acentos, solo [a-z0-9-], máx. 40 caracteres. */
export function slugify(title: string): string {
  const s = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return s === "" ? "sin-titulo" : s;
}

const shortId = (id: string, n: number) => id.replace(/-/g, "").toLowerCase().slice(0, n);

/**
 * Ruta del Markdown de cada página (RF-15, plan 6.1): jerarquía en carpetas y nombre «título--id».
 * Determinista y sin colisiones: si dos páginas coinciden se alarga el id de las implicadas.
 */
export function buildPagePaths(pages: readonly PageRef[]): Map<string, string> {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const len = new Map(pages.map((p) => [p.id, 8]));
  for (let guard = 0; guard < 40; guard++) {
    const memo = new Map<string, string>();
    const base = (p: PageRef): string => {
      const hit = memo.get(p.id);
      if (hit) return hit;
      const parent = p.parentId ? byId.get(p.parentId) : undefined;
      const name = `${slugify(p.title)}--${shortId(p.id, len.get(p.id)!)}`;
      const v = parent ? `${base(parent)}/${name}` : `pages/${name}`;
      memo.set(p.id, v);
      return v;
    };
    const groups = new Map<string, string[]>();
    for (const p of [...pages].sort((a, b) => (a.id < b.id ? -1 : 1))) {
      const key = base(p);
      groups.set(key, [...(groups.get(key) ?? []), p.id]);
    }
    const dup = [...groups.values()].filter((g) => g.length > 1);
    if (dup.length === 0) return new Map(pages.map((p) => [p.id, `${base(p)}.md`]));
    for (const g of dup) for (const id of g) len.set(id, len.get(id)! + 1);
  }
  throw new Error("No se pudieron generar rutas únicas");
}
