// Cambios de estilo seguidos (RF-4.6): se suman en vez de pisarse, aunque el primero no haya llegado aún a la pantalla.
import { describe, it, expect } from "vitest";
import { makeController } from "../../tests/withController";

const styleOf = (c: Awaited<ReturnType<typeof makeController>>["controller"], id: string) => c.getSnapshot().tree.find((n) => n.page.id === id)!.page.style;

describe("patchPageStyle", () => {
  it("dos cambios lanzados sin esperar se suman", async () => {
    const { controller } = await makeController();
    const r = await controller.createPage(null, "A");
    if (!r.ok) throw new Error("x");
    const a = controller.patchPageStyle(r.value.id, { typography: { body: "lora" } });
    const b = controller.patchPageStyle(r.value.id, { typography: { headings: "caveat" } });
    const c = controller.patchPageStyle(r.value.id, { accent: "blue" });
    await Promise.all([a, b, c]);
    expect(styleOf(controller, r.value.id)).toEqual({ typography: { body: "lora", headings: "caveat" }, accent: "blue" });
  });
  it("cada cambio es una entrada del historial", async () => {
    const { controller } = await makeController();
    const r = await controller.createPage(null, "A");
    if (!r.ok) throw new Error("x");
    await Promise.all([controller.patchPageStyle(r.value.id, { accent: "red" }), controller.patchPageStyle(r.value.id, { accent: "green" })]);
    await controller.undoPageProps(r.value.id);
    expect(styleOf(controller, r.value.id)).toEqual({ accent: "red" });
    await controller.undoPageProps(r.value.id);
    expect(styleOf(controller, r.value.id)).toEqual({});
  });
  it("un fallo no deja la cola bloqueada", async () => {
    const { controller } = await makeController();
    const bad = await controller.patchPageStyle("no-existe", { accent: "red" });
    expect(bad.ok).toBe(false);
    const r = await controller.createPage(null, "A");
    if (!r.ok) throw new Error("x");
    expect((await controller.patchPageStyle(r.value.id, { accent: "red" })).ok).toBe(true);
  });
});

describe("usePageStyleAsDefault", () => {
  it("toma el estilo actual de la página, incluidos los cambios que aún están en cola", async () => {
    const { controller } = await makeController();
    const r = await controller.createPage(null, "A");
    if (!r.ok) throw new Error("x");
    const change = controller.patchPageStyle(r.value.id, { accent: "purple" }); // sin esperar
    const def = await controller.usePageStyleAsDefault(r.value.id);
    await change;
    expect(def.ok && def.value).toEqual({ accent: "purple" });
    expect(await controller.defaultStyle()).toEqual({ accent: "purple" });
  });
});
