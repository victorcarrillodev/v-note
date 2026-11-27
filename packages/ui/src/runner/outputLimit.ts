/**
 * Salida de una ejecución con tope de caracteres (stdout y stderr juntos). Compartido por JavaScript y Python.
 * `write` devuelve `false` en cuanto se pasa del tope: quien ejecuta debe detener el código (si no, un bucle que imprime nunca termina).
 */
export function createOutput(maxChars: number) {
  let out = "", err = "", truncated = false;
  return {
    write(to: "out" | "err", text: string): boolean {
      if (truncated) return false;
      const used = out.length + err.length;
      if (used + text.length > maxChars) {
        const room = Math.max(0, maxChars - used);
        if (to === "out") out += text.slice(0, room); else err += text.slice(0, room);
        truncated = true; // el aviso lo muestra y traduce la interfaz a partir de esta bandera
        return false;
      }
      if (to === "out") out += text; else err += text;
      return true;
    },
    stdout: () => out,
    stderr: () => err,
    truncated: () => truncated,
  };
}
