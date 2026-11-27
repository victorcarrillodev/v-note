import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const { security } = JSON.parse(readFileSync(join(root, "apps/desktop/src-tauri/tauri.conf.json"), "utf8")).app;

/** Todo host HTTPS al que el núcleo hace peticiones (carpetas de respaldo y Unsplash). */
function requestedHosts(): string[] {
  const hosts = new Set<string>();
  for (const dir of ["backup", "unsplash"]) {
    const base = join(root, "packages/core/src", dir);
    for (const f of readdirSync(base).filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts"))) {
      for (const m of readFileSync(join(base, f), "utf8").matchAll(/["'`](?:https:\/\/)?((?:[a-z0-9]+\.)?(?:github|dropboxapi|googleapis|unsplash)\.com)\b/g)) {
        // github.com y unsplash.com a secas son enlaces que se abren en el navegador, no peticiones.
        if (m[1] !== "github.com" && m[1] !== "unsplash.com") hosts.add(m[1]!);
      }
    }
  }
  return [...hosts];
}

describe("CSP de la app de escritorio", () => {
  const connect: string[] = security.csp["connect-src"].split(" ");

  it("permite cada host al que la app hace peticiones", () => {
    const hosts = requestedHosts();
    expect(hosts.length).toBeGreaterThanOrEqual(6);
    for (const host of hosts) expect(connect).toContain(`https://${host}`);
  });

  it("no permite scripts externos ni en línea, ni conexiones abiertas", () => {
    // WebAssembly (el intérprete de código de los bloques) sí; `eval` y scripts en línea o externos, no.
    expect(security.csp["script-src"]).toBe("'self' 'wasm-unsafe-eval'");
    expect(security.csp["script-src"]).not.toContain("'unsafe-eval'");
    expect(security.csp["script-src"]).not.toContain("'unsafe-inline'");
    expect(security.csp["object-src"]).toBe("'none'");
    expect(connect).not.toContain("*");
    expect(connect).not.toContain("https:");
  });
});
