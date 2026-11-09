// Detector de modalidad de entrada (plan 004, DP-13): fija `data-input` en la raíz según se use puntero (ratón o dedo) o teclado.
// Con «pointer» las reglas globales quitan el anillo de foco; sin atributo o con «keyboard» el anillo se ve (accesibilidad).
const NAV_KEYS = new Set(["Tab", "Enter", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"]);

export function installInputModality(root: HTMLElement = document.documentElement, target: Window = window): () => void {
  const onPointer = () => root.setAttribute("data-input", "pointer");
  const onKey = (e: KeyboardEvent) => { if (NAV_KEYS.has(e.key)) root.setAttribute("data-input", "keyboard"); };
  target.addEventListener("pointerdown", onPointer, true);
  target.addEventListener("keydown", onKey, true);
  return () => { target.removeEventListener("pointerdown", onPointer, true); target.removeEventListener("keydown", onKey, true); };
}
