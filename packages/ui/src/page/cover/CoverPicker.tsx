import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Popover } from "../../components/Popover";
import { Tabs } from "../../components/Tabs";
import { Button } from "../../components/Button";
import { Segmented } from "../../components/controls";
import { blockColors, coverEditor } from "../../design/tokens";
import { COVER_NAMES } from "../cover";
import type { CoverImportError } from "./importCoverImage";
import type { UnsplashErrorKind, UnsplashPhoto } from "@vnote/core";
import { useUnsplash } from "../../unsplash/UnsplashContext";
import { UnsplashPane } from "../../unsplash/UnsplashPane";

const HEX = /^#[0-9a-f]{6}$/i;
const ANGLES = [0, 45, 90, 135, 180];
export type CoverApply = { cover: string | null; coverCredit: null };
const SWATCH = "h-8 w-8 rounded-[var(--radius-md)] border border-[var(--c-border-control)] transition-transform duration-100 hover:scale-110 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11";
const ERROR_KEY: Record<CoverImportError, string> = { empty: "cover.errEmpty", tooLarge: "cover.errTooLarge", unsupported: "cover.errUnsupported", corrupt: "cover.errCorrupt", save: "cover.errSave" };

/** Paleta de la aplicación para portadas de color plano: los tonos de los colores de bloque (RF-2.7). */
const PALETTE = Object.entries(blockColors).map(([id, v]) => ({ id, hex: v.light.text.toLowerCase() }));

/**
 * Selector de portada (RF-2.1): Subir, Colores y Degradados, y «Quitar portada».
 * Cada elección escribe una sola entrada del historial (portada + crédito).
 */
export function CoverPicker({ trigger, open, onOpenChange, hasCover, canUpload, error, onApply, onFile, onUnsplash, unsplashBusy = false, unsplashError = null }: {
  trigger: ReactNode; open: boolean; onOpenChange: (o: boolean) => void; hasCover: boolean;
  canUpload: boolean; error: CoverImportError | null;
  onApply: (patch: CoverApply) => void; onFile: (file: File) => void;
  /** Elegir una foto de Unsplash; sin él (o con Unsplash apagado) la pestaña no existe. */
  onUnsplash?: (photo: UnsplashPhoto) => void; unsplashBusy?: boolean; unsplashError?: UnsplashErrorKind | null;
}) {
  const { t } = useTranslation();
  const unsplash = useUnsplash();
  const showUnsplash = unsplash.supported && unsplash.enabled && canUpload && onUnsplash !== undefined;
  const [tab, setTab] = useState<"upload" | "colors" | "gradients" | "unsplash">(canUpload ? "upload" : "colors");
  const tabs = [
    ...(canUpload ? [{ value: "upload", label: t("cover.tabUpload") }] : []),
    ...(showUnsplash ? [{ value: "unsplash", label: t("unsplash.tab") }] : []),
    { value: "colors", label: t("cover.tabColors") },
    { value: "gradients", label: t("cover.tabGradients") },
  ];
  const apply = (cover: string | null) => { onApply({ cover, coverCredit: null }); onOpenChange(false); };
  return (
    <Popover open={open} onOpenChange={onOpenChange} align="end" trigger={trigger}>
      <div role="group" aria-label={t("cover.pickerTitle")} className="flex w-[22rem] max-w-full flex-col gap-3">
        <Tabs label={t("cover.tabs")} value={tab} onChange={(v) => setTab(v as typeof tab)} tabs={tabs} />
        {tab === "unsplash" && showUnsplash && <UnsplashPane onPick={onUnsplash!} picking={unsplashBusy} pickError={unsplashError} />}
        {tab === "upload" && canUpload && <UploadPane error={error} onFile={onFile} />}
        {tab === "colors" && <ColorsPane onPick={(hex) => apply(`color:${hex}`)} />}
        {tab === "gradients" && <GradientsPane onPick={(cover) => apply(cover)} />}
        {hasCover && <Button variant="ghost" size="sm" className="self-start" onClick={() => apply(null)}>{t("cover.remove")}</Button>}
      </div>
    </Popover>
  );
}

function UploadPane({ error, onFile }: { error: CoverImportError | null; onFile: (f: File) => void }) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-2">
      <Button onClick={() => input.current?.click()}>{t("cover.uploadPick")}</Button>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" tabIndex={-1} aria-label={t("cover.uploadPick")} className="sr-only"
        onChange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (f) onFile(f); }} />
      <p className="text-[length:var(--text-note-size)] text-[var(--c-text-muted)]">{t("cover.uploadHint")}</p>
      {error && <p role="alert" className="text-[length:var(--text-ui-small-size)] text-[var(--c-danger)]">{t(ERROR_KEY[error])}</p>}
    </div>
  );
}

