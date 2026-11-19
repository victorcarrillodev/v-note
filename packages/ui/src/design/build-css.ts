// Genera `tokens.css` a partir de `tokens.ts` (uso: `bun packages/ui/src/design/build-css.ts`). La prueba `cssTokens.test.ts` comprueba que no divergen.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { THEMES } from "./themes";
import { colors, chips, blockColors, typography, spacing, radii, elevation, motion, layers, coverGradients, sizes, pageStyle, pageFonts } from "./tokens";

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
const lines = (...l: string[]) => l.map((x) => "  " + x).join("\n");

const colorVars = (t: "light" | "dark") => [
  ...Object.entries(colors).map(([k, v]) => `--c-${kebab(k)}: ${v[t]};`),
  ...Object.entries(chips).flatMap(([k, v]) => [`--chip-${k}-fg: ${v[t].fg};`, `--chip-${k}-bg: ${v[t].bg};`]),
  ...Object.entries(blockColors).flatMap(([k, v]) => [`--block-${k}-text: ${v[t].text};`, `--block-${k}-bg: ${v[t].bg};`]),
  ...Object.entries(coverGradients).map(([k, v]) => `--cover-${k}: linear-gradient(135deg, ${v[t][0]}, ${v[t][1]});`),
  ...([1, 2, 3, 4] as const).map((l) => `--elevation-${l}: ${(t === "light" ? elevation.light : elevation.dark)[l].shadow};`),
];

