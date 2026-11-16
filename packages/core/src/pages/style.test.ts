// Estilo de página (plan 005, §4.1 y §7.2). Tareas E-012 a E-024.
import { describe, it, expect } from "vitest";
import { FONT_IDS, ACCENT_IDS, COVER_HEIGHTS, CONTENT_WIDTHS, TEXT_SIZES, LEADINGS, TOC_LEVELS, LIMITS, parseStyle, normalizeStyle, styleToText, applyStylePatch, cssVarsFor } from "./style";

describe("tipos y constantes (E-012)", () => {
  it("el catálogo tiene las 10 fuentes de D-16", () => {
    expect([...FONT_IDS]).toEqual(["inter", "geist", "nunito", "source-serif", "lora", "merriweather", "jetbrains-mono", "fira-code", "atkinson", "caveat"]);
  });
  it("los valores de cada opción son los de la spec", () => {
    expect([...COVER_HEIGHTS]).toEqual(["low", "medium", "high"]);
    expect([...CONTENT_WIDTHS]).toEqual(["narrow", "normal", "wide", "full"]);
    expect([...TEXT_SIZES]).toEqual(["small", "normal", "large"]);
    expect([...LEADINGS]).toEqual(["compact", "normal", "relaxed"]);
    expect([...TOC_LEVELS]).toEqual([1, 2, 3]);
  });
  it("los acentos son los colores de bloque con tono fuerte verificado (D-21)", () => {
    expect([...ACCENT_IDS]).toEqual(["gray", "brown", "red", "orange", "yellow", "green", "blue", "purple", "pink"]);
  });
  it("los rangos numéricos y sus predeterminados", () => {
    expect(LIMITS).toEqual({ pos: { min: 0, max: 100, def: 50 }, overlay: { min: 0, max: 100, def: 60 }, radius: { min: 0, max: 48 }, tagText: { max: 32 } });
  });
});

describe("parseStyle: entrada dañada (E-013)", () => {
  it("JSON inválido, vacío, null o que no es un objeto devuelve {}", () => {
    for (const t of ["{no es json", "", null, undefined, "null", "42", "[1,2]", "\"texto\""]) expect(parseStyle(t)).toEqual({});
  });
});

describe("parseStyle: rangos (E-014)", () => {
  const p = (cover: unknown) => parseStyle(JSON.stringify({ cover }));
  it("recorta posición, oscurecido y radio a su rango", () => {
    expect(p({ posX: -5, posY: 150, overlay: 300, radius: 99 })).toEqual({ cover: { posX: 0, posY: 100, overlay: 100, radius: 48 } });
    expect(p({ posX: 0, posY: 100, overlay: 0, radius: 0 })).toEqual({ cover: { posX: 0, posY: 100, overlay: 0, radius: 0 } });
  });
  it("redondea a enteros y descarta lo que no es un número finito", () => {
    expect(p({ posX: 33.6, posY: "40", overlay: Number.NaN, radius: 12.2 })).toEqual({ cover: { posX: 34, radius: 12 } });
  });
});

describe("parseStyle: claves y enumeraciones (E-015)", () => {
  it("descarta claves desconocidas y valores de enumeración inválidos", () => {
    expect(parseStyle(JSON.stringify({ x: 1, spacing: { width: "huge" } }))).toEqual({});
    expect(parseStyle(JSON.stringify({ typography: { body: "comic-sans" }, accent: "teal", toc: { maxLevel: 4 }, cover: { height: "giant" } }))).toEqual({});
    expect(parseStyle(JSON.stringify({ header: { tag: "sí", rounded: 1, foo: true } }))).toEqual({});
  });
  it("conserva un estilo completo y válido", () => {
    const full = {
      header: { titleOverCover: true, description: false, tag: true, tagText: "Estudio", updated: true, iconOverlap: true, gradient: true, rounded: true },
      cover: { height: "high", posX: 10, posY: 35, overlay: 70, radius: 24 },
      typography: { body: "inter", headings: "lora" },
      spacing: { width: "wide", textSize: "large", leading: "relaxed" },
      toc: { floating: false, maxLevel: 2 },
      accent: "green",
    };
    expect(parseStyle(JSON.stringify(full))).toEqual(full);
  });
  it("el texto de la etiqueta se recorta en espacios y a 32 caracteres; vacío se descarta", () => {
    expect(parseStyle(JSON.stringify({ header: { tagText: "  Hola  " } }))).toEqual({ header: { tagText: "Hola" } });
    expect(parseStyle(JSON.stringify({ header: { tagText: "x".repeat(40) } })).header?.tagText).toHaveLength(32);
    expect(parseStyle(JSON.stringify({ header: { tagText: "   " } }))).toEqual({});
  });
});

