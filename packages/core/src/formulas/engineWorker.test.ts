// T-261 (prueba primero): el recálculo corre detrás de un puerto de mensajes (un Worker en el navegador/escritorio) y se puede cancelar.
import { describe, it, expect } from "vitest";
import { serveEngine, EngineClient, type SerializableEngineInput } from "./engineWorker";
import type { PropDef } from "./dependencies";

const prop = (id: string, db: string, type: string, config: Record<string, unknown> = {}): PropDef => ({ id, name: id, databaseId: db, type, config });
function input(n: number): SerializableEngineInput {
  const rows: SerializableEngineInput["rows"] = { d1: {} };
  for (let i = 0; i < n; i++) rows.d1![`p${i}`] = { costo: i, cant: 2 };
  return { props: [prop("costo", "d1", "number"), prop("cant", "d1", "number"), prop("total", "d1", "formula", { expression: 'prop("costo") * prop("cant")' })], rows, links: {}, nowMs: Date.UTC(2026, 2, 5) };
}
/** Un par de puertos en memoria, como los de un Worker real (los mensajes se clonan y llegan de forma asíncrona). */
function pair() {
  const { port1, port2 } = new MessageChannel();
  serveEngine(port1 as never);
  const client = new EngineClient(port2 as never);
  return { client, close: () => { port1.close(); port2.close(); } };
}

describe("cálculo detrás de un puerto", () => {
  it("calcula y devuelve los valores de todas las filas", async () => {
    const { client, close } = pair();
    const r = await client.compute(input(50));
    expect(r.status).toBe("done");
    if (r.status === "done") { expect(r.values.d1!.p7!.total).toBe(14); expect(Object.keys(r.values.d1!)).toHaveLength(50); }
    close();
  });
  it("cancelar a la mitad devuelve «cancelado» y NINGÚN valor a medias", async () => {
    const { client, close } = pair();
    const ac = new AbortController();
    const p = client.compute(input(30_000), { signal: ac.signal, chunk: 200 });
    setTimeout(() => ac.abort(), 5);
    const r = await p;
    expect(r.status).toBe("cancelled");
    expect("values" in r).toBe(false);
    close();
  });
  it("tras cancelar se puede volver a calcular y queda correcto", async () => {
    const { client, close } = pair();
    const ac = new AbortController(); ac.abort();
    expect((await client.compute(input(100), { signal: ac.signal })).status).toBe("cancelled");
    const r = await client.compute(input(100));
    expect(r.status).toBe("done");
    if (r.status === "done") expect(r.values.d1!.p3!.total).toBe(6);
    close();
  });
  it("varias peticiones a la vez se atienden por separado", async () => {
    const { client, close } = pair();
    const [a, b] = await Promise.all([client.compute(input(10)), client.compute(input(20))]);
    expect(a.status === "done" && Object.keys(a.values.d1!).length).toBe(10);
    expect(b.status === "done" && Object.keys(b.values.d1!).length).toBe(20);
    close();
  });
  it("una definición circular se informa como error, sin colgar el puerto", async () => {
    const { client, close } = pair();
    const bad = input(3);
    bad.props.push(prop("a", "d1", "formula", { expression: 'prop("b")' }), prop("b", "d1", "formula", { expression: 'prop("a")' }));
    const r = await client.compute(bad);
    expect(r.status).toBe("error");
    expect((await client.compute(input(3))).status).toBe("done"); // sigue funcionando
    close();
  });
});
