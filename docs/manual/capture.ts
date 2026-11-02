// Genera las capturas del manual (docs/manual/img). Uso: CHROME_BIN=/ruta/chrome bun docs/manual/capture.ts
import { execFileSync, spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Page, launchChrome } from "../../tests-e2e/cdp";

const WEB = resolve(__dirname, "../../apps/web");
const OUT = resolve(__dirname, "img");
const PORT = 4180, CDP = 9340, URL_ = `http://localhost:${PORT}/`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  execFileSync("bunx", ["vite", "build"], { cwd: WEB, stdio: "ignore" });
  const server = spawn("bunx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { cwd: WEB, stdio: "ignore" });
  for (let i = 0; i < 50; i++) { try { await fetch(URL_); break; } catch { await sleep(200); } }
  const chrome = await launchChrome(CDP);
  try {
    const p = await Page.open(CDP, URL_);
    await p.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 760, deviceScaleFactor: 1, mobile: false });
    const shot = async (name: string) => { await sleep(500); const r = await p.send("Page.captureScreenshot", { format: "png" }); writeFileSync(resolve(OUT, `${name}.png`), Buffer.from(r.data, "base64")); console.log("ok", name); };
    const clickText = (t: string) => p.eval(`[...document.querySelectorAll('button')].find(b => b.innerText.trim() === ${JSON.stringify(t)} || b.getAttribute('aria-label') === ${JSON.stringify(t)}).click()`);
    const setInput = (sel: string, v: string) => p.eval(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(v)}); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    const view = (h: string) => p.waitFor(`[...document.querySelectorAll("h1, h2")].some(h => h.innerText.includes(${JSON.stringify(h)}) && !h.closest("aside"))`, 20000);

    await p.waitFor(`document.querySelector('input[aria-label="Nombre del espacio"]')`, 20000);
    await shot("01-espacios");
    await setInput('input[aria-label="Nombre del espacio"]', "Personal");
    await clickText("Crear espacio");
    await p.waitFor("document.querySelector('aside nav')", 20000);
    await shot("02-espacio-vacio");

    await clickText("Nueva página");
    await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === ''");
    await p.click('[aria-label="Título de la página"]'); await p.typeText("Plan del proyecto"); await p.key("Enter", "Enter", 13);
    await p.waitFor("document.querySelector('.bn-editor[contenteditable=true]')");
    await p.eval("document.querySelector('.bn-editor').focus()"); await sleep(300);
    await p.typeText("Objetivos de esta semana"); await p.key("Enter", "Enter", 13);
    await p.typeText("/"); await sleep(600);
    await shot("03-menu-barra");
    await p.key("Escape", "Escape", 27);
    await p.typeText("Terminar la maqueta y revisar con el equipo."); await sleep(500);
    await shot("04-pagina-editor");

    await clickText("Nueva página");
    await p.waitFor("document.querySelector('[aria-label=\"Título de la página\"]')?.value === ''");
    await p.click('[aria-label="Título de la página"]'); await p.typeText("Ideas sueltas"); await p.key("Enter", "Enter", 13);
    await sleep(500);

    await p.key("k", "KeyK", 75, 2); await p.waitFor("document.querySelector('[cmdk-input]')");
    await shot("05-paleta-recientes");
    await p.typeText("plan"); await sleep(700);
    await shot("06-paleta-busqueda");
    await p.key("Escape", "Escape", 27); await sleep(300);

    await clickText("Nueva base de datos"); await p.waitFor("[...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'Nueva fila')", 20000);
    await clickText("Nueva fila"); await sleep(300);
    await shot("07-base-de-datos");

    await clickText("Nuevo tablero"); await p.waitFor("document.body.innerText.includes('Por hacer')", 20000);
    await shot("08-tablero-kanban");

    await clickText("Exportar"); await p.waitFor("document.querySelector('[role=alertdialog]')");
    await shot("09-exportar");
    await p.key("Escape", "Escape", 27); await sleep(300);

    for (const [label, ready, name] of [["Papelera", "Papelera", "10-papelera"], ["Grafo", "Grafo", "11-grafo"], ["Importar", "Importar", "12-importar"], ["Recordatorios", "Recordatorios", "13-recordatorios"], ["Respaldo", "Respaldo", "14-respaldo"], ["Ajustes", "Ajustes", "15-ajustes"], ["Restaurar desde GitHub", "Restaurar", "16-restaurar"]] as const) {
      await clickText(label); await view(ready); await shot(name);
    }
    await p.close();
  } finally { chrome.stop(); server.kill("SIGKILL"); try { execFileSync("pkill", ["-f", `vite preview --port ${PORT}`]); } catch { /* ya terminó */ } }
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
