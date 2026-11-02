// T-036 (prueba primero)
import { describe, it, expect } from "vitest";
import { newId } from "./ids";

describe("newId", () => {
  it("genera 10 000 ids únicos con formato UUID", () => {
    const set = new Set(Array.from({ length: 10_000 }, () => newId()));
    expect(set.size).toBe(10_000);
    expect([...set][0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
