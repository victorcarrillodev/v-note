// U-191 (CL-14): la línea de «ahora» sigue la hora local vigente, también si cambia la zona horaria.
import { describe, it, expect } from "vitest";
import { nowPosition } from "./nowLine";

const T = Date.UTC(2026, 2, 4, 15, 30); // 4 mar 2026 15:30 UTC
describe("nowPosition", () => {
  it("con UTC−6 es 09:30 del miércoles (día 2 de la semana del 2 de marzo)", () => {
    expect(nowPosition(T, -360, "2026-03-02")).toEqual({ day: 2, minute: 570 });
  });
  it("al viajar a UTC+1 el mismo instante pasa a ser 16:30 sin tocar los eventos", () => {
    expect(nowPosition(T, 60, "2026-03-02")).toEqual({ day: 2, minute: 990 });
  });
  it("un cambio de zona que cruza medianoche cambia de día", () => {
    expect(nowPosition(Date.UTC(2026, 2, 4, 23, 30), 120, "2026-03-02")).toEqual({ day: 3, minute: 90 });
  });
  it("fuera de la semana mostrada no hay línea", () => {
    expect(nowPosition(T, -360, "2026-03-09")).toBeNull();
    expect(nowPosition(T, -360, "2026-02-23")).toBeNull();
  });
});
