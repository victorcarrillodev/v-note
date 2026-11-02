// T-002 (prueba primero): la app Tauri arranca, carga el webview y reporta un "latido".
import { test, expect } from "bun:test";
import { existsSync, rmSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";

const OUT = new URL("../out/heartbeat.json", import.meta.url).pathname;

test("la app arranca y el webview reporta un latido", async () => {
  if (existsSync(OUT)) rmSync(OUT);
  const proc = spawn("bun", ["run", "tauri", "dev"], {
    cwd: new URL("..", import.meta.url).pathname,
    stdio: "ignore",
    detached: true,
  });
  try {
    const deadline = Date.now() + 15 * 60_000; // la primera compilación de Rust es lenta
    while (!existsSync(OUT) && Date.now() < deadline) await Bun.sleep(2000);
    expect(existsSync(OUT)).toBe(true);
    const beat = JSON.parse(readFileSync(OUT, "utf8"));
    expect(beat.userAgent).toContain("AppleWebKit");
    expect(typeof beat.ts).toBe("number");
  } finally {
    try { process.kill(-proc.pid!, "SIGTERM"); } catch {}
  }
}, 16 * 60_000);
