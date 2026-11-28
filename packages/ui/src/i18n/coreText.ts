import { CORE_MESSAGES_EN } from "./coreMessages.en";

let language = "es";
/** La llama la creación de i18n al elegir o cambiar de idioma. */
export const setCoreLanguage = (lng: string): void => { language = lng; };

const exact = new Map<string, string>();
const patterns: { re: RegExp; en: string; weight: number }[] = [];
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
for (const [es, en] of CORE_MESSAGES_EN) {
  const parts = es.split(/\$\{(?:[^{}]|\{[^{}]*\})*\}/);
  if (parts.length === 1) exact.set(es, en);
  else patterns.push({ re: new RegExp(`^${parts.map(escape).join("(.*?)")}$`, "s"), en, weight: parts.join("").length });
}
patterns.sort((a, b) => b.weight - a.weight);

/** Traduce un mensaje del núcleo al idioma de la interfaz; en español, o si no se reconoce, se queda igual. */
export function coreText(message: string): string {
  if (!language.startsWith("en")) return message;
  const direct = exact.get(message);
  if (direct) return direct;
  for (const p of patterns) {
    const m = p.re.exec(message);
    if (m) return p.en.replace(/\{(\d)\}/g, (_, i: string) => m[Number(i) + 1] ?? "");
  }
  return message;
}
