// R-018 (prueba primero): utilidad genérica de instantáneas (plan 004, DP-12).
import { describe, it, expect } from "vitest";
import { Snapshots } from "./history";

const make = (limit?: number) => new Snapshots<{ n: number }>({ n: 0 }, (v) => JSON.stringify(v), limit);

describe("Snapshots", () => {
  it("empieza sin pasos", () => {
    const h = make();
    expect(h.current).toEqual({ n: 0 });
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
    expect(h.undo()).toBeNull();
    expect(h.redo()).toBeNull();
  });
  it("deshace y rehace", () => {
    const h = make();
    h.push({ n: 1 }); h.push({ n: 2 });
    expect(h.undo()).toEqual({ n: 1 });
    expect(h.current).toEqual({ n: 1 });
    expect(h.canRedo).toBe(true);
    expect(h.redo()).toEqual({ n: 2 });
  });
  it("un cambio idéntico no añade paso", () => {
    const h = make();
    h.push({ n: 0 });
    expect(h.canUndo).toBe(false);
    h.push({ n: 1 }); h.push({ n: 1 });
    h.undo();
    expect(h.canUndo).toBe(false);
  });
  it("editar tras deshacer descarta el futuro", () => {
    const h = make();
    h.push({ n: 1 }); h.push({ n: 2 });
    h.undo();
    h.push({ n: 9 });
    expect(h.canRedo).toBe(false);
    expect(h.undo()).toEqual({ n: 1 });
  });
  it("el límite descarta los pasos más antiguos", () => {
    const h = make(3);
    for (let i = 1; i <= 6; i++) h.push({ n: i });
    let undone = 0;
    while (h.undo()) undone++;
    expect(undone).toBe(3);
    expect(h.current).toEqual({ n: 3 });
  });
  it("el límite por defecto es 100", () => {
    const h = make();
    for (let i = 1; i <= 150; i++) h.push({ n: i });
    let undone = 0;
    while (h.undo()) undone++;
    expect(undone).toBe(100);
  });
});
