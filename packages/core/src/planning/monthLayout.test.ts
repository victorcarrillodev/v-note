// U-192 (RF-7.1, CL-10, CL-12) y U-221 (RF-7.3, CL-11): calendario mensual y agrupación de simultáneos.
import { describe, it, expect } from "vitest";
import { monthGrid, layoutMonth, MAX_VISIBLE_PER_DAY } from "./monthLayout";
import { groupCrowded } from "./weekLayout";
import type { PlanEvent, Segment } from "./weekLayout";

const ev = (id: string, start: string, end?: string): PlanEvent => ({ id, title: id, start, ...(end ? { end } : {}) });

describe("monthGrid", () => {
  it("marzo de 2026 empieza en domingo: la rejilla arranca el lunes 23 de febrero y tiene 6 semanas", () => {
    const g = monthGrid("2026-03");
    expect(g[0]![0]).toMatchObject({ date: "2026-02-23", inMonth: false });
    expect(g).toHaveLength(6);
    expect(g.flat().filter((d) => d.inMonth)).toHaveLength(31);
    expect(g.every((w) => w.length === 7)).toBe(true);
  });
  it("febrero de 2027 cabe en 4 semanas", () => { expect(monthGrid("2027-02")).toHaveLength(4); });
});

describe("layoutMonth: 12 eventos en un día (CL-10)", () => {
  const twelve = Array.from({ length: 12 }, (_, i) => ev(`e${i}`, `2026-03-10T${String(8 + (i % 10)).padStart(2, "0")}:00`));
  it("muestra los primeros y resume el resto en «+N más»", () => {
    const m = layoutMonth(twelve, "2026-03");
    const cell = m.days.get("2026-03-10")!;
    expect(cell.shown).toHaveLength(MAX_VISIBLE_PER_DAY);
    expect(cell.more).toBe(12 - MAX_VISIBLE_PER_DAY);
    expect(cell.all).toHaveLength(12);
  });
  it("el listado completo del día está ordenado por hora", () => {
    const all = layoutMonth(twelve, "2026-03").days.get("2026-03-10")!.all.map((e) => e.start);
    expect([...all].sort()).toEqual(all);
  });
  it("un día con pocos eventos no muestra «+N más»", () => {
    expect(layoutMonth([ev("a", "2026-03-11T09:00")], "2026-03").days.get("2026-03-11")!.more).toBe(0);
  });
});

describe("layoutMonth: barras de varios días (CL-12)", () => {
  it("un evento de lunes a miércoles es una barra en su semana", () => {
    const m = layoutMonth([ev("v", "2026-03-09", "2026-03-11")], "2026-03");
    expect(m.bars).toEqual([{ id: "v", week: 2, startCol: 0, endCol: 2, row: 0, continuesBefore: false, continuesAfter: false }]);
  });
  it("si cruza de semana se parte en una barra por semana", () => {
    const m = layoutMonth([ev("v", "2026-03-12", "2026-03-17")], "2026-03");
    expect(m.bars.map((b) => [b.week, b.startCol, b.endCol, b.continuesBefore, b.continuesAfter])).toEqual([[2, 3, 6, false, true], [3, 0, 1, true, false]]);
  });
  it("barras que coinciden en días usan filas distintas", () => {
    const m = layoutMonth([ev("a", "2026-03-09", "2026-03-12"), ev("b", "2026-03-10", "2026-03-11")], "2026-03");
    expect(new Set(m.bars.map((b) => b.row)).size).toBe(2);
  });
  it("un evento de varios días con hora también es barra y no se cuenta como evento suelto del día", () => {
    const m = layoutMonth([ev("v", "2026-03-09T22:00", "2026-03-11T08:00")], "2026-03");
    expect(m.bars).toHaveLength(1);
    expect(m.days.get("2026-03-09")!.all).toHaveLength(0);
  });
});

describe("groupCrowded (U-221)", () => {
  const seg = (id: string, lane: number, lanes: number): Segment => ({ id, day: 0, startMin: 540, endMin: 600, lane, lanes, continuesBefore: false, continuesAfter: false });
  it("con pocos simultáneos no agrupa nada", () => {
    const g = groupCrowded([seg("a", 0, 3), seg("b", 1, 3), seg("c", 2, 3)], 4);
    expect(g.visible).toHaveLength(3);
    expect(g.groups).toEqual([]);
  });
  it("con 8 solapados muestra 3 y agrupa 5 con acceso al detalle", () => {
    const eight = Array.from({ length: 8 }, (_, i) => seg(`e${i}`, i, 8));
    const g = groupCrowded(eight, 4);
    expect(g.visible.map((s) => s.id)).toEqual(["e0", "e1", "e2"]);
    expect(g.groups).toEqual([{ day: 0, startMin: 540, endMin: 600, ids: ["e3", "e4", "e5", "e6", "e7"] }]);
    expect(g.visible.every((s) => s.lanes === 4)).toBe(true);
  });
});
