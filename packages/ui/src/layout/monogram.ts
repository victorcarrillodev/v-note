/** Inicial en mayúscula del nombre del producto (para el logotipo y el ícono). Maneja caracteres de varios bytes. */
export function monogram(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toLocaleUpperCase() : "•";
}
