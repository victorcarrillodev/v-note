// Regenera `looseValues.baseline.json` con el estado actual (uso: `bun packages/ui/src/design/build-baseline.ts`). Solo debe ejecutarse para REDUCIRLO.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { scanSource } from "./looseValues";

const root = resolve(__dirname, "..");
const out: Record<string, number> = {};
const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== "node_modules" && f !== "design") walk(p); } else if (/\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)) { const n = scanSource(readFileSync(p, "utf8")); if (n > 0) out[relative(root, p)] = n; } } };
walk(root);
writeFileSync(resolve(__dirname, "looseValues.baseline.json"), JSON.stringify(Object.fromEntries(Object.entries(out).sort()), null, 2) + "\n");
console.log("archivos con excepciones:", Object.keys(out).length, "valores:", Object.values(out).reduce((a, b) => a + b, 0));