function ColorsPane({ onPick }: { onPick: (hex: string) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const valid = HEX.test(text);
  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label={t("cover.palette")} className="flex flex-wrap gap-1.5">
        {PALETTE.map((c) => <button key={c.id} type="button" aria-label={t(`diagram.colors.${c.id}`, { defaultValue: c.id })} title={c.hex} data-swatch={c.hex} className={SWATCH} style={{ background: c.hex }} onClick={() => onPick(c.hex)} />)}
      </div>
      <div className="flex items-center gap-1.5">
        <input aria-label={t("cover.customHex")} placeholder="#RRGGBB" value={text} aria-invalid={text !== "" && !valid} onChange={(e) => setText(e.target.value.trim())}
          className="h-8 w-28 rounded-[var(--radius-md)] bg-[var(--c-raised)] px-2 text-[length:var(--text-ui-small-size)]" />
        <input type="color" aria-label={t("cover.customColor")} value={valid ? text : coverEditor.neutral} onChange={(e) => setText(e.target.value)}
          className="h-8 w-9 rounded-[var(--radius-md)] bg-[var(--c-raised)] p-0.5" />
        <Button size="sm" disabled={!valid} onClick={() => onPick(text.toLowerCase())}>{t("cover.customColor")}</Button>
      </div>
      {text !== "" && !valid && <p className="text-[length:var(--text-note-size)] text-[var(--c-danger)]">{t("cover.invalidHex")}</p>}
    </div>
  );
}

function GradientsPane({ onPick }: { onPick: (cover: string) => void }) {
  const { t } = useTranslation();
  const [colors, setColors] = useState<string[]>([coverEditor.gradientStart, coverEditor.gradientEnd]);
  const [angle, setAngle] = useState(135);
  const setColor = (i: number, v: string) => setColors((cs) => cs.map((c, j) => (j === i ? v : c)));
  const valid = colors.every((c) => HEX.test(c));
  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label={t("cover.gradientsPresets")} className="flex flex-wrap gap-1.5">
        {COVER_NAMES.map((n) => <button key={n} type="button" aria-label={t(`cover.gradientNames.${n}`)} title={t(`cover.gradientNames.${n}`)} className={SWATCH} style={{ background: `var(--cover-${n})` }} onClick={() => onPick(`gradient:${n}`)} />)}
      </div>
      <div role="group" aria-label={t("cover.gradientEditor")} className="flex flex-col gap-2">
        <div role="group" aria-label={t("cover.gradientColors")} className="flex flex-wrap items-center gap-1.5">
          {colors.map((c, i) => (
            <input key={i} type="color" aria-label={t("cover.gradientColor", { n: i + 1 })} value={HEX.test(c) ? c : coverEditor.neutral} onChange={(e) => setColor(i, e.target.value)}
              className="h-8 w-9 rounded-[var(--radius-md)] bg-[var(--c-raised)] p-0.5" />
          ))}
          {colors.length < 3
            ? <Button size="sm" variant="ghost" onClick={() => setColors((cs) => [...cs, coverEditor.gradientThird])}>{t("cover.addStop")}</Button>
            : <Button size="sm" variant="ghost" onClick={() => setColors((cs) => cs.slice(0, 2))}>{t("cover.removeStop")}</Button>}
        </div>
        <Segmented label={t("cover.angle")} value={String(ANGLES.includes(angle) ? angle : "")} onChange={(v) => setAngle(Number(v))} options={ANGLES.map((a) => ({ value: String(a), label: `${a}°` }))} />
        <label className="flex items-center gap-2 text-[length:var(--text-ui-small-size)]">
          {t("cover.angleFine")}
          <input type="number" min={0} max={359} value={angle} onChange={(e) => setAngle(Math.min(359, Math.max(0, Math.round(Number(e.target.value) || 0))))}
            className="h-8 w-20 rounded-[var(--radius-md)] bg-[var(--c-raised)] px-2" />
        </label>
        <div aria-hidden="true" data-testid="gradient-preview" className="h-8 rounded-[var(--radius-md)] border border-[var(--c-border)]" style={{ background: `linear-gradient(${angle}deg, ${colors.join(", ")})` }} />
        <Button disabled={!valid} onClick={() => onPick(`lgrad:${angle}:${colors.map((c) => c.toLowerCase()).join(",")}`)}>{t("cover.gradientEditor")}</Button>
      </div>
    </div>
  );
}