describe("parseStyle: radio por esquina (E-016)", () => {
  const r = (radius: unknown) => parseStyle(JSON.stringify({ cover: { radius } })).cover?.radius;
  it("acepta una tupla de cuatro y recorta cada esquina", () => {
    expect(r([0, 12, 60, -3])).toEqual([0, 12, 48, 0]);
  });
  it("descarta tuplas de otra longitud o con valores que no son números", () => {
    expect(r([1, 2, 3])).toBeUndefined();
    expect(r([1, 2, 3, 4, 5])).toBeUndefined();
    expect(r([1, "2", 3, 4])).toBeUndefined();
  });
  it("sigue aceptando un número único", () => {
    expect(r(16)).toBe(16);
  });
});

describe("normalizeStyle (E-017)", () => {
  it("un estilo con solo valores predeterminados se guarda como null", () => {
    expect(normalizeStyle({})).toBeNull();
    expect(normalizeStyle({
      header: { titleOverCover: false, tag: false, updated: false, iconOverlap: false, rounded: false },
      cover: { height: "medium", posX: 50, posY: 50, overlay: 60, radius: 0 },
      toc: { floating: true, maxLevel: 3 },
    })).toBeNull();
  });
  it("quita solo lo predeterminado y conserva lo demás", () => {
    expect(normalizeStyle({ cover: { posX: 50, posY: 20 }, toc: { floating: true, maxLevel: 2 }, spacing: { width: "normal" } }))
      .toEqual({ cover: { posY: 20 }, toc: { maxLevel: 2 }, spacing: { width: "normal" } });
  });
  it("description y gradient se guardan tal cual (su predeterminado depende de otros datos)", () => {
    expect(normalizeStyle({ header: { description: true, gradient: false } })).toEqual({ header: { description: true, gradient: false } });
  });
  it("cuatro esquinas iguales se guardan como un número (y 0 desaparece)", () => {
    expect(normalizeStyle({ cover: { radius: [8, 8, 8, 8] } })).toEqual({ cover: { radius: 8 } });
    expect(normalizeStyle({ cover: { radius: [0, 0, 0, 0] } })).toBeNull();
    expect(normalizeStyle({ cover: { radius: [8, 0, 8, 0] } })).toEqual({ cover: { radius: [8, 0, 8, 0] } });
  });
});

describe("styleToText: determinista (E-018)", () => {
  it("dos estilos equivalentes con claves en distinto orden dan el mismo texto", () => {
    const a = styleToText({ spacing: { width: "wide", leading: "compact" }, accent: "red", cover: { posY: 20, height: "high" } });
    const b = styleToText({ cover: { height: "high", posY: 20, posX: 50 }, accent: "red", spacing: { leading: "compact", width: "wide" } });
    expect(a).toBe(b);
    expect(a).toBe('{"accent":"red","cover":{"height":"high","posY":20},"spacing":{"leading":"compact","width":"wide"}}');
  });
  it("un estilo sin tocar se guarda como null y el texto vuelve a leerse igual", () => {
    expect(styleToText({ toc: { floating: true } })).toBeNull();
    const t = styleToText({ header: { titleOverCover: true }, cover: { radius: [4, 4, 4, 4] } })!;
    expect(styleToText(parseStyle(t))).toBe(t);
  });
});

