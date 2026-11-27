// backlog-b7-b11 T-6 (prueba primero): notas por zona sobre PDF e imágenes, con respaldo.
import { describe, it, expect } from "vitest";
import { isNoteRect } from "./assetNotes";
import { validateAssetNotes } from "../backup/assetNotes";

const H = "b".repeat(64);
const note = { id: "n1", hash: H, page: 1, x: 0.1, y: 0.2, w: 0.3, h: 0.1, text: "ojo", createdAt: 5 };

describe("zonas", () => {
  it("solo acepta rectángulos con área dentro de la hoja", () => {
    expect(isNoteRect({ x: 0, y: 0, w: 1, h: 1 })).toBe(true);
    expect(isNoteRect({ x: 0.8, y: 0, w: 0.3, h: 0.1 })).toBe(false);
    expect(isNoteRect({ x: 0, y: 0, w: 0, h: 0.1 })).toBe(false);
    expect(isNoteRect({ x: Number.NaN, y: 0, w: 0.1, h: 0.1 })).toBe(false);
  });
  it("el respaldo acepta notas válidas o ausentes y rechaza las dañadas", () => {
    expect(validateAssetNotes(undefined)).toEqual({ ok: true, value: [] });
    expect(validateAssetNotes({ notes: [note] })).toEqual({ ok: true, value: [note] });
    expect(validateAssetNotes({ notes: [{ ...note, w: 2 }] }).ok).toBe(false);
    expect(validateAssetNotes({ notes: [note, note] }).ok).toBe(false);
  });
});
