import type { ReactNode } from "react";
import { parseCover, type AssetStore, type CornerRadius, type PageStyle } from "@vnote/core";
import { backgroundOf } from "../cover";
import { useCoverImage } from "./useCoverImage";

/** Radio CSS de las esquinas: un valor o [sup-izq, sup-der, inf-der, inf-izq]. */
export const radiusCss = (r: CornerRadius | undefined): string => (r === undefined ? "0" : Array.isArray(r) ? r.map((c) => `${c}px`).join(" ") : `${r}px`);

/** Degradado oscuro sobre la imagen: transparente arriba y con la opacidad elegida en el tramo donde va el texto (plan §6.3). */
export const overlayCss = (overlay: number): string => {
  const a = Math.min(100, Math.max(0, overlay)) / 100;
  return `linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,${a}) 55%, rgba(0,0,0,${a}) 100%)`;
};

/**
 * La portada: degradado, color, degradado propio o imagen del almacén, con altura, posición, oscurecido y esquinas del estilo (RF-2, RF-3).
 * `children` van encima (el modo tarjeta pone ahí el título). Una portada inválida no pinta nada (CL-14).
 */
export function CoverArt({ cover, style, assets, grow = false, darken, positionOverride, children }: {
  cover: string | null; style: PageStyle; assets?: AssetStore | undefined;
  /** El alto es un mínimo y crece con el contenido (modo tarjeta, CL-4). */
  grow?: boolean;
  /** Dibuja el oscurecido; por omisión, solo si el estilo activa el degradado. */
  darken?: boolean;
  /** Posición provisional mientras se reposiciona (RF-3.1). */
  positionOverride?: { x: number; y: number } | undefined;
  children?: ReactNode;
}) {
  const parsed = parseCover(cover);
  const hash = parsed?.kind === "asset" ? parsed.hash : null;
  const src = useCoverImage(assets, hash);
  if (!parsed) return null;
  const c = style.cover ?? {};
  const height = `var(--cover-height-${c.height ?? "medium"})`;
  const pos = positionOverride ?? { x: c.posX ?? 50, y: c.posY ?? 50 };
  const showOverlay = darken ?? style.header?.gradient ?? style.header?.titleOverCover ?? false;
  const bg = backgroundOf(parsed);
  return (
    <div
      data-testid="cover" data-cover-kind={parsed.kind} data-cover-height={c.height ?? "medium"}
      className="relative isolate w-full overflow-hidden bg-[var(--cover-graphite)]"
      style={{ [grow ? "minHeight" : "height"]: height, borderRadius: radiusCss(c.radius) }}
    >
      {bg && <div aria-hidden="true" className="absolute inset-0 -z-10" style={{ background: bg }} />}
      {hash && src && <img alt="" src={src} draggable={false} className="absolute inset-0 -z-10 h-full w-full select-none object-cover" style={{ objectPosition: `${pos.x}% ${pos.y}%` }} />}
      {showOverlay && <div aria-hidden="true" data-testid="cover-overlay" className="pointer-events-none absolute inset-0 -z-10" style={{ background: overlayCss(c.overlay ?? 60) }} />}
      {children}
    </div>
  );
}
