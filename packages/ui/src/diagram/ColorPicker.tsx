import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fillFor, paletteFor, strokeFor } from "../design/diagramPalette";
import { FIELD_CONTROL } from "./panelStyles";
import { ColorInput } from "../components/controls";

const HEX = /^#?(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
// Color que muestra la entrada nativa cuando el valor es de paleta (no es un color elegido).
const NATIVE_DEFAULT = `#${"0".repeat(6)}`;
const norm = (v: string) => (v.startsWith("#") ? v : `#${v}`);
const toNative = (v: string): string => { const h = v.replace("#", ""); const six = h.length <= 4 ? h.slice(0, 3).split("").map((c) => c + c).join("") : h.slice(0, 6); return `#${six}`; };

/** Selector de color: paleta del sistema (se adapta al tema), campo hexadecimal, color nativo y últimos usados. Todo se aplica de inmediato. */
export function ColorPicker({ label, role, value, allowNone = false, recents, onChange }: {
  label: string; role: "fill" | "stroke" | "text"; value: string; allowNone?: boolean; recents: string[]; onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const custom = value.startsWith("#") ? value : "";
  const [text, setText] = useState(custom);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setText(custom); setInvalid(false); }, [custom]);
  const paint = (v: string) => (role === "fill" ? fillFor(v) : strokeFor(v));
  const swatch = (key: string, name: string, v: string, pressed: boolean) => (
    <button key={key} type="button" aria-label={name} title={name} aria-pressed={pressed} data-swatch={paint(v)} onClick={() => onChange(v)}
      className="h-6 w-6 rounded-[var(--radius-md)] border border-[var(--c-border-control)] transition-transform duration-100 hover:scale-110 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 aria-pressed:outline aria-pressed:outline-2 aria-pressed:outline-offset-2 aria-pressed:outline-[var(--c-accent)]"
      style={{ background: v === "none" ? "transparent" : paint(v) }} />
  );
  const onText = (raw: string) => {
    setText(raw);
    if (raw.trim() === "") { setInvalid(false); return; }
    if (HEX.test(raw.trim())) { setInvalid(false); onChange(norm(raw.trim()).toLowerCase()); } else setInvalid(true);
  };
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1">
      <span className="text-[length:var(--text-note-size)] text-[var(--c-text-muted)]">{label}</span>
      <div className="flex flex-wrap items-center gap-1">
        {allowNone && swatch("none", t("diagram.colors.none"), "none", value === "none")}
        {paletteFor(role).map((id) => swatch(id, t(`diagram.colors.${id}`), `palette:${id}`, value === `palette:${id}`))}
      </div>
      {recents.length > 0 && (
        <div role="group" aria-label={t("diagram.recentColors")} className="flex flex-wrap items-center gap-1">
          {recents.map((c) => swatch(`r${c}`, c, c, value.toLowerCase() === c))}
        </div>
      )}
      <div className="mt-0.5 flex items-center gap-1.5">
        <input aria-label={`${label}: ${t("diagram.hex")}`} value={text} onChange={(e) => onText(e.target.value)} aria-invalid={invalid} placeholder="#RRGGBB" className={`w-24 ${FIELD_CONTROL}`} />
        <ColorInput label={`${label}: ${t("diagram.pickColor")}`} value={custom ? toNative(custom) : NATIVE_DEFAULT} onChange={onChange} />
      </div>
      {invalid && <p className="text-xs text-[var(--c-danger)]">{t("diagram.invalidHex")}</p>}
    </div>
  );
}
