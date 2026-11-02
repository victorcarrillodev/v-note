// Mini-ejecutor compatible con la parte de la API de Vitest que usan las suites de contrato.
// Permite ejecutar la MISMA suite dentro del webview real (Tauri) o del navegador.
type Fn = () => unknown | Promise<unknown>;
type Node = { name: string; before: Fn[]; after: Fn[]; tests: { name: string; fn: Fn }[]; children: Node[] };

const root: Node = { name: "", before: [], after: [], tests: [], children: [] };
let current = root;

export function describe(name: string, fn: () => void) {
  const node: Node = { name, before: [], after: [], tests: [], children: [] };
  current.children.push(node);
  const prev = current;
  current = node;
  fn();
  current = prev;
}
export const it = (name: string, fn: Fn) => void current.tests.push({ name, fn });
export const beforeEach = (fn: Fn) => void current.before.push(fn);
export const afterEach = (fn: Fn) => void current.after.push(fn);

const same = (a: unknown, b: unknown) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));
const norm = (v: unknown): unknown => (v instanceof Uint8Array ? { $u8: [...v] } : Array.isArray(v) ? v.map(norm) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort().map(([k, x]) => [k, norm(x)])) : v);

function matchers(actual: unknown, negate = false) {
  const check = (ok: boolean, msg: string) => { if (ok === negate) throw new Error(msg); };
  return {
    toBe: (e: unknown) => check(Object.is(actual, e), `esperado ${JSON.stringify(e)}, recibido ${JSON.stringify(actual)}`),
    toEqual: (e: unknown) => check(same(actual, e), `esperado ${JSON.stringify(norm(e))}, recibido ${JSON.stringify(norm(actual))}`),
    toContain: (e: unknown) => check(typeof actual === "string" ? actual.includes(String(e)) : (actual as unknown[]).includes(e), `no contiene ${JSON.stringify(e)}: ${JSON.stringify(actual)}`),
    toBeGreaterThan: (e: number) => check((actual as number) > e, `${actual} no es mayor que ${e}`),
    toBeDefined: () => check(actual !== undefined, "está indefinido"),
    toBeNull: () => check(actual === null, `esperado null, recibido ${JSON.stringify(actual)}`),
  };
}
export function expect(actual: unknown) {
  return {
    ...matchers(actual),
    not: matchers(actual, true),
    rejects: {
      toThrow: async (msg?: string) => {
        try { await (actual as Promise<unknown>); } catch (e) {
          if (msg !== undefined && !String(e).includes(msg)) throw new Error(`el error "${String(e)}" no contiene "${msg}"`);
          return;
        }
        throw new Error("se esperaba un rechazo y la promesa se resolvió");
      },
    },
    resolves: { toBeDefined: async () => void (await (actual as Promise<unknown>)) },
  };
}

export type ContractResult = { name: string; ok: boolean; error?: string }[];

export async function runAll(): Promise<ContractResult> {
  const results: ContractResult = [];
  const walk = async (n: Node, path: string[], before: Fn[], after: Fn[]) => {
    const b = [...before, ...n.before];
    const a = [...n.after, ...after];
    for (const t of n.tests) {
      const name = [...path, n.name, t.name].filter(Boolean).join(" > ");
      try {
        for (const f of b) await f();
        try { await t.fn(); } finally { for (const f of a) await f(); }
        results.push({ name, ok: true });
      } catch (e) {
        results.push({ name, ok: false, error: String(e) });
      }
    }
    for (const c of n.children) await walk(c, [...path, n.name], b, a);
  };
  await walk(root, [], [], []);
  return results;
}
