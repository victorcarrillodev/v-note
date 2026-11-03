import { brand } from "@vnote/core";
import { monogram } from "../layout/monogram";

/** Símbolo del producto: la inicial del nombre configurado sobre un cuadrado con degradado sutil del acento (único lugar con degradado). */
export function Logo({ size = 24, label }: { size?: number; label?: string }) {
  return (
    <span
      data-logo-symbol
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.58), lineHeight: 1 }}
      className="inline-flex shrink-0 select-none items-center justify-center rounded-md bg-gradient-to-b from-[var(--c-accent)] to-[color-mix(in_srgb,var(--c-accent)_88%,black)] font-semibold text-[var(--c-on-accent)]"
    >
      {monogram(brand.name)}
    </span>
  );
}

/** Logotipo completo: símbolo + nombre del producto. */
export function Wordmark({ size = 24 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Logo size={size} />
      <span data-logo-name className="font-semibold text-[var(--c-text)]">{brand.name}</span>
    </span>
  );
}
