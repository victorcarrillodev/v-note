import type { ReactNode } from "react";
import { parseCover, type AssetStore, type CornerRadius, type PageStyle } from "@vnote/core";
import { backgroundOf } from "../cover";
import { useCoverImage } from "./useCoverImage";

/** Radio CSS de las esquinas: un valor o [sup-izq, sup-der, inf-der, inf-izq]. */
export const radiusCss = (r: CornerRadius | undefined): string => (r === undefined ? "0" : Array.isArray(r) ? r.map((c) => `${c}px`).join(" ") : `${r}px`);

/** Degradado oscuro sobre la imagen: nace del borde inferior con la opacidad elegida y, con una curva suave (sin tramos ni cortes visibles), se desvanece hacia arriba hasta ser transparente (plan §6.3). */
export const overlayCss = (overlay: number): string => {
  const a = Math.min(100, Math.max(0, overlay)) / 100;
  const stops = Array.from({ length: 11 }, (_, i) => {
    const t = 1 - Math.min(1, Math.max(0, i / 10 - 0.4) / 0.6); // máximo en el 40 % inferior y nada al 100 % de la altura
    const eased = t * t * (3 - 2 * t); // smoothstep: arranque y final sin quiebres
    return `rgba(0,0,0,${+(a * eased).toFixed(3)}) ${i * 10}%`;
  });
  return `linear-gradient(to top, ${stops.join(", ")})`;
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
  // La imagen y el oscurecido son dos capas rectangulares y las esquinas se recortan UNA sola vez sobre el conjunto con `clip-path`.
  // Si cada capa llevara su propio radio, el borde curvo se suavizaría por separado y asomaría un filo de píxeles claros sin oscurecer.
  const base = hash ? (src ? `url("${src}") ${pos.x}% ${pos.y}% / cover no-repeat` : "var(--cover-graphite)") : (bg ?? "var(--cover-graphite)");
  const overlay = c.overlay ?? 60;
  const rounded = Array.isArray(c.radius) ? c.radius.some((r) => r > 0) : (c.radius ?? 0) > 0;
  return (
    <div
      data-testid="cover" data-cover-kind={parsed.kind} data-cover-height={c.height ?? "medium"}
      className="relative isolate w-full"
      style={{ [grow ? "minHeight" : "height"]: height, borderRadius: radiusCss(c.radius), ...(rounded ? { clipPath: `inset(0 round ${radiusCss(c.radius)})` } : {}) }}
    >
      <div aria-hidden="true" data-testid="cover-paint" data-cover-layer="" {...(showOverlay ? { "data-overlay": overlay } : {})}
        className="pointer-events-none absolute inset-0 -z-10" style={{ background: base }} />
      {showOverlay && <div aria-hidden="true" data-testid="cover-shade" className="pointer-events-none absolute inset-0 -z-10" style={{ background: overlayCss(overlay) }} />}
      {/* La imagen no se ve (la pinta la capa de arriba): da el tamaño natural para reposicionar y confirma que cargó. */}
      {hash && src && <img alt="" src={src} draggable={false} className="invisible absolute inset-0 -z-20 h-full w-full select-none object-cover" style={{ objectPosition: `${pos.x}% ${pos.y}%` }} />}
      {children}
    </div>
  );
}
