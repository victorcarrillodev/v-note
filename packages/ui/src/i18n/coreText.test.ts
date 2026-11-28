// B-15: los mensajes del núcleo tienen versión en inglés; esta prueba falla si aparece uno nuevo sin traducir.
import { describe, it, expect, afterEach } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { CORE_MESSAGES_EN } from "./coreMessages.en";
import { coreText, setCoreLanguage } from "./coreText";
import { createI18n } from ".";

const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") && !p.includes(".test.") && !p.includes("contract") ? [p] : [];
});
const LITERAL = /(?:appError\(\s*"[A-Z_]+",\s*|\binvalid\(\s*|\bmessage:\s*|new Error\(\s*)(["`])((?:\\.|(?!\1).)*)\1/g;

afterEach(() => setCoreLanguage("es"));

describe("mensajes del núcleo", () => {
  it("todos tienen traducción", () => {
    const known = new Set(CORE_MESSAGES_EN.map(([es]) => es));
    const missing = files(resolve(__dirname, "../../../core/src"))
      .flatMap((f) => [...readFileSync(f, "utf8").matchAll(LITERAL)].map((m) => m[2]!))
      .filter((s) => /[a-záéíóú] /.test(s) && !known.has(s));
    expect(missing).toEqual([]);
  });
  it("traduce al inglés, conserva las partes variables y deja el español igual", async () => {
    expect(coreText("La página no existe")).toBe("La página no existe");
    await createI18n("en");
    expect(coreText("La página no existe")).toBe("The page does not exist");
    expect(coreText("La columna tiene 3 tarjeta(s): elige a qué columna pasan")).toBe("The column has 3 card(s): choose which column receives them");
    expect(coreText("Algo desconocido")).toBe("Algo desconocido");
  });
});
