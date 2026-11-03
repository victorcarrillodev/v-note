/** Cuenta los valores de diseño sueltos de un archivo de interfaz: colores hexadecimales, valores arbitrarios con px/color y SVG en línea. */
export function scanSource(text: string): number {
  const noComments = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  let n = 0;
  // Primero los valores arbitrarios (para no contar dos veces un color dentro de ellos) y se retiran del texto.
  const arbitrary = /\b[a-z-]+-\[(?![^\]]*var\()[^\]]*(?:\d+px|#[0-9a-fA-F]{3,8})[^\]]*\]/g;
  n += (noComments.match(arbitrary) ?? []).length;
  const rest = noComments.replace(arbitrary, "");
  n += (rest.match(/#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) ?? []).length;
  n += (rest.match(/<svg\b/g) ?? []).length;
  return n;
}
