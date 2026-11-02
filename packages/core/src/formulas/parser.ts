import { tokenize, fok, ferr, type FResult, type Token } from "./tokenizer";

export type Expr =
  | { type: "num"; value: number; pos: number }
  | { type: "str"; value: string; pos: number }
  | { type: "bool"; value: boolean; pos: number }
  | { type: "prop"; name: string; pos: number }
  | { type: "unary"; op: "-" | "!"; arg: Expr; pos: number }
  | { type: "binary"; op: string; left: Expr; right: Expr; pos: number }
  | { type: "call"; name: string; args: Expr[]; pos: number };

const MAX_DEPTH = 200;
/** Nombre de función normalizado: minúsculas y sin acentos (año -> anio). */
export const normalizeName = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/ñ/g, "n");

class Parser {
  private i = 0;
  private depth = 0;
  constructor(private t: Token[]) {}
  private get cur() { return this.t[this.i]!; }
  private isOp(text: string) { return this.cur.kind === "operator" && this.cur.text === text; }
  private next() { return this.t[this.i++]!; }
  private fail(msg: string, tok = this.cur): never { throw { code: "SYNTAX", message: msg, pos: tok.pos }; }
  private expect(text: string, what: string) { if (!this.isOp(text)) this.fail(`Se esperaba ${what}`); return this.next(); }

  parseAll(): Expr {
    const e = this.parseOr();
    if (this.cur.kind !== "eof") this.fail(this.isOp(")") ? "Sobra un paréntesis de cierre" : `No se esperaba «${this.cur.text}» aquí`);
    return e;
  }
  private enter() { if (++this.depth > MAX_DEPTH) this.fail("La fórmula está demasiado anidada"); }
  private leave() { this.depth--; }

  private binary(next: () => Expr, ops: string[]): Expr {
    let left = next();
    while (this.cur.kind === "operator" && ops.includes(this.cur.text)) {
      const op = this.next();
      left = { type: "binary", op: op.text, left, right: next(), pos: op.pos };
    }
    return left;
  }
  private parseOr(): Expr { return this.binary(() => this.parseAnd(), ["||"]); }
  private parseAnd(): Expr { return this.binary(() => this.parseEq(), ["&&"]); }
  private parseEq(): Expr { return this.binary(() => this.parseCmp(), ["==", "!="]); }
  private parseCmp(): Expr { return this.binary(() => this.parseAdd(), ["<", "<=", ">", ">="]); }
  private parseAdd(): Expr { return this.binary(() => this.parseMul(), ["+", "-"]); }
  private parseMul(): Expr { return this.binary(() => this.parseUnary(), ["*", "/", "%"]); }
  private parseUnary(): Expr {
    if (this.isOp("-") || this.isOp("!")) {
      const op = this.next();
      this.enter();
      const arg = this.parseUnary();
      this.leave();
      return { type: "unary", op: op.text as "-" | "!", arg, pos: op.pos };
    }
    return this.parsePow();
  }
  private parsePow(): Expr {
    const base = this.parsePrimary();
    if (this.isOp("^")) {
      const op = this.next();
      this.enter();
      const right = this.parseUnary(); // asociativa por la derecha; admite -x en el exponente
      this.leave();
      return { type: "binary", op: "^", left: base, right, pos: op.pos };
    }
    return base;
  }
  private parsePrimary(): Expr {
    const tok = this.cur;
    switch (tok.kind) {
      case "number": this.next(); return { type: "num", value: Number(tok.text), pos: tok.pos };
      case "string": this.next(); return { type: "str", value: tok.text, pos: tok.pos };
      case "boolean": this.next(); return { type: "bool", value: tok.text === "true", pos: tok.pos };
      case "identifier": return this.parseCall();
      case "operator":
        if (tok.text === "(") {
          this.next();
          this.enter();
          const e = this.parseOr();
          this.leave();
          this.expect(")", "un paréntesis de cierre «)»");
          return e;
        }
        return this.fail(`No se esperaba «${tok.text}» aquí`);
      default:
        return this.fail("La fórmula está incompleta");
    }
  }
  private parseCall(): Expr {
    const name = this.next();
    if (!this.isOp("(")) this.fail(`«${name.text}» no es una propiedad ni una función; para usar una propiedad escribe prop("nombre")`, name);
    this.next();
    const args: Expr[] = [];
    if (!this.isOp(")")) {
      for (;;) {
        this.enter();
        args.push(this.parseOr());
        this.leave();
        if (this.isOp(",")) { this.next(); continue; }
        break;
      }
    }
    this.expect(")", "«)» para cerrar los argumentos");
    const fn = normalizeName(name.text);
    if (fn === "prop") {
      const a = args[0];
      if (args.length !== 1 || a?.type !== "str" || a.value === "") this.fail('prop necesita exactamente un nombre entre comillas, por ejemplo prop("Costo")', name);
      return { type: "prop", name: a.value, pos: name.pos };
    }
    return { type: "call", name: fn, args, pos: name.pos };
  }
}

/** Analiza una fórmula y devuelve su árbol, o un error con posición y mensaje en español. */
export function parse(src: string): FResult<Expr> {
  const tokens = tokenize(src);
  if (!tokens.ok) return tokens;
  try {
    return fok(new Parser(tokens.value).parseAll());
  } catch (e) {
    if (e && typeof e === "object" && "code" in e) return { ok: false, error: e as never };
    return ferr("SYNTAX", "No se pudo analizar la fórmula");
  }
}
