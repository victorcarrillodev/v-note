// R-021 a R-023, R-026, R-027, R-029, R-030 (prueba primero): reglas globales de puntero y de foco (plan 004, §6 y DP-13/DP-14).
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { colors } from "./tokens";
import { contrastRatio } from "./contrast";

const css = readFileSync(resolve(__dirname, "tokens.css"), "utf8");
beforeAll(() => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); });

const cursorOf = (html: string, selector = "*") => {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  const el = host.querySelector(selector) as HTMLElement;
  const value = getComputedStyle(el).cursor;
  host.remove();
  return value;
};

describe("puntero de mano en todo lo clicable (R-021, RF-4)", () => {
  const cases: [string, string][] = [
    ["botón", "<button>x</button>"],
    ["enlace", '<a href="#a">x</a>'],
    ["resumen", "<details><summary>x</summary></details>"],
    ["selector", "<select><option>x</option></select>"],
    ["role=button", '<div role="button">x</div>'],
    ["pestaña", '<div role="tab">x</div>'],
    ["opción", '<div role="option">x</div>'],
    ["ítem de menú", '<div role="menuitem">x</div>'],
    ["ítem de menú con casilla", '<div role="menuitemcheckbox">x</div>'],
    ["interruptor", '<button role="switch">x</button>'],
    ["casilla", '<input type="checkbox">'],
    ["radio", '<input type="radio">'],
    ["control deslizante", '<input type="range">'],
    ["selector de color", '<input type="color">'],
    ["etiqueta con for", '<label for="x">x</label>'],
  ];
  for (const [name, html] of cases) it(`${name} resuelve a pointer`, () => { expect(cursorOf(html, html.startsWith("<details") ? "summary" : "*:not(option)")).toBe("pointer"); });
  it("un campo de texto conserva el cursor de texto (no se toca)", () => { expect(cursorOf('<input type="text">')).not.toBe("pointer"); });
});

describe("deshabilitado: «no permitido» (R-022, RF-4)", () => {
  it("botón, campo y selector deshabilitados", () => {
    expect(cursorOf("<button disabled>x</button>")).toBe("not-allowed");
    expect(cursorOf('<input type="checkbox" disabled>')).toBe("not-allowed");
    expect(cursorOf("<select disabled><option>x</option></select>")).toBe("not-allowed");
  });
  it("aria-disabled también", () => {
    expect(cursorOf('<div role="button" aria-disabled="true">x</div>')).toBe("not-allowed");
    expect(cursorOf('<div role="menuitem" aria-disabled="true">x</div>')).toBe("not-allowed");
  });
  it("un botón deshabilitado no responde al clic", () => {
    const b = document.createElement("button"); b.disabled = true; let n = 0; b.onclick = () => n++;
    document.body.appendChild(b); b.click(); b.remove();
    expect(n).toBe(0);
  });
});

describe("clases de utilidad de cursor (R-023, RF-4)", () => {
  it("clicable → pointer", () => { expect(cursorOf('<div class="vn-clickable">x</div>')).toBe("pointer"); });
  it("arrastrable → grab y grabbing al pulsar", () => {
    expect(cursorOf('<div class="vn-grab">x</div>')).toBe("grab");
    expect(css).toMatch(/\.vn-grab:active\s*\{[^}]*cursor:\s*grabbing/);
  });
  it("mover, cruz y redimensión", () => {
    expect(cursorOf('<div class="vn-move">x</div>')).toBe("move");
    expect(cursorOf('<div class="vn-crosshair">x</div>')).toBe("crosshair");
    expect(cursorOf('<div class="vn-resize-ns">x</div>')).toBe("ns-resize");
    expect(cursorOf('<div class="vn-resize-ew">x</div>')).toBe("ew-resize");
    expect(cursorOf('<div class="vn-resize-nwse">x</div>')).toBe("nwse-resize");
    expect(cursorOf('<div class="vn-resize-nesw">x</div>')).toBe("nesw-resize");
  });
  it("una clase de utilidad deshabilitada muestra «no permitido»", () => {
    expect(cursorOf('<div class="vn-clickable" aria-disabled="true">x</div>')).toBe("not-allowed");
  });
});

describe("foco: anillo solo con teclado (R-026, RF-5)", () => {
  it("el anillo doble sigue siendo la regla base", () => {
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--c-accent\)[^}]*outline-offset:\s*2px[^}]*box-shadow:\s*0 0 0 2px var\(--c-canvas\)/s);
  });
  it("con ratón o dedo se quita el anillo azul y la sombra de separación", () => {
    expect(css).toMatch(/:root\[data-input="pointer"\]\s+:focus-visible\s*\{[^}]*outline:\s*none[^}]*box-shadow:\s*none/s);
  });
  it("con teclado no hay ninguna regla que lo quite", () => {
    expect(css).not.toMatch(/data-input="keyboard"\][^{]*\{[^}]*outline:\s*none/);
  });
});

describe("campos de texto con foco de ratón (R-027, RF-5)", () => {
  it("borde de control reforzado y neutro, no el de acento", () => {
    const m = /:root\[data-input="pointer"\]\s+:is\(input[^{]*\):focus-visible\s*\{([^}]*)\}/s.exec(css);
    expect(m, "falta la regla de campos de texto con foco de ratón").not.toBeNull();
    expect(m![1]).toMatch(/border-color:\s*var\(--c-text-muted\)/);
    expect(m![1]).not.toMatch(/--c-accent/);
  });
  it("el borde reforzado contrasta ≥ 3:1 con la superficie del campo en ambos temas", () => {
    for (const t of ["light", "dark"] as const) expect(contrastRatio(colors.textMuted[t], colors.card[t]), t).toBeGreaterThanOrEqual(3);
  });
  it("el propio editor (contenteditable) con foco de ratón no recibe contorno de sustitución", () => {
    expect(css).not.toMatch(/data-input="pointer"\][^{]*contenteditable[^{]*\{[^}]*(border|outline)/);
  });
});

describe("selección discreta (R-029, DP-14, RNF-3)", () => {
  it("existe el halo neutro de selección y no usa el acento", () => {
    const m = /--selection-halo:\s*([^;]+);/.exec(css);
    expect(m, "falta --selection-halo").not.toBeNull();
    expect(m![1]).toContain("var(--c-text)");
    expect(m![1]).not.toContain("--c-accent");
  });
  it("el borde de selección (color de texto) contrasta ≥ 3:1 con el lienzo en ambos temas", () => {
    for (const t of ["light", "dark"] as const) expect(contrastRatio(colors.text[t], colors.canvas[t]), t).toBeGreaterThanOrEqual(3);
  });
  it("existe una clase de selección con borde más grueso", () => {
    expect(css).toMatch(/\.vn-selected\s*\{[^}]*box-shadow:\s*var\(--selection-halo\)/s);
  });
});

describe("contraste forzado (R-030)", () => {
  it("el foco de teclado usa los colores del sistema", () => {
    const m = /@media \(forced-colors: active\)\s*\{(.*?)\n\}\n/s.exec(css);
    expect(m).not.toBeNull();
    expect(m![1]).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid Highlight/s);
  });
});
