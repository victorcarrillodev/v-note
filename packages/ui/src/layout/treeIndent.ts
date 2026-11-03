export const INDENT_PX = 16;
export const MAX_INDENT_LEVELS = 6;
/** Sangría del árbol: 16 px por nivel con tope a 6 niveles (más niveles no sangran más; la ruta completa va en las migas). */
export const treeIndent = (depth: number): number => Math.min(Math.max(depth, 0), MAX_INDENT_LEVELS) * INDENT_PX;
