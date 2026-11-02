import { computeOrder, dependenciesOf, referencedNames, type PropDef } from "./dependencies";
import { evaluateExpr, type EvalContext, type FormulaValue } from "./evaluate";
import { parse, type Expr } from "./parser";
import type { FormulaError } from "./tokenizer";

export type ErrorValue = { error: { code: FormulaError["code"] | "DEPENDENCY"; message: string } };
export const isErrorValue = (v: unknown): v is ErrorValue => typeof v === "object" && v !== null && "error" in v;

export type EngineInput = {
  props: PropDef[];
  /** Valores guardados (sin los calculados): base -> página -> propiedad -> valor. Incluye las fechas automáticas ya resueltas. */
  rows: Record<string, Record<string, Record<string, unknown>>>;
  /** Vínculos de cada propiedad de relación (en las dos direcciones): propiedad -> origen -> destinos. */
  links: Record<string, Record<string, string[]>>;
  now: () => number;
};
export type CellRef = { dbId: string; pageId: string; propId: string };
type Values = Map<string, Map<string, Record<string, unknown>>>;

const key = (c: CellRef) => `${c.dbId}\u0000${c.pageId}\u0000${c.propId}`;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const CANCELLED = "Cálculo cancelado";

/**
 * Motor de fórmulas y rollups sobre una instantánea de los datos. Calcula todo (cancelable y cediendo el control)
 * y después recalcula solo lo afectado por cada cambio (RNF-13). Sin acceso a base de datos ni a la interfaz.
 */
export class FormulaEngine {
  private props = new Map<string, PropDef>();
  private byDbName = new Map<string, Map<string, PropDef>>();
  private order: string[] = [];
  private orderIndex = new Map<string, number>();
  private values: Values = new Map();
  private links = new Map<string, Map<string, string[]>>();
  private asts = new Map<string, { ast: Expr | null; error: ErrorValue | null; names: string[] }>();
  private formulaDependents = new Map<string, PropDef[]>();
  private rollupsByTarget = new Map<string, PropDef[]>();
  private rollupsByRelation = new Map<string, PropDef[]>();
  private now: () => number;

  constructor(input: EngineInput) {
    this.now = input.now;
    for (const p of input.props) {
      this.props.set(p.id, p);
      const m = this.byDbName.get(p.databaseId) ?? new Map();
      m.set(p.name, p);
      this.byDbName.set(p.databaseId, m);
    }
    const ord = computeOrder(input.props);
    if (!ord.ok) throw new Error(ord.error.message);
    this.order = ord.value;
    this.order.forEach((id, i) => this.orderIndex.set(id, i));
    for (const [db, pages] of Object.entries(input.rows)) {
      const m = new Map<string, Record<string, unknown>>();
      for (const [page, vals] of Object.entries(pages)) m.set(page, { ...vals });
      this.values.set(db, m);
    }
    for (const [prop, from] of Object.entries(input.links)) this.links.set(prop, new Map(Object.entries(from).map(([k, v]) => [k, [...v]])));
    for (const p of input.props) {
      if (p.type === "formula") {
        const expression = String(p.config.expression ?? "");
        const parsed = parse(expression);
        this.asts.set(p.id, parsed.ok ? { ast: parsed.value, error: null, names: referencedNames(expression) } : { ast: null, error: { error: { code: parsed.error.code, message: parsed.error.message } }, names: [] });
        for (const d of dependenciesOf(p, input.props)) this.formulaDependents.set(d, [...(this.formulaDependents.get(d) ?? []), p]);
      } else if (p.type === "rollup") {
        const t = p.config.targetPropertyId as string | undefined;
        const r = p.config.relationPropertyId as string | undefined;
        if (t) this.rollupsByTarget.set(t, [...(this.rollupsByTarget.get(t) ?? []), p]);
        if (r) this.rollupsByRelation.set(r, [...(this.rollupsByRelation.get(r) ?? []), p]);
      }
    }
  }

