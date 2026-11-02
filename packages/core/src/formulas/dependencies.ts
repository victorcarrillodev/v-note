import { parse, type Expr } from "./parser";
import { ferr, fok, type FResult } from "./tokenizer";

/** Lo mínimo que el grafo necesita saber de una propiedad (de cualquier base). */
export type PropDef = { id: string; name: string; databaseId: string; type: string; config: Record<string, unknown> };

function collectProps(e: Expr, out: Set<string>): void {
  switch (e.type) {
    case "prop": out.add(e.name); break;
    case "unary": collectProps(e.arg, out); break;
    case "binary": collectProps(e.left, out); collectProps(e.right, out); break;
    case "call": for (const a of e.args) collectProps(a, out); break;
    default: break;
  }
}

/** Nombres citados con prop("…") en una expresión; vacío si no se puede analizar. */
export function referencedNames(expression: string): string[] {
  const r = parse(expression);
  if (!r.ok) return [];
  const out = new Set<string>();
  collectProps(r.value, out);
  return [...out];
}

/** Propiedades de las que depende `p`: las que cita una fórmula en su base, o la relación y el destino de un rollup. */
export function dependenciesOf(p: PropDef, all: readonly PropDef[]): string[] {
  if (p.type === "formula") {
    const names = referencedNames(String(p.config.expression ?? ""));
    return names.map((n) => all.find((x) => x.databaseId === p.databaseId && x.name === n)?.id).filter((x): x is string => !!x);
  }
  if (p.type === "rollup") {
    return [p.config.relationPropertyId, p.config.targetPropertyId].filter((x): x is string => typeof x === "string");
  }
  return [];
}

const isComputed = (p: PropDef) => p.type === "formula" || p.type === "rollup";

/** Primer ciclo encontrado como [a, b, …, a], o null. */
export function findCycle(defs: readonly PropDef[]): string[] | null {
  const byId = new Map(defs.map((d) => [d.id, d]));
  const deps = new Map(defs.map((d) => [d.id, dependenciesOf(d, defs)]));
  const state = new Map<string, 1 | 2>(); // 1 = en la ruta actual, 2 = terminado
  const stack: string[] = [];
  const visit = (id: string): string[] | null => {
    state.set(id, 1);
    stack.push(id);
    for (const d of deps.get(id) ?? []) {
      if (!byId.has(d)) continue;
      if (state.get(d) === 1) return [...stack.slice(stack.indexOf(d)), d];
      if (!state.has(d)) { const c = visit(d); if (c) return c; }
    }
    stack.pop();
    state.set(id, 2);
    return null;
  };
  for (const d of [...defs].sort((a, b) => a.id.localeCompare(b.id))) if (!state.has(d.id)) { const c = visit(d.id); if (c) return c; }
  return null;
}

/** Orden de cálculo de las propiedades calculadas (fórmulas y rollups): cada una después de aquello de lo que depende. Estable. */
export function computeOrder(defs: readonly PropDef[]): FResult<string[]> {
  const cycle = findCycle(defs);
  if (cycle) return ferr("CYCLE", `Definición circular: ${cycle.join(" → ")}`);
  const computed = defs.filter(isComputed);
  const ids = new Set(computed.map((d) => d.id));
  // Dependencias transitivas a través de propiedades no calculadas no importan: solo cuentan las calculadas
  const direct = new Map(computed.map((d) => [d.id, dependenciesOf(d, defs).filter((x) => ids.has(x))]));
  const done = new Set<string>();
  const order: string[] = [];
  while (order.length < computed.length) {
    const ready = computed.filter((d) => !done.has(d.id) && (direct.get(d.id) ?? []).every((x) => done.has(x))).map((d) => d.id).sort();
    if (ready.length === 0) return ferr("CYCLE", "Definición circular");
    const next = ready[0]!;
    done.add(next);
    order.push(next);
  }
  return fok(order);
}

/** Añade o reemplaza una definición solo si el grafo sigue sin ciclos; si no, la rechaza nombrando el ciclo (CL-26). */
export function tryAddDefinition(existing: readonly PropDef[], def: PropDef): FResult<PropDef[]> {
  const next = [...existing.filter((d) => d.id !== def.id), def];
  const cycle = findCycle(next);
  if (!cycle) return fok(next);
  const names = cycle.map((id) => next.find((d) => d.id === id)?.name ?? id);
  return ferr("CYCLE", `Esta definición crearía una referencia circular: ${names.join(" → ")}. Cambia la fórmula para que no dependa de sí misma.`);
}
