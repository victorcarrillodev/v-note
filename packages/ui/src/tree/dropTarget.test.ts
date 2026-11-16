// T-113 (prueba primero): a partir de la fila sobre la que se suelta y la zona (antes, dentro, después) se calcula el nuevo padre y la posición.
import { describe, it, expect } from "vitest";
import type { Page, PageNode } from "@vnote/core";
import { flattenTree } from "./flatten";
import { dropTarget, zoneAt } from "./dropTarget";

const page = (id: string): Page => ({ id, parentId: null, position: id, title: id, icon: null, cover: null, kind: "note", favorite: false, style: {}, description: null, locked: false, coverCredit: null, createdAt: 0, updatedAt: 0, deletedAt: null, deletedRootId: null });
const node = (id: string, children: PageNode[] = []): PageNode => ({ page: page(id), children });
// a ─ a1, a2      b      c
const tree = [node("a", [node("a1"), node("a2")]), node("b"), node("c")];
const rows = flattenTree(tree, new Set(["a"]));

describe("zoneAt", () => {
  it("divide la fila en cuartos: antes, dentro (mitad central) y después", () => {
    expect(zoneAt(100, 100, 40)).toBe("before");
    expect(zoneAt(100, 105, 40)).toBe("before");
    expect(zoneAt(100, 120, 40)).toBe("inside");
    expect(zoneAt(100, 135, 40)).toBe("after");
    expect(zoneAt(100, 139, 40)).toBe("after");
  });
});

describe("dropTarget", () => {
  it("antes de la primera hermana: al inicio de ese padre (afterId null)", () => {
    expect(dropTarget(rows, "c", "a", "before")).toEqual({ parentId: null, afterId: null });
    expect(dropTarget(rows, "a2", "a1", "before")).toEqual({ parentId: "a", afterId: null });
  });
  it("antes de otra hermana: justo después de la hermana anterior", () => {
    expect(dropTarget(rows, "c", "b", "before")).toEqual({ parentId: null, afterId: "a" });
    expect(dropTarget(rows, "b", "a2", "before")).toEqual({ parentId: "a", afterId: "a1" });
  });
  it("después de una fila: mismo padre, justo detrás de ella", () => {
    expect(dropTarget(rows, "c", "a", "after")).toEqual({ parentId: null, afterId: "a" });
    expect(dropTarget(rows, "c", "a1", "after")).toEqual({ parentId: "a", afterId: "a1" });
  });
  it("dentro: pasa a ser hija, al final", () => {
    expect(dropTarget(rows, "c", "b", "inside")).toEqual({ parentId: "b", afterId: undefined });
  });
  it("soltar sobre sí misma no hace nada", () => {
    expect(dropTarget(rows, "b", "b", "inside")).toBeNull();
    expect(dropTarget(rows, "b", "b", "before")).toBeNull();
  });
  it("«antes» de la hermana siguiente a la arrastrada, o «después» de la anterior, no cambia nada", () => {
    expect(dropTarget(rows, "b", "c", "before")).toBeNull(); // ya está justo antes de c
    expect(dropTarget(rows, "b", "a", "after")).toBeNull(); // ya está justo después de a
  });
  it("una fila inexistente devuelve null", () => {
    expect(dropTarget(rows, "b", "zzz", "inside")).toBeNull();
  });
});
