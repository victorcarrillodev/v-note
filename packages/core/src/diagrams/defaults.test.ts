// G-142 a G-145 (prueba primero): estilos predeterminados de diagramas, por espacio de trabajo (en la tabla `meta`).
import { describe, it, expect } from "vitest";
import { createNodeSqliteStore } from "../../tests/support/nodeSqliteStore";
import { migrate } from "../db/migrate";
import { migrations } from "../db/migrations";
import { clearDiagramDefaults, loadDiagramDefaults, saveEdgeDefault, saveShapeDefault, serializeDiagramDefaults, parseDiagramDefaults, applyDefaultsToDiagramParts } from "./defaults";
import { addNode, connect, emptyDiagram } from "./diagram";
import { completeEdgeStyle, completeNodeStyle } from "./style";

const newStore = async () => { const d = await createNodeSqliteStore(":memory:"); await migrate(d, migrations); return d; };
const must = <T,>(r: { ok: boolean; value?: T; error?: { message: string } }): T => { if (!r.ok) throw new Error(r.error?.message); return r.value as T; };

describe("leer, escribir y restablecer", () => {
  it("un espacio sin predeterminados devuelve un objeto vacío", async () => {
    expect(await loadDiagramDefaults(await newStore())).toEqual({});
  });
  it("guarda el estilo de forma y el de conector (con su trazado) y los lee", async () => {
    const s = await newStore();
    await saveShapeDefault(s, completeNodeStyle("process", { fill: "palette:green", stroke: "#b45309" }));
    await saveEdgeDefault(s, completeEdgeStyle({ color: "#dc2626", width: "thick" }), "curved");
    const d = await loadDiagramDefaults(s);
    expect(d.shape).toMatchObject({ fill: "palette:green", stroke: "#b45309" });
    expect(d.edge).toMatchObject({ route: "curved", style: { color: "#dc2626", width: "thick" } });
  });
  it("dos espacios tienen predeterminados independientes", async () => {
    const a = await newStore(), b = await newStore();
    await saveShapeDefault(a, completeNodeStyle("process", { fill: "palette:green" }));
    await saveShapeDefault(b, completeNodeStyle("process", { fill: "palette:red" }));
    expect((await loadDiagramDefaults(a)).shape!.fill).toBe("palette:green");
    expect((await loadDiagramDefaults(b)).shape!.fill).toBe("palette:red");
  });
  it("restablecer borra ambos y vuelve a los del sistema", async () => {
    const s = await newStore();
    await saveShapeDefault(s, completeNodeStyle("process", { fill: "palette:green" })); await saveEdgeDefault(s, completeEdgeStyle({ width: "thick" }), "free");
    await clearDiagramDefaults(s);
    expect(await loadDiagramDefaults(s)).toEqual({});
  });
  it("un valor dañado en la base se ignora sin lanzar", async () => {
    const s = await newStore();
    await s.exec("INSERT OR REPLACE INTO meta(key, value) VALUES ('diagram.default.shape', '{roto')");
    await s.exec("INSERT OR REPLACE INTO meta(key, value) VALUES ('diagram.default.edge', '{\"route\":\"zigzag\",\"style\":{\"width\":\"gordo\"}}')");
    expect(await loadDiagramDefaults(s)).toEqual({});
  });
});

describe("los elementos nuevos nacen con el predeterminado de su tipo (G-143, G-144)", () => {
  it("una forma nueva usa el predeterminado de forma y un conector nuevo el de conector y su trazado", () => {
    const defaults = { shape: completeNodeStyle("process", { fill: "palette:green", stroke: "#b45309" }), edge: { style: completeEdgeStyle({ color: "#dc2626" }), route: "curved" as const } };
    const parts = applyDefaultsToDiagramParts(defaults);
    let d = emptyDiagram();
    const n = addNode(d, { shape: "decision", x: 0, y: 0, style: parts.node }).node;
    expect(n.style).toMatchObject({ fill: "palette:green", stroke: "#b45309" });
    d = addNode(d, { shape: "process", x: 0, y: 0, id: "a" }).diagram; d = addNode(d, { shape: "process", x: 300, y: 0, id: "b" }).diagram;
    const e = must(connect(d, { node: "a", anchor: "e" }, { node: "b", anchor: "w" }, parts.edge)).edge;
    expect(e).toMatchObject({ route: "curved", style: { color: "#dc2626" } });
  });
  it("sin predeterminados usan los del sistema; guardarlos no cambia los elementos que ya existen", () => {
    const parts = applyDefaultsToDiagramParts({});
    expect(parts.node).toBeUndefined(); expect(parts.edge).toEqual({});
    let d = emptyDiagram();
    d = addNode(d, { shape: "process", x: 0, y: 0, id: "viejo" }).diagram;
    const before = JSON.stringify(d);
    const withDefault = addNode(d, { shape: "process", x: 0, y: 100, id: "nuevo", style: completeNodeStyle("process", { fill: "palette:red" }) }).diagram;
    expect(JSON.stringify({ ...withDefault, nodes: [withDefault.nodes[0]!] })).toBe(JSON.stringify({ ...d, nodes: [d.nodes[0]!] })); // el existente igual
    expect(before).toBe(JSON.stringify(d));
  });
});

describe("serialización para el respaldo (G-146, G-147)", () => {
  it("sin predeterminados no hay archivo", () => { expect(serializeDiagramDefaults({})).toBeNull(); });
  it("es determinista y se puede leer de vuelta", () => {
    const defaults = { shape: completeNodeStyle("process", { fill: "palette:green" }), edge: { style: completeEdgeStyle({ width: "thick" }), route: "free" as const } };
    const a = serializeDiagramDefaults(defaults)!, b = serializeDiagramDefaults({ edge: defaults.edge, shape: defaults.shape })!;
    expect(new TextDecoder().decode(a)).toBe(new TextDecoder().decode(b));
    expect(parseDiagramDefaults(JSON.parse(new TextDecoder().decode(a)))).toEqual({ ok: true, value: defaults });
  });
  it("un archivo inválido se rechaza sin lanzar", () => {
    expect(parseDiagramDefaults({ shape: { fill: "rojo" } }).ok).toBe(false);
    expect(parseDiagramDefaults({ edge: { route: "zigzag", style: {} } }).ok).toBe(false);
    expect(parseDiagramDefaults("texto").ok).toBe(false);
    expect(parseDiagramDefaults({}).ok).toBe(true);
  });
});
