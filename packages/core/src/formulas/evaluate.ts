import { parse, normalizeName, type Expr } from "./parser";
import { ferr, fok, type FResult } from "./tokenizer";

export type FDate = { kind: "date"; iso: string };
export type FormulaValue = number | string | boolean | FDate | null;
export type EvalContext = {
  /** Valor de una propiedad por su nombre; `undefined` si no existe. */
  prop(name: string): FormulaValue | undefined;
  /** Reloj inyectado (milisegundos UTC) para que `ahora()` y `hoy()` sean deterministas. */
  now(): number;
};

const isDate = (v: FormulaValue): v is FDate => typeof v === "object" && v !== null && v.kind === "date";
const typeName = (v: FormulaValue) => (v === null ? "vacío" : typeof v === "number" ? "número" : typeof v === "string" ? "texto" : typeof v === "boolean" ? "casilla" : "fecha");

// ---- Fechas (siempre en UTC para que el resultado no dependa de la zona del equipo) ----
type Parts = { y: number; mo: number; d: number; h: number; mi: number; hasTime: boolean };
function parseIso(iso: string): Parts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(iso);
  if (!m) return null;
  const p = { y: +m[1]!, mo: +m[2]!, d: +m[3]!, h: m[4] ? +m[4] : 0, mi: m[5] ? +m[5] : 0, hasTime: m[4] !== undefined };
  const t = new Date(Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi));
  return t.getUTCFullYear() === p.y && t.getUTCMonth() === p.mo - 1 && t.getUTCDate() === p.d && p.h < 24 && p.mi < 60 ? p : null;
}
const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const fmtIso = (ms: number, withTime: boolean): string => {
  const t = new Date(ms);
  const day = `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
  return withTime ? `${day}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}` : day;
};
const toMs = (p: Parts) => Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
const UNITS: Record<string, string> = { dia: "d", dias: "d", day: "d", days: "d", semana: "w", semanas: "w", week: "w", weeks: "w", mes: "mo", meses: "mo", month: "mo", months: "mo", anio: "y", anios: "y", ano: "y", anos: "y", year: "y", years: "y", hora: "h", horas: "h", hour: "h", hours: "h", minuto: "mi", minutos: "mi", minute: "mi", minutes: "mi" };
const unitOf = (v: string) => UNITS[normalizeName(v)];

function addMonths(p: Parts, n: number): Parts {
  const total = p.y * 12 + (p.mo - 1) + n;
  const y = Math.floor(total / 12), mo = (total % 12 + 12) % 12 + 1;
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return { ...p, y, mo, d: Math.min(p.d, last) };
}

// ---- Funciones ----
type Fn = { names: string[]; min: number; max: number; impl: (args: FormulaValue[], ctx: EvalContext) => FResult<FormulaValue> };
const typeErr = (msg: string) => ferr("TYPE", msg);
const num = (v: FormulaValue, what: string): FResult<number> =>
  v === null ? fok(0) : typeof v === "number" ? fok(v) : typeErr(`${what} debe ser un número, pero es ${typeName(v)}`);
const text = (v: FormulaValue, what: string): FResult<string> =>
  v === null ? fok("") : typeof v === "string" ? fok(v) : typeErr(`${what} debe ser texto, pero es ${typeName(v)}`);
const bool = (v: FormulaValue, what: string): FResult<boolean> =>
  v === null ? fok(false) : typeof v === "boolean" ? fok(v) : typeErr(`${what} debe ser verdadero o falso, pero es ${typeName(v)}`);
const dateArg = (v: FormulaValue, what: string): FResult<Parts> => {
  if (!isDate(v)) return typeErr(`${what} debe ser una fecha, pero es ${typeName(v)}`);
  const p = parseIso(v.iso);
  return p ? fok(p) : typeErr(`${what} no es una fecha válida`);
};
export const toText = (v: FormulaValue): string => (v === null ? "" : isDate(v) ? v.iso : typeof v === "boolean" ? (v ? "verdadero" : "falso") : String(v));
const finite = (n: number): FResult<FormulaValue> => (Number.isFinite(n) ? fok(n) : ferr("DOMAIN", "El resultado no es un número válido (por ejemplo, un desbordamiento o una potencia imposible)"));

function numericArgs(args: FormulaValue[], name: string): FResult<number[]> {
  const out: number[] = [];
  for (const [i, a] of args.entries()) { const n = num(a, `El argumento ${i + 1} de ${name}`); if (!n.ok) return n; out.push(n.value); }
  return fok(out);
}
const mapNum = (name: string, f: (n: number) => FResult<FormulaValue>): Fn["impl"] => (a) => { const n = num(a[0]!, `El argumento de ${name}`); return n.ok ? f(n.value) : n; };

const FUNCTIONS: Fn[] = [
  // Texto
  { names: ["unir", "concat"], min: 1, max: 99, impl: (a) => fok(a.map(toText).join("")) },
  { names: ["largo", "length"], min: 1, max: 1, impl: (a) => { const t = text(a[0]!, "El argumento de largo"); return t.ok ? fok([...t.value].length) : t; } },
  { names: ["mayusculas", "upper"], min: 1, max: 1, impl: (a) => { const t = text(a[0]!, "El argumento"); return t.ok ? fok(t.value.toUpperCase()) : t; } },
  { names: ["minusculas", "lower"], min: 1, max: 1, impl: (a) => { const t = text(a[0]!, "El argumento"); return t.ok ? fok(t.value.toLowerCase()) : t; } },
  { names: ["recortar", "trim"], min: 1, max: 1, impl: (a) => { const t = text(a[0]!, "El argumento"); return t.ok ? fok(t.value.trim()) : t; } },
  { names: ["contiene", "contains"], min: 2, max: 2, impl: (a) => { const [x, y] = [text(a[0]!, "El primer argumento"), text(a[1]!, "El segundo argumento")]; return !x.ok ? x : !y.ok ? y : fok(x.value.toLowerCase().includes(y.value.toLowerCase())); } },
  { names: ["reemplazar", "replace"], min: 3, max: 3, impl: (a) => { const [x, y, z] = [text(a[0]!, "El texto"), text(a[1]!, "El texto a buscar"), text(a[2]!, "El reemplazo")]; return !x.ok ? x : !y.ok ? y : !z.ok ? z : fok(y.value === "" ? x.value : x.value.split(y.value).join(z.value)); } },
  { names: ["subcadena", "substring"], min: 2, max: 3, impl: (a) => {
    const t = text(a[0]!, "El texto"); if (!t.ok) return t;
    const s = num(a[1]!, "El inicio"); if (!s.ok) return s;
    const e = a[2] === undefined ? fok(undefined as number | undefined) : num(a[2], "El fin"); if (!e.ok) return e;
    const chars = [...t.value];
    return fok(chars.slice(Math.max(0, Math.trunc(s.value)), e.value === undefined ? undefined : Math.max(0, Math.trunc(e.value))).join(""));
  } },
  { names: ["texto", "totext"], min: 1, max: 1, impl: (a) => fok(toText(a[0]!)) },
  // Números
  { names: ["abs"], min: 1, max: 1, impl: mapNum("abs", (n) => fok(Math.abs(n))) },
  { names: ["redondear", "round"], min: 1, max: 2, impl: (a) => {
    const n = num(a[0]!, "El número"); if (!n.ok) return n;
    const dgt = a[1] === undefined ? fok(0) : num(a[1], "Los decimales"); if (!dgt.ok) return dgt;
    const k = Math.trunc(dgt.value), sign = n.value < 0 ? -1 : 1, abs = Math.abs(n.value);
    return finite(k >= 0 ? (sign * Math.round(abs * 10 ** k)) / 10 ** k : sign * Math.round(abs / 10 ** -k) * 10 ** -k);
  } },
  { names: ["piso", "floor"], min: 1, max: 1, impl: mapNum("piso", (n) => fok(Math.floor(n))) },
  { names: ["techo", "ceil"], min: 1, max: 1, impl: mapNum("techo", (n) => fok(Math.ceil(n))) },
  { names: ["min"], min: 1, max: 99, impl: (a) => { const n = numericArgs(a, "min"); return n.ok ? fok(Math.min(...n.value)) : n; } },
  { names: ["max"], min: 1, max: 99, impl: (a) => { const n = numericArgs(a, "max"); return n.ok ? fok(Math.max(...n.value)) : n; } },
  { names: ["raiz", "sqrt"], min: 1, max: 1, impl: mapNum("raiz", (n) => (n < 0 ? ferr("DOMAIN", "No existe la raíz cuadrada de un número negativo") : fok(Math.sqrt(n)))) },
  { names: ["potencia", "pow"], min: 2, max: 2, impl: (a) => { const n = numericArgs(a, "potencia"); return n.ok ? finite(n.value[0]! ** n.value[1]!) : n; } },
  { names: ["residuo", "mod"], min: 2, max: 2, impl: (a) => { const n = numericArgs(a, "residuo"); return !n.ok ? n : n.value[1] === 0 ? ferr("DIV_ZERO", "No se puede calcular el residuo entre cero") : fok(n.value[0]! % n.value[1]!); } },
  { names: ["suma", "sum"], min: 1, max: 99, impl: (a) => { const n = numericArgs(a, "suma"); return n.ok ? fok(n.value.reduce((x, y) => x + y, 0)) : n; } },
  { names: ["numero", "tonumber"], min: 1, max: 1, impl: (a) => {
    const v = a[0]!;
    if (typeof v === "number") return fok(v);
    if (v === null) return fok(0);
    if (typeof v === "string") { const n = Number(v.trim()); return v.trim() !== "" && Number.isFinite(n) ? fok(n) : typeErr(`«${v}» no se puede convertir en número`); }
    return typeErr(`No se puede convertir ${typeName(v)} en número`);
  } },
  // Fechas
  { names: ["ahora", "now"], min: 0, max: 0, impl: (_a, c) => fok({ kind: "date", iso: fmtIso(c.now(), true) }) },
  { names: ["hoy", "today"], min: 0, max: 0, impl: (_a, c) => fok({ kind: "date", iso: fmtIso(c.now(), false) }) },
  { names: ["fecha", "date"], min: 1, max: 1, impl: (a) => {
    const v = a[0]!;
    if (isDate(v)) return fok(v);
    if (typeof v === "string" && parseIso(v.trim())) return fok({ kind: "date", iso: v.trim() });
    return typeErr(`«${toText(v)}» no es una fecha válida (usa AAAA-MM-DD)`);
  } },
  { names: ["sumarfecha", "dateadd"], min: 3, max: 3, impl: (a) => {
    const p = dateArg(a[0]!, "La fecha"); if (!p.ok) return p;
    const n = num(a[1]!, "La cantidad"); if (!n.ok) return n;
    const u = text(a[2]!, "La unidad"); if (!u.ok) return u;
    const unit = unitOf(u.value);
    if (!unit) return typeErr(`Unidad desconocida «${u.value}»; usa dias, semanas, meses, anios, horas o minutos`);
    const k = Math.trunc(n.value);
    let ms: number, withTime = p.value.hasTime;
    if (unit === "mo" || unit === "y") ms = toMs(addMonths(p.value, unit === "y" ? k * 12 : k));
    else {
      const per = { d: 86_400_000, w: 7 * 86_400_000, h: 3_600_000, mi: 60_000 }[unit as "d" | "w" | "h" | "mi"];
      ms = toMs(p.value) + k * per;
      if (unit === "h" || unit === "mi") withTime = true;
    }
    return fok({ kind: "date", iso: fmtIso(ms, withTime) });
  } },
  { names: ["diffecha", "datediff"], min: 3, max: 3, impl: (a) => {
    const x = dateArg(a[0]!, "La primera fecha"); if (!x.ok) return x;
    const y = dateArg(a[1]!, "La segunda fecha"); if (!y.ok) return y;
    const u = text(a[2]!, "La unidad"); if (!u.ok) return u;
    const unit = unitOf(u.value);
    if (!unit) return typeErr(`Unidad desconocida «${u.value}»; usa dias, semanas, meses, anios, horas o minutos`);
    const diffMs = toMs(x.value) - toMs(y.value);
    if (unit === "mo" || unit === "y") {
      const [hi, lo, sign] = diffMs >= 0 ? [x.value, y.value, 1] : [y.value, x.value, -1];
      let months = (hi.y - lo.y) * 12 + (hi.mo - lo.mo);
      if (hi.d < lo.d || (hi.d === lo.d && toMs({ ...hi, y: 2000, mo: 1, d: 1 }) < toMs({ ...lo, y: 2000, mo: 1, d: 1 }))) months -= 1;
      months = Math.max(0, months);
      return fok(sign * (unit === "y" ? Math.trunc(months / 12) : months));
    }
    const per = { d: 86_400_000, w: 7 * 86_400_000, h: 3_600_000, mi: 60_000 }[unit as "d" | "w" | "h" | "mi"];
    return fok(Math.trunc(diffMs / per));
  } },
  { names: ["ano", "year"], min: 1, max: 1, impl: (a) => { const p = dateArg(a[0]!, "La fecha"); return p.ok ? fok(p.value.y) : p; } },
  { names: ["mes", "month"], min: 1, max: 1, impl: (a) => { const p = dateArg(a[0]!, "La fecha"); return p.ok ? fok(p.value.mo) : p; } },
  { names: ["dia", "day"], min: 1, max: 1, impl: (a) => { const p = dateArg(a[0]!, "La fecha"); return p.ok ? fok(p.value.d) : p; } },
  { names: ["formatofecha", "formatdate"], min: 2, max: 2, impl: (a) => {
    const p = dateArg(a[0]!, "La fecha"); if (!p.ok) return p;
    const f = text(a[1]!, "El formato"); if (!f.ok) return f;
    return fok(f.value.replace(/YYYY|MM|DD|HH|mm/g, (t) => ({ YYYY: pad(p.value.y, 4), MM: pad(p.value.mo), DD: pad(p.value.d), HH: pad(p.value.h), mm: pad(p.value.mi) })[t]!));
  } },
  // Lógica (si / y / o se evalúan de forma perezosa en el evaluador)
  { names: ["no", "not"], min: 1, max: 1, impl: (a) => { const b = bool(a[0]!, "El argumento"); return b.ok ? fok(!b.value) : b; } },
  { names: ["vacio", "empty"], min: 1, max: 1, impl: (a) => fok(a[0] === null || a[0] === "" ) },
];
const LAZY = new Set(["si", "if", "y", "and", "o", "or"]);
const TABLE = new Map<string, Fn>();
for (const f of FUNCTIONS) for (const n of f.names) TABLE.set(n, f);

function arity(name: string, n: number, min: number, max: number): FResult<null> | null {
  if (n >= min && n <= max) return null;
  const want = min === max ? `${min}` : max >= 99 ? `al menos ${min}` : `entre ${min} y ${max}`;
  return ferr("ARITY", `La función «${name}» necesita ${want} argumento${min === 1 && max === 1 ? "" : "s"}, pero recibió ${n}`);
}

function ev(e: Expr, ctx: EvalContext): FResult<FormulaValue> {
  switch (e.type) {
    case "num": return fok(e.value);
    case "str": return fok(e.value);
    case "bool": return fok(e.value);
    case "prop": {
      const v = ctx.prop(e.name);
      return v === undefined ? ferr("UNKNOWN_PROPERTY", `No existe la propiedad «${e.name}»`, e.pos) : fok(v);
    }
    case "unary": {
      const a = ev(e.arg, ctx); if (!a.ok) return a;
      if (e.op === "-") { const n = num(a.value, "El valor con signo menos"); return n.ok ? fok(-n.value) : n; }
      const b = bool(a.value, "El valor negado"); return b.ok ? fok(!b.value) : b;
    }
    case "binary": return evBinary(e, ctx);
    case "call": return evCall(e, ctx);
  }
}

function evBinary(e: Extract<Expr, { type: "binary" }>, ctx: EvalContext): FResult<FormulaValue> {
  if (e.op === "&&" || e.op === "||") {
    const l = ev(e.left, ctx); if (!l.ok) return l;
    const lb = bool(l.value, "El operando izquierdo"); if (!lb.ok) return lb;
    if (e.op === "&&" ? !lb.value : lb.value) return fok(lb.value);
    const r = ev(e.right, ctx); if (!r.ok) return r;
    const rb = bool(r.value, "El operando derecho"); return rb.ok ? fok(rb.value) : rb;
  }
  const l = ev(e.left, ctx); if (!l.ok) return l;
  const r = ev(e.right, ctx); if (!r.ok) return r;
  const a = l.value, b = r.value;
  if (e.op === "==" || e.op === "!=") {
    const same = (x: FormulaValue, y: FormulaValue) => (isDate(x) && isDate(y) ? x.iso === y.iso : (x === null ? "" : x) === (y === null ? "" : y) || (x === null && y === 0) || (x === 0 && y === null));
    const eq = same(a, b);
    return fok(e.op === "==" ? eq : !eq);
  }
  if (e.op === "<" || e.op === "<=" || e.op === ">" || e.op === ">=") {
    let cmp: number;
    if (isDate(a) && isDate(b)) cmp = a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0;
    else if (typeof a === "string" && typeof b === "string") cmp = a.localeCompare(b);
    else if ((typeof a === "number" || a === null) && (typeof b === "number" || b === null)) cmp = (a ?? 0) - (b ?? 0);
    else return typeErr(`No se puede comparar ${typeName(a)} con ${typeName(b)}`);
    return fok(e.op === "<" ? cmp < 0 : e.op === "<=" ? cmp <= 0 : e.op === ">" ? cmp > 0 : cmp >= 0);
  }
  if (e.op === "+" && (typeof a === "string" || typeof b === "string")) return fok(toText(a) + toText(b));
  const x = num(a, "El operando izquierdo"); if (!x.ok) return x;
  const y = num(b, "El operando derecho"); if (!y.ok) return y;
  switch (e.op) {
    case "+": return finite(x.value + y.value);
    case "-": return finite(x.value - y.value);
    case "*": return finite(x.value * y.value);
    case "/": return y.value === 0 ? ferr("DIV_ZERO", "No se puede dividir entre cero", e.pos) : finite(x.value / y.value);
    case "%": return y.value === 0 ? ferr("DIV_ZERO", "No se puede calcular el residuo entre cero", e.pos) : finite(x.value % y.value);
    case "^": return finite(x.value ** y.value);
    default: return ferr("SYNTAX", `Operador desconocido «${e.op}»`, e.pos);
  }
}

function evCall(e: Extract<Expr, { type: "call" }>, ctx: EvalContext): FResult<FormulaValue> {
  const name = e.name;
  if (LAZY.has(name)) {
    if (name === "si" || name === "if") {
      const bad = arity(name, e.args.length, 3, 3); if (bad) return bad;
      const c = ev(e.args[0]!, ctx); if (!c.ok) return c;
      const cb = bool(c.value, "La condición"); if (!cb.ok) return cb;
      return ev(cb.value ? e.args[1]! : e.args[2]!, ctx);
    }
    const bad = arity(name, e.args.length, 1, 99); if (bad) return bad;
    const isAnd = name === "y" || name === "and";
    for (const a of e.args) {
      const v = ev(a, ctx); if (!v.ok) return v;
      const b = bool(v.value, "Cada argumento"); if (!b.ok) return b;
      if (isAnd ? !b.value : b.value) return fok(!isAnd);
    }
    return fok(isAnd);
  }
  const fn = TABLE.get(name);
  if (!fn) return ferr("UNKNOWN_FUNCTION", `No existe la función «${name}»`, e.pos);
  const bad = arity(name, e.args.length, fn.min, fn.max); if (bad) return bad;
  const args: FormulaValue[] = [];
  for (const a of e.args) { const v = ev(a, ctx); if (!v.ok) return v; args.push(v.value); }
  return fn.impl(args, ctx);
}

/** Evalúa una fórmula. Cualquier fallo (de sintaxis, de tipos, división entre cero...) vuelve como error con explicación; nunca lanza. */
export function evaluateFormula(src: string, ctx: EvalContext): FResult<FormulaValue> {
  const parsed = parse(src);
  if (!parsed.ok) return parsed;
  return evaluateExpr(parsed.value, ctx);
}
export function evaluateExpr(expr: Expr, ctx: EvalContext): FResult<FormulaValue> {
  try {
    return ev(expr, ctx);
  } catch (e) {
    return ferr("TYPE", `No se pudo calcular la fórmula: ${e instanceof Error ? e.message : String(e)}`);
  }
}
