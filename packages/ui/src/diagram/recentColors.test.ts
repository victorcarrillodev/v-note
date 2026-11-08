// G-131 (prueba primero): últimos colores personalizados, como preferencia del dispositivo (no son contenido: no entran al respaldo).
import { describe, it, expect } from "vitest";
import { loadRecentColors, pushRecentColor, RECENT_KEY, MAX_RECENT } from "./recentColors";

const memory = (): Storage => { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 } as Storage; };

describe("colores recientes", () => {
  it("empiezan vacíos", () => { expect(loadRecentColors(memory())).toEqual([]); });
  it("guarda el último primero y no repite (sin distinguir mayúsculas)", () => {
    const s = memory();
    pushRecentColor("#ff0000", s); pushRecentColor("#00ff00", s); pushRecentColor("#FF0000", s);
    expect(loadRecentColors(s)).toEqual(["#ff0000", "#00ff00"]);
  });
  it("se limita a 8: el más antiguo se descarta", () => {
    const s = memory();
    for (let i = 0; i < 12; i++) pushRecentColor(`#0000${i.toString(16).padStart(2, "0")}`, s);
    const r = loadRecentColors(s);
    expect(r).toHaveLength(MAX_RECENT); expect(MAX_RECENT).toBe(8);
    expect(r[0]).toBe("#00000b"); expect(r).not.toContain("#000000");
  });
  it("solo guarda colores personalizados válidos: ni ids de paleta, ni «none», ni basura", () => {
    const s = memory();
    for (const bad of ["palette:red", "none", "rojo", "", "#zzz", "url(x)"]) pushRecentColor(bad, s);
    expect(loadRecentColors(s)).toEqual([]);
  });
  it("un valor dañado en el almacén se ignora, y sin almacén no lanza", () => {
    const s = memory(); s.setItem(RECENT_KEY, "{roto");
    expect(loadRecentColors(s)).toEqual([]);
    s.setItem(RECENT_KEY, JSON.stringify(["#aabbcc", 5, "palette:red", "#AABBCC"]));
    expect(loadRecentColors(s)).toEqual(["#aabbcc"]);
    expect(() => pushRecentColor("#123456", undefined)).not.toThrow();
  });
  it("si el almacén falla al escribir, no lanza", () => {
    const s = { ...memory(), setItem: () => { throw new Error("lleno"); } } as Storage;
    expect(() => pushRecentColor("#123456", s)).not.toThrow();
  });
});
