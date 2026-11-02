// Huellas SHA-1 de objetos Git calculadas localmente (plan D-23): permiten subir solo lo distinto y no crear commits vacíos.
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha1 = async (data: Uint8Array) => new Uint8Array(await globalThis.crypto.subtle.digest("SHA-1", data));
const enc = new TextEncoder();
const concat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const fromHex = (h: string) => Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)));

export async function gitBlobSha(content: Uint8Array): Promise<string> {
  return hex(await sha1(concat([enc.encode(`blob ${content.length}\0`), content])));
}

type Dir = { files: Map<string, string>; dirs: Map<string, Dir> };

/** Huella del árbol Git raíz a partir de {ruta → huella del blob}, con carpetas anidadas y el orden exacto de Git. */
export async function gitTreeSha(files: ReadonlyMap<string, string>): Promise<string> {
  const root: Dir = { files: new Map(), dirs: new Map() };
  for (const [path, sha] of files) {
    const parts = path.split("/");
    let d = root;
    for (const seg of parts.slice(0, -1)) {
      if (!d.dirs.has(seg)) d.dirs.set(seg, { files: new Map(), dirs: new Map() });
      d = d.dirs.get(seg)!;
    }
    d.files.set(parts.at(-1)!, sha);
  }
  const treeSha = async (d: Dir): Promise<string> => {
    const entries: { sortKey: string; bytes: Uint8Array }[] = [];
    for (const [name, sha] of d.files) entries.push({ sortKey: name, bytes: concat([enc.encode(`100644 ${name}\0`), fromHex(sha)]) });
    for (const [name, sub] of d.dirs) entries.push({ sortKey: name + "/", bytes: concat([enc.encode(`40000 ${name}\0`), fromHex(await treeSha(sub))]) });
    entries.sort((a, b) => {
      const x = enc.encode(a.sortKey), y = enc.encode(b.sortKey);
      for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i]! - y[i]!;
      return x.length - y.length;
    });
    const body = concat(entries.map((e) => e.bytes));
    return hex(await sha1(concat([enc.encode(`tree ${body.length}\0`), body])));
  };
  return treeSha(root);
}
