// Genera fixtures: contenido real creado con BlockNote + su estado Yjs, para comparar con el conversor puro.
import { writeFileSync } from "node:fs";
import { startApp, stopApp, find, runAsync } from "./webdriver";

const name = process.argv[2];
const blocksJson = (await Bun.file(new URL(`../fixtures/${name}.blocks.json`, import.meta.url)).text()).trim();
if (!name) throw new Error("uso: make-fixture <nombre> (lee fixtures/<nombre>.blocks.json)");
await startApp();
try {
await find(".bn-editor[contenteditable=true]");
const snap = await runAsync<{ doc: unknown; update: string }>(
  `const done = arguments[arguments.length-1];
   const ed = window.__editor; ed.replaceBlocks(ed.document, ${blocksJson});
   setTimeout(() => done(window.__snapshot()), 400);`,
);
writeFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), JSON.stringify(snap, null, 2));
} finally { await stopApp(); }
console.log("fixture", name, "ok");
