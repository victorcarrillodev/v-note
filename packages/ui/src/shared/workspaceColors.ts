import { accentOnColor, accentSwatch, parseCustomAccent, type CustomAccent } from "@vnote/core";

/** Color generado algorítmicamente o elegido manualmente para el avatar de un espacio de trabajo. */
export interface WorkspaceAvatarColor {
  background: string;
  foreground: string;
  hue: number;
}

const GOLDEN_ANGLE = 137.508;
const HUE_THRESHOLDS = [30, 15, 5, 1] as const;
const MAX_PROBE_ATTEMPTS = 24;

/** Hash determinista FNV-1a de 32 bits sobre el nombre normalizado. */
export function hashText(text: string): number {
  const normalized = text.trim().toLocaleLowerCase();
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function hslToRgb(h: number, sPercent: number, lPercent: number): [number, number, number] {
  const s = sPercent / 100;
  const l = lPercent / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [r + m, g + m, b + m];
}

function linearize(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(l1: number, l2: number): number {
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}

function angularDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function buildColor(hue: number, hash: number): WorkspaceAvatarColor {
  const roundedHue = Math.round(hue) % 360;
  const saturation = 78 + ((hash >>> 8) % 9);
  const lightness = 44 + ((hash >>> 16) % 7);
  const [r, g, b] = hslToRgb(roundedHue, saturation, lightness);
  const bgLum = relativeLuminance(r, g, b);
  const whiteContrast = contrastRatio(1, bgLum);
  const darkContrast = contrastRatio(bgLum, 0);
  return {
    background: `hsl(${roundedHue}, ${saturation}%, ${lightness}%)`,
    foreground: whiteContrast >= darkContrast ? "hsl(0, 0%, 100%)" : "hsl(0, 0%, 0%)",
    hue: roundedHue,
  };
}

/** Calcula un color vibrante directo para un título sin contexto de otros espacios. */
export function workspaceColorForName(name: string): WorkspaceAvatarColor {
  const h = hashText(name);
  return buildColor(h % 360, h);
}

/**
 * Asigna colores a una lista de espacios: respeta el color elegido manualmente (`color`) si existe
 * y asigna colores vibrantes algorítmicos sin repetir matices al resto.
 */
export function assignWorkspaceColors(workspaces: readonly { id: string; name: string; color?: CustomAccent }[]): Map<string, WorkspaceAvatarColor> {
  const result = new Map<string, WorkspaceAvatarColor>();
  const usedHues: number[] = [];

  for (const ws of workspaces) {
    const custom = parseCustomAccent(ws.color);
    if (custom) {
      result.set(ws.id, {
        background: accentSwatch(custom),
        foreground: accentOnColor(custom),
        hue: -1,
      });
      continue;
    }

    const h = hashText(ws.name);
    const baseHue = h % 360;
    let chosenHue = baseHue;

    outer: for (const threshold of HUE_THRESHOLDS) {
      let candidate = baseHue;
      for (let attempt = 0; attempt < MAX_PROBE_ATTEMPTS; attempt++) {
        const rounded = Math.round(candidate) % 360;
        const collides = usedHues.some((u) => angularDistance(rounded, u) < threshold);
        if (!collides) {
          chosenHue = rounded;
          break outer;
        }
        candidate = (candidate + GOLDEN_ANGLE) % 360;
      }
    }

    usedHues.push(chosenHue);
    result.set(ws.id, buildColor(chosenHue, h));
  }

  return result;
}
