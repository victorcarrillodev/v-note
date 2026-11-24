// Empaqueta el instalador de la plataforma actual y copia el resultado a dist-installers/.
// Uso: bun run installer [--windows]  (--windows: desde Linux, cruza a Windows con cargo-xwin + NSIS; solo .exe)
// Uso: bun run installer   (Linux: .deb/.AppImage[/.rpm]; Windows: .exe NSIS y .msi)
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { brandOverrides } from "./brand-overrides.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const desktop = join(root, "apps/desktop");
const out = join(root, "dist-installers");
const run = (cmd, args, cwd = root) => {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) { console.error(`Falló: ${cmd} ${args.join(" ")}`); process.exit(r.status ?? 1); }
};

const has = (cmd) => spawnSync(process.platform === "win32" ? "where" : "which", [cmd], { stdio: "ignore" }).status === 0;
const cross = process.platform === "linux" && process.argv.includes("--windows");
const bundles = cross ? ["nsis"] : process.platform === "win32" ? ["nsis", "msi"]
  : process.platform === "linux" ? ["deb", "appimage", ...(has("rpmbuild") ? ["rpm"] : [])]
  : null;
if (cross) for (const t of ["makensis", "cargo-xwin", "clang", "lld"]) if (!has(t)) { console.error(`Falta ${t} para compilar a Windows desde Linux.`); process.exit(1); }
if (!bundles) { console.error("Plataforma no soportada (solo Linux y Windows)."); process.exit(1); }

run("bun", ["run", "tauri", "build", "--bundles", bundles.join(","), "--config", brandOverrides(), ...(cross ? ["--runner", "cargo-xwin", "--target", "x86_64-pc-windows-msvc"] : [])], desktop);

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const bundleDir = join(desktop, "src-tauri/target", cross ? "x86_64-pc-windows-msvc/release" : "release", "bundle");
const exts = [".deb", ".appimage", ".rpm", ".exe", ".msi"];
const found = [];
for (const sub of readdirSync(bundleDir)) {
  const dir = join(bundleDir, sub);
  if (!statSync(dir).isDirectory()) continue;
  for (const f of readdirSync(dir)) {
    if (exts.some((e) => f.toLowerCase().endsWith(e))) { cpSync(join(dir, f), join(out, f)); found.push(f); }
  }
}
if (!found.length) { console.error("No se generó ningún instalador."); process.exit(1); }
console.log(`\nInstaladores en dist-installers/:\n${found.map((f) => "  " + f).join("\n")}`);
