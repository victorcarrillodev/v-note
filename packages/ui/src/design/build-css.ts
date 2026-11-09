// Genera `tokens.css` a partir de `tokens.ts` (uso: `bun packages/ui/src/design/build-css.ts`). La prueba `cssTokens.test.ts` comprueba que no divergen.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { colors, chips, blockColors, typography, spacing, radii, elevation, motion, layers, coverGradients, sizes } from "./tokens";

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
const lines = (...l: string[]) => l.map((x) => "  " + x).join("\n");

const colorVars = (t: "light" | "dark") => [
  ...Object.entries(colors).map(([k, v]) => `--c-${kebab(k)}: ${v[t]};`),
  ...Object.entries(chips).flatMap(([k, v]) => [`--chip-${k}-fg: ${v[t].fg};`, `--chip-${k}-bg: ${v[t].bg};`]),
  ...Object.entries(blockColors).flatMap(([k, v]) => [`--block-${k}-text: ${v[t].text};`, `--block-${k}-bg: ${v[t].bg};`]),
  ...Object.entries(coverGradients).map(([k, v]) => `--cover-${k}: linear-gradient(135deg, ${v[t][0]}, ${v[t][1]});`),
  ...([1, 2, 3, 4] as const).map((l) => `--elevation-${l}: ${(t === "light" ? elevation.light : elevation.dark)[l].shadow};`),
];

const css = `/* GENERADO por build-css.ts a partir de tokens.ts. No editar a mano. */
:root, [data-theme="light"] {
${lines(...colorVars("light"))}
${lines(
  ...Object.entries(typography).flatMap(([k, l]) => [`--text-${kebab(k)}-size: ${l.size}px;`, `--text-${kebab(k)}-line: ${l.line}px;`, `--text-${kebab(k)}-weight: ${l.weight};`]),
  ...spacing.map((s) => `--space-${s / 4}: ${s}px;`),
  ...Object.entries(radii).map(([k, r]) => `--radius-${kebab(k)}: ${r}px;`),
  ...Object.entries(motion).map(([k, ms]) => `--motion-${kebab(k)}: ${ms}ms;`),
  ...Object.entries(layers).map(([k, z]) => `--z-${kebab(k)}: ${z};`),
  ...Object.entries(sizes).map(([k, v]) => `--size-${kebab(k)}: ${v}px;`),
  `--ease-out: cubic-bezier(0.2, 0, 0, 1);`,
  `--ease-in: cubic-bezier(0.4, 0, 1, 1);`,
  `--font-sans: "Inter Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;`,
  `--font-serif: "Source Serif 4 Variable", Georgia, "Times New Roman", serif;`,
  `--font-mono: "JetBrains Mono Variable", ui-monospace, "SF Mono", Menlo, Consolas, monospace;`,
  `--font-content: var(--font-sans);`,
  `--density-pad: 0px;`,
  `color-scheme: light;`,
  // Alias de los nombres anteriores (se retiran al terminar la migración, tarea de cierre del Hito 4).
  `--bg: var(--c-canvas);`,
  `--fg: var(--c-text);`,
  `--border: var(--c-border);`,
  `--hover: var(--c-raised);`,
  `--selected: var(--c-raised);`,
)}
}
:root[data-theme="dark"], [data-theme="dark"] {
${lines(...colorVars("dark"), "color-scheme: dark;")}
}
:root[data-density="compact"] {
  --density-pad: -4px;
  --text-reading-size: 15px;
  --text-reading-line: 22px;
}
:root[data-font="serif"] { --font-content: var(--font-serif); }
:root[data-font="mono"] { --font-content: var(--font-mono); }

/* Foco: anillo doble (2 px de acento + 2 px de separación con la superficie), visible en ambos temas. */
:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: 2px;
  box-shadow: 0 0 0 2px var(--c-canvas);
}

/* Foco con ratón o dedo: sin anillo azul (el detector de entrada fija data-input). El anillo de arriba se mantiene con teclado y por defecto. */
:root[data-input="pointer"] :focus-visible {
  outline: none;
  box-shadow: none;
}
/* Campos de texto con foco de ratón: borde de control reforzado y neutro, para saber dónde se escribe (el editor no lleva ninguno). */
:root[data-input="pointer"] :is(input, textarea, select):focus-visible {
  border-color: var(--c-text-muted);
}

/* Selección discreta: borde de 2 px del color de texto y halo neutro, sin el azul de acento. */
:root { --selection-halo: 0 0 0 2px var(--c-text), 0 0 0 5px color-mix(in srgb, var(--c-text) 18%, transparent); }
.vn-selected { box-shadow: var(--selection-halo); }

/* Puntero: todo lo clicable muestra la mano; lo deshabilitado, «no permitido». */
button, a[href], summary, select, label[for],
[role="button"], [role="tab"], [role="option"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"],
[role="switch"], [role="checkbox"], [role="radio"], [role="link"],
input[type="checkbox"], input[type="radio"], input[type="range"], input[type="color"], input[type="file"],
.vn-clickable {
  cursor: pointer;
}
.vn-grab { cursor: grab; }
.vn-grab:active { cursor: grabbing; }
.vn-move { cursor: move; }
.vn-crosshair { cursor: crosshair; }
.vn-resize-ns { cursor: ns-resize; }
.vn-resize-ew { cursor: ew-resize; }
.vn-resize-nwse { cursor: nwse-resize; }
.vn-resize-nesw { cursor: nesw-resize; }
:is(button, input, select, textarea, optgroup):disabled, [aria-disabled="true"] {
  cursor: not-allowed;
}

/* Cambio de tema: solo color de fondo y texto. */
body, #root, aside, main, header {
  transition: background-color var(--motion-theme) linear, color var(--motion-theme) linear;
}

/* Reducir movimiento: sin desplazamientos ni escalas; como máximo desvanecimientos breves. */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* Contraste forzado: bordes y foco con los colores del sistema. */
@media (forced-colors: active) {
  :focus-visible {
    outline: 2px solid Highlight;
    box-shadow: none;
  }
  button, input, select, textarea, [role="button"] {
    border: 1px solid CanvasText;
  }
  .vn-selected {
    box-shadow: none;
    outline: 2px solid Highlight;
  }
}
`;
writeFileSync(resolve(__dirname, "tokens.css"), css);
console.log("tokens.css generado");
