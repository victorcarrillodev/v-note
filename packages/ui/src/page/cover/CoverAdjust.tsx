import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { COVER_HEIGHTS, LIMITS, type CornerRadius, type PageStyle, type StylePatch } from "@vnote/core";
import { Popover } from "../../components/Popover";
import { Segmented } from "../../components/controls";
import { Button } from "../../components/Button";
import { shouldWarnOverlay } from "./contrast";

export type CoverPreview = { overlay?: number; radius?: CornerRadius };

/** Deslizador que muestra una vista previa al moverlo y guarda UNA sola vez, al soltarlo (RF-3.3, RF-3.5). */
function CommitRange({ label, value, min, max, onPreview, onCommit }: { label: string; value: number; min: number; max: number; onPreview: (v: number) => void; onCommit: (v: number) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => { if (draft !== value) onCommit(draft); };
  return (
    <div className="flex items-center gap-2 text-[length:var(--text-ui-small-size)]">
      <label htmlFor={id} className="w-36 shrink-0">{label}</label>
      <input
        id={id} type="range" min={min} max={max} step={1} value={draft} className="min-w-0 flex-1"
        onChange={(e) => { const v = Number(e.target.value); setDraft(v); onPreview(v); }}
        onPointerUp={commit} onKeyUp={commit} onBlur={commit} onTouchEnd={commit}
      />
      <output htmlFor={id} className="w-8 text-right tabular-nums text-[var(--c-text-muted)]">{draft}</output>
    </div>
  );
}

const CORNERS = ["tl", "tr", "br", "bl"] as const;
const four = (r: CornerRadius | undefined): [number, number, number, number] => (Array.isArray(r) ? r : [r ?? 0, r ?? 0, r ?? 0, r ?? 0]);

/**
 * Ajustes de la portada (RF-3): altura, reposicionar, oscurecido y esquinas. Cada ajuste confirmado es una entrada del historial.
 */
export function CoverAdjust({ trigger, open, onOpenChange, style, onStyle, onPreview, onReposition }: {
  trigger: ReactNode; open: boolean; onOpenChange: (o: boolean) => void; style: PageStyle;
  onStyle: (patch: StylePatch) => void; onPreview: (p: CoverPreview | null) => void; onReposition: () => void;
}) {
  const { t } = useTranslation();
  const cover = style.cover ?? {};
  const overlay = cover.overlay ?? LIMITS.overlay.def;
  const [liveOverlay, setLiveOverlay] = useState(overlay);
  useEffect(() => setLiveOverlay(overlay), [overlay]);
  const corners = four(cover.radius);
  const [separate, setSeparate] = useState(Array.isArray(cover.radius));
  const titleOver = style.header?.titleOverCover === true;
  // Al pasar a reposicionar, el foco lo recibe el área de arrastre, no el botón que abrió este panel.
  const handoff = useRef(false);
  const setCorners = (next: [number, number, number, number]) => onStyle({ cover: { radius: next } });
  return (
    <Popover open={open} onOpenChange={(o) => { if (!o) onPreview(null); onOpenChange(o); }} align="end" trigger={trigger} onCloseAutoFocus={(e) => { if (handoff.current) { e.preventDefault(); handoff.current = false; } }}>
      <div role="group" aria-label={t("cover.adjust")} className="flex w-[22rem] max-w-full flex-col gap-3">
        <Segmented label={t("cover.height")} value={cover.height ?? "medium"} onChange={(v) => onStyle({ cover: { height: v as (typeof COVER_HEIGHTS)[number] } })} options={COVER_HEIGHTS.map((h) => ({ value: h, label: t(`cover.heights.${h}`) }))} />
        <Button size="sm" className="self-start" onClick={() => { handoff.current = true; onOpenChange(false); onReposition(); }}>{t("cover.reposition")}</Button>
        <CommitRange label={t("cover.overlay")} value={overlay} min={LIMITS.overlay.min} max={LIMITS.overlay.max}
          onPreview={(v) => { setLiveOverlay(v); onPreview({ overlay: v }); }} onCommit={(v) => onStyle({ cover: { overlay: v } })} />
        {shouldWarnOverlay(liveOverlay, titleOver) && <p role="status" className="text-[length:var(--text-note-size)] text-[var(--chip-warning-fg)]">{t("cover.overlayLow")}</p>}
        {!separate ? (
          <CommitRange label={t("cover.corners")} value={corners[0]} min={LIMITS.radius.min} max={LIMITS.radius.max}
            onPreview={(v) => onPreview({ radius: v })} onCommit={(v) => onStyle({ cover: { radius: v } })} />
        ) : (
          CORNERS.map((c, i) => (
            <CommitRange key={c} label={t(`cover.cornerNames.${c}`)} value={corners[i]!} min={LIMITS.radius.min} max={LIMITS.radius.max}
              onPreview={(v) => onPreview({ radius: corners.map((x, j) => (j === i ? v : x)) as CornerRadius })}
              onCommit={(v) => setCorners(corners.map((x, j) => (j === i ? v : x)) as [number, number, number, number])} />
          ))
        )}
        <Button variant="ghost" size="sm" className="self-start" aria-pressed={separate}
          onClick={() => {
            if (separate) onStyle({ cover: { radius: corners[0] } }); // al unirlas se usa la esquina superior izquierda
            setSeparate(!separate);
          }}>
          {separate ? t("cover.cornersTogether") : t("cover.cornersSeparate")}
        </Button>
      </div>
    </Popover>
  );
}
