import { resolveTheme, resolvePalette } from "./resolveTheme";

/** Pone `data-theme` (variante) y `data-palette` (tema de color; se quita cuando no aplica). Única ruta: la usan el proveedor y las ventanas sincronizadas. */
export function applyTheme(root: HTMLElement, mode: string | null | undefined, systemDark: boolean): void {
  root.setAttribute("data-theme", resolveTheme(mode, systemDark));
  const palette = resolvePalette(mode);
  if (palette) root.setAttribute("data-palette", palette);
  else root.removeAttribute("data-palette");
}
