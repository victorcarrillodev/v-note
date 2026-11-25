import type { CSSProperties, ReactNode } from "react";
import { cssVarsFor, type PageStyle } from "@vnote/core";
import { cx } from "../design/cx";
import "./pageStyle.css";

/**
 * Contenedor de una página: declara aquí (no en `<html>`) las variables de su estilo — tipografía, espaciado, ancho y acento —
 * para que el estilo de una página nunca altere la aplicación ni otras páginas (RF-4.3, DP-5). Lo que el estilo no nombra se hereda
 * de la apariencia global del dispositivo.
 */
export function PageStyleScope({ style, as: Tag = "div", className, children }: { style: PageStyle; as?: "div" | "article"; className?: string; children: ReactNode }) {
  const vars = cssVarsFor(style);
  const { textSize, leading } = style.spacing ?? {};
  return (
    <Tag
      data-testid="page-style-scope" className={cx("page-scope", className)} style={vars as CSSProperties}
      {...(vars["--c-accent-fill"] ? { "data-accent-gradient": "" } : {})}
      {...(leading ? { "data-block-gap": "" } : {})} {...(textSize || leading ? { "data-reading": "" } : {})}
    >
      {children}
    </Tag>
  );
}
