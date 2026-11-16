// E-010 (spike): ¿cuánto tarda en abrirse un Popover con 5 secciones y 10 fuentes con vista previa?
import { createRoot } from "react-dom/client";
import * as Popover from "@radix-ui/react-popover";
import { useState } from "react";
const FONTS: [string, string][] = [["Inter", "inter-latin-wght-normal"], ["Geist", "geist"], ["Nunito", "nunito"], ["Source Serif 4", "source-serif-4-latin-wght-normal"], ["Lora", "lora"], ["Merriweather", "merriweather"], ["JetBrains Mono", "jetbrains-mono-latin-wght-normal"], ["Fira Code", "fira-code"], ["Atkinson", "atkinson-hyperlegible-next"], ["Caveat", "caveat"]];
const css = FONTS.map(([n, f]) => `@font-face{font-family:"${n} S";font-display:swap;font-weight:100 900;src:url("fonts/${f}.woff2") format("woff2-variations")}`).join("");
document.head.insertAdjacentHTML("beforeend", `<style>${css}</style>`);
const Seg = ({ items }: { items: string[] }) => <div role="radiogroup">{items.map((i) => <button key={i} role="radio" aria-checked={false}>{i}</button>)}</div>;
function Menu() {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger id="btn">Opciones</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content id="menu" style={{ width: 320, maxHeight: 600, overflow: "auto" }}>
          <section><h3>Tipografía</h3>{["texto", "títulos"].map((k) => <ul key={k}>{FONTS.map(([n]) => <li key={n} style={{ fontFamily: `"${n} S"` }}>{n}</li>)}</ul>)}</section>
          <section><h3>Espaciado</h3><Seg items={["Estrecho", "Normal", "Ancho", "Completo"]} /><Seg items={["Pequeño", "Normal", "Grande"]} /><Seg items={["Compacto", "Normal", "Amplio"]} /></section>
          <section><h3>Cabecera y portada</h3>{["Título sobre la portada", "Descripción", "Etiqueta", "Fecha", "Ícono", "Degradado", "Esquinas"].map((l) => <label key={l}><input type="checkbox" />{l}</label>)}</section>
          <section><h3>Índice</h3><label><input type="checkbox" />Índice flotante</label><Seg items={["H1", "H2", "H3"]} /></section>
          <section><h3>Página</h3><label><input type="checkbox" />Bloquear</label>{Array.from({ length: 12 }, (_, i) => <button key={i} aria-label={`acento ${i}`} />)}<p>1234 palabras · 7 min</p><button>Restablecer estilo</button><button>Usar como predeterminado</button></section>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
createRoot(document.getElementById("root")!).render(<Menu />);
// Medición: clic → menú pintado (dos frames), 5 veces
async function measure() {
  await new Promise((r) => setTimeout(r, 300));
  const runs: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    (document.getElementById("btn") as HTMLButtonElement).click();
    await new Promise<void>((r) => { const check = () => (document.getElementById("menu") ? requestAnimationFrame(() => requestAnimationFrame(() => r())) : requestAnimationFrame(check)); check(); });
    runs.push(Math.round(performance.now() - t0));
    (document.getElementById("btn") as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 150));
  }
  await document.fonts.ready;
  (window as unknown as { __result: unknown }).__result = { runsMs: runs, first: runs[0], worst: Math.max(...runs), fontsLoaded: [...document.fonts].filter((f) => f.status === "loaded").length };
}
void measure();
