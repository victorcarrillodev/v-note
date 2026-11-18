import { brand } from "@vnote/core";
import { LOGO_DATA_URI } from "./logoData";

/** Símbolo del producto: el logo de la app (imagen redondeada). */
export function Logo({ size = 24, label }: { size?: number; label?: string }) {
  return (
    <img
      data-logo-symbol
      src={LOGO_DATA_URI}
      width={size}
      height={size}
      alt={label ?? ""}
      {...(label ? {} : { "aria-hidden": true })}
      draggable={false}
      style={{ width: size, height: size }}
      className="inline-block shrink-0 select-none"
    />
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