/** Un bloque por tema de color, DESPUÉS del oscuro (misma especificidad: gana por orden). Solo los 15 colores del tema; `color-scheme` sale de la variante. */
const paletteBlocks = THEMES.map((t) => `:root[data-palette="${t.id}"] {\n${lines(...Object.entries(t.colors).map(([k, v]) => `--c-${kebab(k)}: ${v};`))}\n}`).join("\n");

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
  ...Object.entries(pageStyle.widths).map(([k, v]) => `--page-width-${k}: ${v}px;`),
  ...Object.entries(pageStyle.textSizes).map(([k, v]) => `--page-text-${k}: ${v}px;`),
  ...Object.entries(pageStyle.leadings).map(([k, v]) => `--page-leading-${k}: ${v};`),
  ...Object.entries(pageStyle.gaps).map(([k, v]) => `--page-gap-${k}: ${v}em;`),
  ...Object.entries(pageStyle.coverHeights).map(([k, v]) => `--cover-height-${k}: ${v}px;`),
  `--ease-out: cubic-bezier(0.2, 0, 0, 1);`,
  `--ease-in: cubic-bezier(0.4, 0, 1, 1);`,
  `--font-sans: "Inter Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;`,
  `--font-serif: "Source Serif 4 Variable", Georgia, "Times New Roman", serif;`,
  `--font-mono: "JetBrains Mono Variable", ui-monospace, "SF Mono", Menlo, Consolas, monospace;`,
  ...Object.entries(pageFonts).map(([id, f]) => `--font-${id}: "${f.family}", ${f.fallback};`),
  `--font-content: var(--font-sans);`,
  `--font-headings: var(--font-content);`,
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
${paletteBlocks}
:root[data-density="compact"] {
  --density-pad: -4px;
  --text-reading-size: 16px;
  --text-reading-line: 24px;
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

/* Menús emergentes: barra de desplazamiento fina y discreta. */
.vn-menu-scroll { scrollbar-width: thin; scrollbar-color: var(--c-border-control) transparent; }

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

/* Capa base: aspecto por defecto de los controles nativos sin clase. Va en \`@layer base\` para que cualquier utilidad de Tailwind la pueda cambiar. */
@layer base {
  :root { accent-color: var(--c-accent); }
  html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }
  ::selection { background: color-mix(in srgb, var(--c-accent) 24%, transparent); }
  * { scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--c-text) 24%, transparent) transparent; }

  /* Bordes sin color propio: el borde suave del estándar; en los controles, el borde de control. */
  *, ::before, ::after, ::backdrop { border-color: var(--c-border); }
  button, input, select, textarea, ::file-selector-button { border-color: var(--c-border-control); }

  /* Botón nativo sin clase: el botón secundario del estándar. */
  button:where(:not([class]):not([role="tab"]):not([role="menuitem"]):not([role="menuitemcheckbox"]):not([role="menuitemradio"]):not([role="option"]):not([role="switch"]):not([role="checkbox"]):not([role="radio"]):not([role="treeitem"]):not([role="combobox"])) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    min-height: 32px;
    min-width: 32px;
    padding: 0 var(--space-3);
    border: 1px solid var(--c-border-control);
    border-radius: var(--radius-base);
    background: transparent;
    color: var(--c-text);
    font-size: var(--text-ui-size);
    font-weight: 500;
    line-height: var(--text-ui-line);
    white-space: nowrap;
    transition: background-color var(--motion-fast) var(--ease-out), border-color var(--motion-fast) var(--ease-out);
  }
  button:where(:not([class])):hover:not(:disabled) { background: var(--c-raised); }
  button:where(:not([class])):disabled { opacity: 0.5; }
  button:where(:not([class]))[data-variant="primary"] { border-color: transparent; background: var(--c-accent); color: var(--c-on-accent); }
  button:where(:not([class]))[data-variant="primary"]:hover:not(:disabled) { background: var(--c-accent); filter: brightness(0.95); }
  button:where(:not([class]))[data-variant="danger"] { border-color: var(--c-danger); color: var(--c-danger); }
  button:where(:not([class]))[data-variant="ghost"] { border-color: transparent; }

  /* Campos de texto y selectores sin clase. */
  input:where(:not([class]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="hidden"])),
  select:where(:not([class])),
  textarea:where(:not([class])) {
    min-height: 32px;
    padding: 0 var(--space-2);
    border: 1px solid var(--c-border-control);
    border-radius: var(--radius-base);
    background: var(--c-card);
    color: var(--c-text);
    font-size: var(--text-ui-size);
    line-height: var(--text-ui-line);
  }
  textarea:where(:not([class])) { padding: var(--space-2); }
  :is(input, textarea)::placeholder { color: var(--c-text-placeholder); opacity: 1; }
  :is(input, select, textarea):where(:not([class])):disabled { opacity: 0.5; }

  /* Selector de archivo: su botón interno es un botón secundario. */
  ::file-selector-button {
    min-height: 28px;
    margin-inline-end: var(--space-2);
    padding: 0 var(--space-3);
    border: 1px solid var(--c-border-control);
    border-radius: var(--radius-base);
    background: transparent;
    color: var(--c-text);
    font-weight: 500;
    cursor: pointer;
  }

  /* Puntero grueso: objetivo táctil de 44 px. */
  @media (pointer: coarse) {
    button:where(:not([class]):not([role="tab"]):not([role="menuitem"]):not([role="option"]):not([role="treeitem"])),
    input:where(:not([class]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="hidden"])),
    select:where(:not([class])) { min-height: 44px; }
  }
}

/* Cambio de tema: solo color de fondo y texto. */
body, #root, aside, main, header {
  transition: background-color var(--motion-theme) linear, color var(--motion-theme) linear;
}

/* Barra lateral (Drawer): entra desde la derecha y sale hacia la derecha; el velo aparece y se desvanece. */
@keyframes v-drawer-in { from { transform: translateX(100%); } to { transform: none; } }
@keyframes v-drawer-out { from { transform: none; } to { transform: translateX(100%); } }
@keyframes v-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes v-fade-out { from { opacity: 1; } to { opacity: 0; } }
[data-drawer][data-state="open"] { animation: v-drawer-in var(--motion-slow) var(--ease-out); }
[data-drawer][data-state="closed"] { animation: v-drawer-out var(--motion-slow) var(--ease-in) forwards; }
[data-drawer-overlay][data-state="open"] { animation: v-fade-in var(--motion-base) linear; }
[data-drawer-overlay][data-state="closed"] { animation: v-fade-out var(--motion-slow) linear forwards; }

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
