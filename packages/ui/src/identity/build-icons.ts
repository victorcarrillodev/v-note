// Genera los íconos de la aplicación a partir del nombre de `brand.config.json` (RF-13.1 a RF-13.3).
// Uso: `CHROME_BIN=/ruta/chrome bun packages/ui/src/identity/build-icons.ts`. Requiere Chrome (para rasterizar) y `tauri icon` (formatos de escritorio).
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import brandConfig from "../../../../brand.config.json";
import { iconSvg } from "../design/iconSvg";

const root = resolve(__dirname, "../../../..");
const chrome = process.env.CHROME_BIN ?? "/usr/bin/google-chrome-stable";
const font = resolve(__dirname, "../design/fonts/inter-latin-wght-normal.woff2");
const tmp = mkdtempSync(join(tmpdir(), "vnote-icons-"));

function render(svg: string, px: number, out: string) {
  const html = join(tmp, `i${px}.html`);
  writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>@font-face{font-family:"Inter Variable";src:url("file://${font}") format("woff2-variations");font-weight:100 900}html,body{margin:0;background:transparent}svg{display:block;width:${px}px;height:${px}px}</style>${svg}`);
  execFileSync(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", "--default-background-color=00000000", `--window-size=${px},${px}`, `--screenshot=${out}`, `file://${html}`], { stdio: "ignore" });
}

const web = resolve(root, "apps/web/public/icons");
mkdirSync(web, { recursive: true });
render(iconSvg(brandConfig.name), 192, join(web, "icon-192.png"));
render(iconSvg(brandConfig.name), 512, join(web, "icon-512.png"));
render(iconSvg(brandConfig.name, { maskable: true }), 512, join(web, "icon-maskable-512.png"));

const master = join(tmp, "master.png");
render(iconSvg(brandConfig.name), 1024, master);
const desktopIcons = resolve(root, "apps/desktop/src-tauri/icons");
execFileSync("bunx", ["tauri", "icon", master, "-o", desktopIcons], { cwd: resolve(root, "apps/desktop"), stdio: "ignore" });
for (const d of ["android", "ios"]) rmSync(join(desktopIcons, d), { recursive: true, force: true });
rmSync(tmp, { recursive: true, force: true });
console.log("íconos generados para", brandConfig.name);
