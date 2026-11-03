/** Control del apilado de modales: como máximo DOS niveles y solo una confirmación sobre un modal (nunca un modal sobre otro). */
let openModals = 0;
export function registerModal(): () => void {
  if (openModals > 0) {
    const msg = "No se permite abrir un modal sobre otro modal (solo una confirmación o un popover)";
    if ((import.meta as unknown as { env?: { MODE?: string } }).env?.MODE === "test") throw new Error(msg);
    console.error(msg);
  }
  openModals++;
  return () => { openModals = Math.max(0, openModals - 1); };
}
