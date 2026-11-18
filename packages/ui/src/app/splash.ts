/** Quita la pantalla de carga estática (`#app-splash` de index.html) con un fundido. No hace nada si no existe. */
export function hideSplash(): void {
  const el = typeof document === "undefined" ? null : document.getElementById("app-splash");
  if (!el || el.dataset.leaving) return;
  el.dataset.leaving = "1";
  el.style.opacity = "0";
  setTimeout(() => el.remove(), 300);
}
