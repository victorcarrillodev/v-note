// G-004 (spike desechable): A* sobre rejilla comprimida para rutas de 90°. Mide cuánto cuesta recalcular conectores.
type P = { x: number; y: number };
type Box = { x: number; y: number; w: number; h: number };
const infl = (b: Box, k: number): Box => ({ x: b.x - k, y: b.y - k, w: b.w + 2 * k, h: b.h + 2 * k });
const inside = (b: Box, p: P) => p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h;
function route(a: P, b: P, obs: Box[]): P[] {
  const xs = [...new Set([a.x, b.x, ...obs.flatMap((o) => [o.x, o.x + o.w])])].sort((p, q) => p - q);
  const ys = [...new Set([a.y, b.y, ...obs.flatMap((o) => [o.y, o.y + o.h])])].sort((p, q) => p - q);
  const key = (i: number, j: number) => i * ys.length + j;
  const free = (i: number, j: number) => !obs.some((o) => inside(o, { x: xs[i]!, y: ys[j]! }));
  const si = xs.indexOf(a.x), sj = ys.indexOf(a.y), ti = xs.indexOf(b.x), tj = ys.indexOf(b.y);
  const open: { k: number; i: number; j: number; d: number; g: number; f: number }[] = [{ k: key(si, sj), i: si, j: sj, d: -1, g: 0, f: 0 }];
  const best = new Map<string, number>(); const prev = new Map<string, string>();
  const id = (i: number, j: number, d: number) => `${i},${j},${d}`;
  best.set(id(si, sj, -1), 0);
  while (open.length) {
    open.sort((p, q) => p.f - q.f); const c = open.shift()!;
    if (c.i === ti && c.j === tj) { const out: P[] = []; let cur = id(c.i, c.j, c.d); while (cur) { const [i, j] = cur.split(",").map(Number); out.push({ x: xs[i!]!, y: ys[j!]! }); cur = prev.get(cur)!; } return out.reverse(); }
    for (const [d, di, dj] of [[0, 1, 0], [1, -1, 0], [2, 0, 1], [3, 0, -1]] as const) {
      const ni = c.i + di, nj = c.j + dj;
      if (ni < 0 || nj < 0 || ni >= xs.length || nj >= ys.length || !free(ni, nj)) continue;
      const g = c.g + Math.abs(xs[ni]! - xs[c.i]!) + Math.abs(ys[nj]! - ys[c.j]!) + (c.d !== -1 && c.d !== d ? 20 : 0);
      const nid = id(ni, nj, d); if (g >= (best.get(nid) ?? Infinity)) continue;
      best.set(nid, g); prev.set(nid, id(c.i, c.j, c.d));
      open.push({ k: key(ni, nj), i: ni, j: nj, d, g, f: g + Math.abs(xs[ni]! - b.x) + Math.abs(ys[nj]! - b.y) });
    }
  }
  return [a, b];
}
const nodes: Box[] = Array.from({ length: 200 }, (_, n) => ({ x: (n % 20) * 220, y: Math.floor(n / 20) * 140, w: 140, h: 60 }));
const edges = Array.from({ length: 300 }, (_, n) => ({ a: n % 200, b: (n * 7 + 13) % 200 })).filter((e) => e.a !== e.b);
const run = (list: typeof edges) => { for (const e of list) { const A = nodes[e.a]!, B = nodes[e.b]!; route({ x: A.x + A.w + 16, y: A.y + A.h / 2 }, { x: B.x - 16, y: B.y + B.h / 2 }, [infl(A, 16), infl(B, 16)]); } };
let t = performance.now(); run(edges); console.log("300 conectores completos:", (performance.now() - t).toFixed(1), "ms");
t = performance.now(); for (let r = 0; r < 20; r++) run(edges.slice(0, 10)); console.log("mover una forma con 10 conectores (media de 20):", ((performance.now() - t) / 20).toFixed(2), "ms");
