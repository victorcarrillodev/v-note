// U-108, U-109 (RF-13.1 a RF-13.4, CL-26): título de la ventana, íconos de la aplicación y colores del manifiesto derivados de la marca y los tokens.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { brandPlugin } from "./brandPlugin";
import { iconSvg } from "../design/iconSvg";
import { colors } from "../design/tokens";
import brandConfig from "../../../../brand.config.json";

const root = resolve(__dirname, "../../../..");
const pngSize = (file: string) => { const b = readFileSync(file); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };

describe("título de la ventana (RF-13.4)", () => {
  it("el plugin de marca sustituye el título por el nombre configurado", () => {
    const html = '<html><head><title>app</title></head></html>';
    const out = brandPlugin().transformIndexHtml(html);
    expect(out).toContain(`<title>${brandConfig.name}</title>`);
    expect(out).not.toContain("<title>app</title>");
  });
  it("escapa el nombre para no inyectar HTML", () => {
    const out = brandPlugin({ name: '<b>"x"</b>' }).transformIndexHtml("<title>app</title>");
    expect(out).toContain("&lt;b&gt;");
    expect(out).not.toContain("<b>");
  });
  it("las dos aplicaciones usan el plugin", () => {
    for (const a of ["web", "desktop"]) expect(readFileSync(resolve(root, `apps/${a}/vite.config.ts`), "utf8"), a).toContain("brandPlugin");
  });
});

describe("ícono de la aplicación (RF-13.1, RF-13.2)", () => {
  it("lleva la inicial del nombre configurado y el degradado del acento solo en el símbolo", () => {
    const svg = iconSvg(brandConfig.name);
    expect(svg).toContain(`>${Array.from(brandConfig.name)[0]!.toUpperCase()}<`);
    expect(svg).toContain(colors.accent.light);
    expect((svg.match(/<linearGradient/g) ?? []).length).toBe(1);
  });
  it("cambiar el nombre cambia el ícono sin tocar nada más", () => {
    expect(iconSvg("Zeta")).toContain(">Z<");
    expect(iconSvg("Zeta")).not.toBe(iconSvg("Uno"));
  });
  it("la versión maskable ocupa todo el lienzo (sin esquinas redondeadas) y deja zona segura", () => {
    const m = iconSvg("Zeta", { maskable: true });
    expect(m).not.toMatch(/rx="\d/);
    expect(m).toMatch(/font-size="\d+"/);
  });
  it("escapa el nombre", () => { expect(iconSvg("<&>")).not.toContain("<&>"); });
});

describe("archivos de ícono por plataforma (RF-13.3)", () => {
  const web: [string, number][] = [["icon-192.png", 192], ["icon-512.png", 512], ["icon-maskable-512.png", 512]];
  it.each(web)("navegador: %s existe y mide %i px", (f, n) => {
    const p = resolve(root, "apps/web/public/icons", f);
    expect(existsSync(p)).toBe(true);
    expect(pngSize(p)).toEqual({ w: n, h: n });
  });
  const desktop: [string, number][] = [["32x32.png", 32], ["128x128.png", 128], ["128x128@2x.png", 256], ["icon.png", 512]];
  it.each(desktop)("escritorio: %s existe y mide %i px", (f, n) => {
    const p = resolve(root, "apps/desktop/src-tauri/icons", f);
    expect(existsSync(p)).toBe(true);
    expect(pngSize(p)).toEqual({ w: n, h: n });
  });
  it("escritorio: existen .ico (Windows) y .icns (macOS) y están declarados en la configuración de empaquetado", () => {
    const dir = resolve(root, "apps/desktop/src-tauri");
    for (const f of ["icons/icon.ico", "icons/icon.icns"]) expect(existsSync(resolve(dir, f)), f).toBe(true);
    const conf = readFileSync(resolve(dir, "tauri.conf.json"), "utf8");
    expect(conf).toContain("icons/icon.ico");
    expect(conf).toContain("icons/icon.icns");
  });
});
