// U-163 (e2e real en Chrome): el bloque de código insertado desde «/» tiene lenguaje, copia y confirma «Copiado» 1,5 s.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startWeb, ensureSpace, newPage, setValue, type Web } from "./webHarness";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let web: Web;
beforeAll(async () => { web = await startWeb(4199, 9399); }, 180000);
afterAll(async () => { await web?.closeAll(); web?.stop(); });

describe("U-163 web", () => {
  it("inserta código, cambia lenguaje y copia con confirmación", async () => {
    const p = await web.open();
    await ensureSpace(p);
    await newPage(p, "Código web");
    await p.click(".bn-editor");
    await p.typeText("/");
    await sleep(500);
    await p.typeText("código");
    await sleep(500);
    await p.key("Enter", "Enter", 13);
    await sleep(500);
    expect(await p.eval<boolean>("!!document.querySelector('.bn-editor [data-content-type=codeBlock]')")).toBe(true);
    expect(await p.eval<boolean>("!!document.querySelector('.bn-editor [data-code-language]')")).toBe(true);
    await setValue(p, ".bn-editor [data-code-language]", "javascript");
    await sleep(200);
    expect(await p.eval<string>("document.querySelector('.bn-editor [data-code-language]').getAttribute('data-value')")).toBe("javascript");
    await p.click(".bn-editor [data-code-content]");
    await p.typeText("const a = 1;");
    await sleep(300);
    await p.eval("Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__copiado = t; } }, configurable: true }); window.__copiado = null;");
    await p.click(".bn-editor [data-copy-code]");
    await sleep(200);
    const label = () => p.eval<string>("document.querySelector('.bn-editor [data-copy-code]').innerText");
    expect(await label()).toContain("Copiado");
    expect(await p.eval<string>("window.__copiado")).toContain("const a = 1;");
    await sleep(1600);
    expect(await label()).toContain("Copiar");
    expect(p.errors).toEqual([]);
  }, 120000);
});