  // ---- Lectura ----
  get(dbId: string, pageId: string, propId: string): unknown {
    const p = this.props.get(propId);
    if (p?.type === "relation") return this.links.get(propId)?.get(pageId) ?? [];
    return this.values.get(dbId)?.get(pageId)?.[propId] ?? null;
  }
  snapshot(): Record<string, Record<string, Record<string, unknown>>> {
    const out: Record<string, Record<string, Record<string, unknown>>> = {};
    for (const db of [...this.values.keys()].sort()) {
      out[db] = {};
      for (const page of [...this.values.get(db)!.keys()].sort()) {
        const row: Record<string, unknown> = { ...this.values.get(db)!.get(page)! };
        for (const p of this.props.values()) if (p.databaseId === db && p.type === "relation") { const l = this.links.get(p.id)?.get(page); if (l?.length) row[p.id] = l; }
        out[db]![page] = Object.fromEntries(Object.keys(row).sort().map((k) => [k, row[k]]));
      }
    }
    return out;
  }
  /** Datos guardados actuales (sin los calculados), para reconstruir un motor equivalente. */
  input(): EngineInput {
    const rows: EngineInput["rows"] = {};
    for (const [db, pages] of this.values) {
      rows[db] = {};
      for (const [page, vals] of pages) rows[db]![page] = Object.fromEntries(Object.entries(vals).filter(([k]) => { const t = this.props.get(k)?.type; return t !== "formula" && t !== "rollup"; }));
    }
    const links: EngineInput["links"] = {};
    for (const [prop, m] of this.links) links[prop] = Object.fromEntries([...m].map(([k, v]) => [k, [...v]]));
    return { props: [...this.props.values()], rows, links, now: this.now };
  }

  // ---- Cálculo de una celda ----
  private toFormulaValue(p: PropDef, v: unknown, pageId: string): FormulaValue {
    if (v === null || v === undefined) return p.type === "relation" ? (this.links.get(p.id)?.get(pageId)?.length ?? 0) : null;
    switch (p.type) {
      case "select": case "status": return ((p.config.options as { id: string; name: string }[] | undefined) ?? []).find((o) => o.id === v)?.name ?? null;
      case "multi_select": { const o = (p.config.options as { id: string; name: string }[] | undefined) ?? []; return (v as string[]).map((id) => o.find((x) => x.id === id)?.name).filter(Boolean).join(", "); }
      case "date": return { kind: "date", iso: (v as { start: string }).start };
      case "created_time": case "last_edited_time": return { kind: "date", iso: String(v).slice(0, 16) };
      case "files": return Array.isArray(v) ? v.length : 0;
      case "formula": case "rollup":
        return typeof v === "object" && v !== null && "start" in v ? { kind: "date", iso: (v as { start: string }).start } : (v as FormulaValue);
      default: return v as FormulaValue;
    }
  }

  private computeFormula(p: PropDef, pageId: string, vals: Values): unknown {
    const entry = this.asts.get(p.id)!;
    if (entry.error) return entry.error;
    const row = vals.get(p.databaseId)?.get(pageId) ?? {};
    const byName = this.byDbName.get(p.databaseId);
    for (const name of entry.names) {
      const dep = byName?.get(name);
      if (dep && isErrorValue(row[dep.id])) return { error: { code: "DEPENDENCY", message: `La fórmula depende de «${name}», que tiene un error` } } satisfies ErrorValue;
    }
    const ctx: EvalContext = {
      prop: (name) => { const dep = byName?.get(name); return dep ? this.toFormulaValue(dep, row[dep.id], pageId) : undefined; },
      now: this.now,
    };
    const r = evaluateExpr(entry.ast!, ctx);
    if (!r.ok) return { error: { code: r.error.code, message: r.error.message } } satisfies ErrorValue;
    const v = r.value;
    return typeof v === "object" && v !== null ? { start: v.iso } : v;
  }

