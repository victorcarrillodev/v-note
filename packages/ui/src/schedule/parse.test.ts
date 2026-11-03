// U-227 y U-228 (RF-8.1): entrada escrita de fecha y hora.
import { describe, it, expect } from "vitest";
import { parseTime, parseDate, addMinutes } from "./parse";

describe("parseTime", () => {
  it("acepta HH:mm, H:mm, HHmm y H", () => {
    expect(parseTime("09:30")).toBe("09:30");
    expect(parseTime("9:30")).toBe("09:30");
    expect(parseTime("0930")).toBe("09:30");
    expect(parseTime("930")).toBe("09:30");
    expect(parseTime("9")).toBe("09:00");
    expect(parseTime(" 14.45 ")).toBe("14:45");
  });
  it("acepta am/pm", () => {
    expect(parseTime("9 pm")).toBe("21:00");
    expect(parseTime("12am")).toBe("00:00");
    expect(parseTime("12:15 PM")).toBe("12:15");
    expect(parseTime("7:05 a. m.")).toBe("07:05");
  });
  it("rechaza lo inexistente", () => {
    for (const bad of ["", "25:00", "9:75", "abc", "24:00", "13pm", "9:3x"]) expect(parseTime(bad), bad).toBeNull();
  });
});
describe("parseDate", () => {
  it("acepta AAAA-MM-DD y DD/MM/AAAA", () => {
    expect(parseDate("2026-03-05")).toBe("2026-03-05");
    expect(parseDate("5/3/2026")).toBe("2026-03-05");
    expect(parseDate("05/03/2026")).toBe("2026-03-05");
  });
  it("rechaza fechas que no existen", () => {
    for (const bad of ["", "2026-02-30", "31/04/2026", "2026-13-01", "hoy", "5/3"]) expect(parseDate(bad), bad).toBeNull();
  });
});
describe("addMinutes", () => {
  it("suma a una hora del mismo día y avisa si cruza al siguiente", () => {
    expect(addMinutes("09:30", 45)).toEqual({ time: "10:15", dayOffset: 0 });
    expect(addMinutes("23:30", 90)).toEqual({ time: "01:00", dayOffset: 1 });
  });
});
