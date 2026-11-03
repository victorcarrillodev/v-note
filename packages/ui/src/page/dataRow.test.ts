// U-154 (RF-5.2): la fila de datos de la página solo informa de la última edición; sin propietario ni autoría.
import { describe, it, expect } from "vitest";
import { esMX } from "../i18n/es-MX";
import { en } from "../i18n/en";

const FORBIDDEN = /propietari|autor|creado por|owner|author|created by/i;
const texts = (o: unknown): string[] => (typeof o === "string" ? [o] : o && typeof o === "object" ? Object.values(o).flatMap(texts) : []);

describe("fila de datos de la página", () => {
  it("existe el texto de última edición", () => {
    expect((esMX.header as { edited: { now: string } }).edited.now).toMatch(/editado/i);
    expect((en.header as { edited: { now: string } }).edited.now).toMatch(/edited/i);
  });
  it("ningún texto de página, encabezado o editor habla de propietario o autoría", () => {
    for (const dict of [esMX, en]) for (const ns of ["page", "header", "editor"] as const) {
      for (const text of texts((dict as Record<string, unknown>)[ns])) expect(text, `${ns}: ${text}`).not.toMatch(FORBIDDEN);
    }
  });
});