  private computeRollup(p: PropDef, pageId: string, vals: Values): unknown {
    const rel = this.props.get(p.config.relationPropertyId as string);
    const related = this.links.get(p.config.relationPropertyId as string)?.get(pageId) ?? [];
    const fn = p.config.fn as string;
    if (fn === "count") return related.length;
    const target = p.config.targetPropertyId as string | undefined;
    const targetDb = rel?.config.targetDatabaseId as string | undefined;
    const nums: number[] = [];
    for (const id of related) {
      const v = target && targetDb ? vals.get(targetDb)?.get(id)?.[target] : undefined;
      if (isErrorValue(v)) return { error: { code: "DEPENDENCY", message: "Una fila relacionada tiene un error en el valor que se calcula" } } satisfies ErrorValue;
      if (typeof v === "number") nums.push(v);
    }
    if (fn === "sum") return nums.reduce((a, b) => a + b, 0);
    if (nums.length === 0) return null;
    return fn === "avg" ? nums.reduce((a, b) => a + b, 0) / nums.length : fn === "min" ? Math.min(...nums) : Math.max(...nums);
  }

  private computeCell(p: PropDef, pageId: string, vals: Values): unknown {
    return p.type === "formula" ? this.computeFormula(p, pageId, vals) : this.computeRollup(p, pageId, vals);
  }

  // ---- Cálculo completo, cancelable ----
  async computeAll(opts: { signal?: AbortSignal; chunk?: number; onYield?: () => void } = {}): Promise<{ cells: number }> {
    const chunk = opts.chunk ?? 2000;
    if (opts.signal?.aborted) throw new Error(CANCELLED);
    // Se calcula sobre una copia: si se cancela, los valores actuales quedan intactos y completos
    const staged: Values = new Map([...this.values].map(([db, pages]) => [db, new Map([...pages].map(([pg, v]) => [pg, { ...v }]))]));
    let cells = 0;
    for (const id of this.order) {
      const p = this.props.get(id)!;
      for (const [pageId, row] of staged.get(p.databaseId) ?? []) {
        row[p.id] = this.computeCell(p, pageId, staged);
        if (++cells % chunk === 0) {
          opts.onYield?.();
          await new Promise((r) => setTimeout(r, 0));
          if (opts.signal?.aborted) throw new Error(CANCELLED);
        }
      }
    }
    if (opts.signal?.aborted) throw new Error(CANCELLED);
    this.values = staged;
    return { cells };
  }

  // ---- Recálculo incremental ----
  private dependentsOf(c: CellRef): CellRef[] {
    const out: CellRef[] = [];
    for (const f of this.formulaDependents.get(c.propId) ?? []) out.push({ dbId: f.databaseId, pageId: c.pageId, propId: f.id });
    for (const r of this.rollupsByTarget.get(c.propId) ?? []) {
      const rel = this.props.get(r.config.relationPropertyId as string);
      const paired = rel?.config.pairedPropertyId as string | undefined;
      for (const owner of (paired && this.links.get(paired)?.get(c.pageId)) || []) out.push({ dbId: r.databaseId, pageId: owner, propId: r.id });
    }
    return out;
  }

  /** Recalcula las celdas dadas y, solo si su valor cambia, las que dependen de ellas. Siempre en orden de dependencia. */
  private propagate(seeds: CellRef[]): { recomputed: CellRef[] } {
    const queue = new Map<number, Map<string, CellRef>>(); // índice en el orden de cálculo -> celdas pendientes
    const enqueue = (c: CellRef) => {
      const i = this.orderIndex.get(c.propId);
      if (i === undefined) return;
      const bucket = queue.get(i) ?? new Map<string, CellRef>();
      bucket.set(key(c), c);
      queue.set(i, bucket);
    };
    seeds.forEach(enqueue);
    const recomputed: CellRef[] = [];
    for (;;) {
      let min = Number.POSITIVE_INFINITY;
      for (const [i, b] of queue) if (b.size > 0 && i < min) min = i;
      if (min === Number.POSITIVE_INFINITY) break;
      const bucket = queue.get(min)!;
      const [k, next] = bucket.entries().next().value as [string, CellRef];
      bucket.delete(k);
      const p = this.props.get(next.propId)!;
      const row = this.values.get(next.dbId)?.get(next.pageId);
      if (!row) continue;
      const nv = this.computeCell(p, next.pageId, this.values);
      recomputed.push(next);
      if (!same(row[p.id], nv)) {
        row[p.id] = nv;
        this.dependentsOf(next).forEach(enqueue);
      }
    }
    return { recomputed };
  }

