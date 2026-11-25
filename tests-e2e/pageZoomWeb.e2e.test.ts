// Zoom de página con Ctrl + rueda e indicador, y editor sin anillo de foco (e2e real en Chrome).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startWeb, ensureSpace, newPage, type Web } from "./webHarness";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let web: Web;
beforeAll(async () => { web = await startWeb(4207, 9407); }, 180000);
afterAll(async () => { await web?.closeAll(); web?.stop(); });

describe("zoom de página (web)", () => {
  it("Ctrl + rueda cambia el zoom, el indicador restablece y el editor no se enmarca", async () => {
    const p = await web.open();
    await ensureSpace(p);
    await newPage(p, "Zoom");
    await p.click(".bn-editor");
    await p.typeText("texto de prueba");
    await p.key("ArrowLeft", "ArrowLeft", 37);
    await sleep(300);
    expect(await p.eval<string>("getComputedStyle(document.querySelector('.bn-editor')).outlineStyle")).toBe("none");

    const width = () => p.eval<number>("document.querySelector('.bn-editor .bn-inline-content').getBoundingClientRect().height");
    const before = await width();
    const buttonFont = () => p.eval<string>("getComputedStyle([...document.querySelectorAll('[data-testid=page-header] button')].at(-1)).fontSize");
    const fontBefore = await buttonFont();
    const { x, y } = await p.center(".bn-editor");
    for (let i = 0; i < 3; i++) await p.send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: -100, modifiers: 2 });
    await sleep(500);
    expect(await p.eval<string>("document.querySelector('[data-testid=page-zoom]').style.getPropertyValue('--page-zoom')")).toBe("1.3");
    expect(await width()).toBeGreaterThan(before * 1.2);

    // Los controles conservan su tamaño y no aparece desplazamiento horizontal.
    expect(await buttonFont()).toBe(fontBefore);
    expect(await p.eval<boolean>("(() => { const m = document.querySelector('main'); return m.scrollWidth <= m.clientWidth; })()")).toBe(true);
    // Un clic en el texto ampliado deja el cursor donde se hizo clic.
    await p.click(".bn-editor .bn-inline-content");
    await sleep(200);
    expect(await p.eval<boolean>("!!getSelection().anchorNode?.textContent?.includes('texto de prueba')")).toBe(true);
    const shot = await p.send("Page.captureScreenshot", {});
    (await import("node:fs")).writeFileSync(process.env.SHOT ?? "/dev/null", Buffer.from(shot.data, "base64"));

    await p.click('[aria-label="Restablecer zoom"]');
    await sleep(300);
    expect(await p.eval<string>("document.querySelector('[data-testid=page-zoom]').style.getPropertyValue('--page-zoom')")).toBe("");
    expect(p.errors).toEqual([]);
  }, 120000);
});
