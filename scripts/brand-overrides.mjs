// Devuelve el JSON de --config de Tauri con el nombre de brand.config.json (única fuente), sin escribirlo en tauri.conf.json.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function brandOverrides() {
  const brand = JSON.parse(readFileSync(fileURLToPath(new URL("../brand.config.json", import.meta.url)), "utf8"));
  return JSON.stringify({ productName: brand.name, identifier: brand.appId, app: { windows: [{ label: "main", title: brand.name, width: 1100, height: 750 }] } });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.stdout.write(brandOverrides());