  setRawCell(dbId: string, pageId: string, propId: string, value: unknown): void {
    const row = this.values.get(dbId)?.get(pageId);
    if (!row) throw new Error("La fila no existe");
    if (value === null || value === undefined) delete row[propId]; else row[propId] = value;
  }

  setCell(dbId: string, pageId: string, propId: string, value: unknown): { recomputed: CellRef[] } {
    const p = this.props.get(propId);
    if (p && (p.type === "formula" || p.type === "rollup")) throw new Error("Una propiedad calculada no se escribe");
    this.setRawCell(dbId, pageId, propId, value);
    return this.propagate(this.dependentsOf({ dbId, pageId, propId }));
  }

  private rollupSeeds(relPropId: string, pageId: string): CellRef[] {
    return (this.rollupsByRelation.get(relPropId) ?? []).map((r) => ({ dbId: r.databaseId, pageId, propId: r.id }));
  }

  /** Sustituye los destinos vinculados desde `from` (los vínculos se mantienen en las dos direcciones). */
  setLinks(relPropId: string, from: string, to: string[]): { recomputed: CellRef[] } {
    const rel = this.props.get(relPropId);
    if (!rel || rel.type !== "relation") throw new Error("No es una relación");
    const paired = rel.config.pairedPropertyId as string;
    const own = this.links.get(relPropId) ?? new Map<string, string[]>();
    this.links.set(relPropId, own);
    const prev = own.get(from) ?? [];
    const next = [...new Set(to)];
    own.set(from, next);
    const back = this.links.get(paired) ?? new Map<string, string[]>();
    this.links.set(paired, back);
    const touched = new Set<string>([...prev, ...next].filter((x) => !(prev.includes(x) && next.includes(x))));
    for (const t of prev.filter((x) => !next.includes(x))) back.set(t, (back.get(t) ?? []).filter((x) => x !== from));
    for (const t of next.filter((x) => !prev.includes(x))) back.set(t, [...(back.get(t) ?? []), from]);
    const seeds = [...this.rollupSeeds(relPropId, from), ...[...touched].flatMap((t) => this.rollupSeeds(paired, t))];
    return this.propagate(seeds);
  }

  addRow(dbId: string, pageId: string, values: Record<string, unknown> = {}): { recomputed: CellRef[] } {
    const pages = this.values.get(dbId) ?? new Map<string, Record<string, unknown>>();
    this.values.set(dbId, pages);
    pages.set(pageId, { ...values });
    const seeds = this.order.map((id) => this.props.get(id)!).filter((p) => p.databaseId === dbId).map((p) => ({ dbId, pageId, propId: p.id }));
    return this.propagate(seeds);
  }

  removeRow(dbId: string, pageId: string): { recomputed: CellRef[] } {
    const seeds: CellRef[] = [];
    for (const p of this.props.values()) {
      if (p.databaseId !== dbId || p.type !== "relation") continue;
      const paired = p.config.pairedPropertyId as string;
      for (const t of this.links.get(p.id)?.get(pageId) ?? []) {
        this.links.get(paired)?.set(t, (this.links.get(paired)?.get(t) ?? []).filter((x) => x !== pageId));
        seeds.push(...this.rollupSeeds(paired, t));
      }
      this.links.get(p.id)?.delete(pageId);
    }
    this.values.get(dbId)?.delete(pageId);
    return this.propagate(seeds);
  }
}
