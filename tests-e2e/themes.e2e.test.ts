// Spec 006, Fase 5 (T-082, T-083): el tema elegido se conserva al reiniciar y ya está puesto antes de que la aplicación se monte.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startWeb, ensureSpace, clickButton, type Web } from "./webHarness";

let web: Web;
beforeAll(async () => { web = await startWeb(4191, 9391); }, 180000);
afterAll(async () => { await web?.closeAll(); web?.stop(); });

const attrs = `JSON.stringify([document.documentElement.getAttribute('data-theme'), document.documentElement.getAttribute('data-palette')])`;
const pickTheme = (value: string) => `(() => { const i = document.querySelector('input[name=theme][value=${value}]'); i.click(); return i.checked; })()`;

describe("temas de color en el navegador real", () => {
  it("elegir un tema en Ajustes y recargar: sigue elegido (RF-2.3, RF-2.5)", async () => {
    const p = await web.open();
    await ensureSpace(p);
    await clickButton(p, "Ajustes");
    await p.waitFor("document.querySelector('input[name=theme]')", 20000);
    expect(await p.eval<boolean>(pickTheme("ambar"))).toBe(true);
    expect(await p.eval<string>(attrs)).toBe('["dark","ambar"]');
    expect(await p.eval<string>("localStorage.getItem('vnote:theme')")).toBe("ambar");
    await p.reload();
    await p.waitFor("document.querySelector('aside nav')", 30000);
    expect(await p.eval<string>(attrs)).toBe('["dark","ambar"]');
    // el color de fondo calculado es el del tema (Ámbar: #17120C)
    expect(await p.eval<string>("getComputedStyle(document.documentElement).getPropertyValue('--c-canvas').trim().toLowerCase()")).toBe("#17120c");
    await clickButton(p, "Ajustes");
    await p.waitFor("document.querySelector('input[name=theme]')", 20000);
    expect(await p.eval<boolean>("document.querySelector('input[name=theme][value=ambar]').checked")).toBe(true);
    await p.close();
  }, 120000);

  it("al cargar, data-theme y data-palette ya están puestos antes de que exista la raíz de la aplicación (RF-3.5)", async () => {
    const q = await web.open();
    await q.send("Page.addScriptToEvaluateOnNewDocument", { source: `
      try { localStorage.setItem("vnote:theme", "esmeralda"); } catch (e) {}
      window.__first = null;
      new MutationObserver(() => { if (window.__first === null && document.documentElement.hasAttribute("data-palette")) window.__first = { theme: document.documentElement.getAttribute("data-theme"), palette: document.documentElement.getAttribute("data-palette"), rootExists: !!document.getElementById("root") }; })
        .observe(document, { attributes: true, subtree: true, attributeFilter: ["data-theme", "data-palette"] });
    ` });
    await q.reload();
    await q.waitFor("document.getElementById('root') && document.getElementById('root').childElementCount > 0", 30000);
    const first = await q.eval<{ theme: string; palette: string; rootExists: boolean }>("window.__first");
    expect(first).toEqual({ theme: "dark", palette: "esmeralda", rootExists: false });
    await q.close();
  }, 120000);
});
