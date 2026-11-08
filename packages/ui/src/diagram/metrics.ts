// Tamaños de los símbolos del lienzo del diagrama (plan 003, §10.2). Puro: sin React ni DOM.
/** Diámetro visible de un anclaje o asa, en píxeles de pantalla. */
export const ANCHOR_DOT = 12;
/** Área activa mínima: 32 px con puntero fino y 44 px con puntero grueso (RF-15). */
export const HIT_FINE = 32;
export const HIT_COARSE = 44;
/** Tope del agrandamiento al alejar mucho el zoom: evita símbolos gigantes en el lienzo (CL-10). */
export const MAX_SYMBOL_SCALE = 8;

const safe = (zoom: number) => (Number.isFinite(zoom) && zoom > 0 ? zoom : 1);

/** Factor con que se dibujan los símbolos en el lienzo para que midan lo mismo en pantalla (con tope). */
export const symbolScale = (zoom: number): number => Math.min(1 / safe(zoom), MAX_SYMBOL_SCALE);
/** Tamaño real en pantalla de un símbolo base con el zoom dado. */
export const visiblePx = (zoom: number): number => ANCHOR_DOT * symbolScale(zoom) * safe(zoom);
export const hitPx = (coarse: boolean): number => (coarse ? HIT_COARSE : HIT_FINE);
/** Radio del área activa en unidades del lienzo: sin tope, para que mida siempre lo mismo en pantalla. */
export const hitRadiusFlow = (zoom: number, coarse: boolean): number => hitPx(coarse) / 2 / safe(zoom);

/** Capas del lienzo respecto a las formas: los trazos van debajo; anclajes y asas, encima incluso de una forma seleccionada (la librería la eleva a 1000). */
export const Z_BELOW = -1;
export const Z_ABOVE = 3000;
