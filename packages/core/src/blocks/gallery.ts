// Galería de imágenes (bloque `gallery`): modelo puro, sin dependencias de UI. Las imágenes viven en la propiedad `images` como JSON.
export const GALLERY_LAYOUTS = ["mosaic", "columns", "carousel"] as const;
export type GalleryLayout = (typeof GALLERY_LAYOUTS)[number];
/** Mosaico: `regular` = cuadrícula de celdas iguales; `custom` = cada imagen ocupa las columnas y filas que se le asignen. */
export const GALLERY_MOSAIC_STYLES = ["regular", "custom"] as const;
export type GalleryMosaicStyle = (typeof GALLERY_MOSAIC_STYLES)[number];
export const MAX_GALLERY_SPAN = 4;
/** Cómo se ajusta la imagen a su marco (`object-fit`): rellenar (recorta), contener (completa), estirar, tamaño original o reducir si no cabe. */
export const GALLERY_FITS = ["cover", "contain", "fill", "none", "scale-down"] as const;
export type GalleryFit = (typeof GALLERY_FITS)[number];
export const galleryFitOf = (v: unknown, fallback: GalleryFit = "cover"): GalleryFit => (GALLERY_FITS as readonly string[]).includes(String(v)) ? (v as GalleryFit) : fallback;

/** Alto de cada fila del mosaico y de las imágenes del carrusel. */
export const GALLERY_ROW_HEIGHTS = { small: 10, medium: 14, large: 20 } as const;
export type GalleryRowHeight = keyof typeof GALLERY_ROW_HEIGHTS;
export const galleryRowHeightOf = (v: unknown): GalleryRowHeight => (v === "small" || v === "large" ? v : "medium");
/** Alto en rem de una fila del mosaico. */
export const galleryRowRem = (v: unknown): number => GALLERY_ROW_HEIGHTS[galleryRowHeightOf(v)];
/** Alto en rem de una imagen del carrusel. */
export const galleryCarouselRem = (v: unknown): number => galleryRowRem(v) * 1.25;

/** `cols` y `rows`: celdas que ocupa la imagen en el mosaico personalizado (1 a 4). `fit` vacío = el de la galería. */
export type GalleryImage = { url: string; name: string; caption: string; cols: number; rows: number; fit: GalleryFit | "" };

export const DEFAULT_GALLERY_LAYOUT: GalleryLayout = "mosaic";
export const MAX_GALLERY_IMAGES = 200;

export const galleryMosaicStyleOf = (v: unknown): GalleryMosaicStyle => (GALLERY_MOSAIC_STYLES as readonly string[]).includes(String(v)) ? (v as GalleryMosaicStyle) : "regular";
export const clampSpan = (v: unknown): number => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(MAX_GALLERY_SPAN, Math.max(1, n)) : 1; };

export const galleryLayoutOf = (v: unknown): GalleryLayout => (GALLERY_LAYOUTS as readonly string[]).includes(String(v)) ? (v as GalleryLayout) : DEFAULT_GALLERY_LAYOUT;

/** Lee la propiedad `images`; un valor roto o con elementos inválidos se ignora sin lanzar. */
export function parseGallery(raw: unknown): GalleryImage[] {
  if (typeof raw !== "string" || raw === "") return [];
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(data)) return [];
  const out: GalleryImage[] = [];
  for (const d of data) {
    if (typeof d !== "object" || d === null) continue;
    const o = d as Record<string, unknown>;
    if (typeof o.url !== "string" || o.url === "") continue;
    out.push({ url: o.url, name: typeof o.name === "string" ? o.name : "", caption: typeof o.caption === "string" ? o.caption : "", cols: clampSpan(o.cols), rows: clampSpan(o.rows), fit: galleryFitOf(o.fit, "" as never) as GalleryFit | "" });
    if (out.length >= MAX_GALLERY_IMAGES) break;
  }
  return out;
}

export const serializeGallery = (images: readonly GalleryImage[]): string => JSON.stringify(images);