describe("applyStylePatch (E-019)", () => {
  const base = { spacing: { width: "wide", leading: "compact" }, accent: "red", cover: { radius: 8 } } as const;
  it("mezcla en profundidad sin perder lo que no se toca", () => {
    expect(applyStylePatch(base, { spacing: { textSize: "large" }, header: { tag: true } }))
      .toEqual({ spacing: { width: "wide", leading: "compact", textSize: "large" }, accent: "red", cover: { radius: 8 }, header: { tag: true } });
  });
  it("undefined devuelve la opción a «Predeterminado»", () => {
    expect(applyStylePatch(base, { spacing: { width: undefined }, accent: undefined }))
      .toEqual({ spacing: { leading: "compact" }, cover: { radius: 8 } });
  });
  it("un arreglo reemplaza al valor anterior y el resultado queda normalizado", () => {
    expect(applyStylePatch(base, { cover: { radius: [1, 2, 3, 4] } }).cover).toEqual({ radius: [1, 2, 3, 4] });
    expect(applyStylePatch({}, { toc: { floating: true } })).toEqual({});
  });
});

describe("cssVarsFor: fuentes (E-020)", () => {
  it("la fuente del texto también fija la de los títulos, que la hereda en el contenedor de la página", () => {
    expect(cssVarsFor({ typography: { body: "lora" } })).toEqual({ "--font-content": "var(--font-lora)", "--font-headings": "var(--font-content)" });
  });
  it("la fuente de los títulos se puede elegir por separado", () => {
    expect(cssVarsFor({ typography: { headings: "merriweather" } })).toEqual({ "--font-headings": "var(--font-merriweather)" });
    expect(cssVarsFor({ typography: { body: "geist", headings: "caveat" } })).toEqual({ "--font-content": "var(--font-geist)", "--font-headings": "var(--font-caveat)" });
  });
});

describe("cssVarsFor: tamaño, interlineado y separación (E-021)", () => {
  it("el tamaño fija también el interlineado (normal) para que la proporción no dependa de la raíz", () => {
    expect(cssVarsFor({ spacing: { textSize: "large" } })).toEqual({ "--text-reading-size": "var(--page-text-large)", "--text-reading-line": "var(--page-leading-normal)" });
    expect(cssVarsFor({ spacing: { textSize: "small" } })["--text-reading-size"]).toBe("var(--page-text-small)");
  });
  it("el interlineado fija la altura de línea y la separación entre bloques", () => {
    expect(cssVarsFor({ spacing: { leading: "relaxed" } })).toEqual({ "--text-reading-line": "var(--page-leading-relaxed)", "--block-gap": "var(--page-gap-relaxed)" });
    expect(cssVarsFor({ spacing: { leading: "compact", textSize: "small" } })).toEqual({
      "--text-reading-size": "var(--page-text-small)", "--text-reading-line": "var(--page-leading-compact)", "--block-gap": "var(--page-gap-compact)",
    });
  });
});

describe("cssVarsFor: anchos (E-022)", () => {
  it("los cuatro anchos; «completo» quita el límite", () => {
    for (const w of ["narrow", "normal", "wide"] as const) expect(cssVarsFor({ spacing: { width: w } })).toEqual({ "--size-reading-width": `var(--page-width-${w})` });
    expect(cssVarsFor({ spacing: { width: "full" } })).toEqual({ "--size-reading-width": "none" });
  });
});

describe("cssVarsFor: acento (E-023)", () => {
  it("el acento usa el tono fuerte del color de bloque (con variantes de tema ya verificadas)", () => {
    expect(cssVarsFor({ accent: "green" })).toEqual({ "--c-accent": "var(--block-green-text)" });
  });
});

describe("cssVarsFor: sin opciones no declara nada (E-024)", () => {
  it("un estilo vacío o solo de cabecera, portada o índice no declara variables: todo hereda de la apariencia global", () => {
    expect(cssVarsFor({})).toEqual({});
    expect(cssVarsFor({ header: { titleOverCover: true }, cover: { height: "high" }, toc: { maxLevel: 2 } })).toEqual({});
  });
});
