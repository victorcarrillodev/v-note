import type { ReactNode } from "react";

const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Ilustraciones de línea propias (SVG en línea): heredan el color del texto, así que sirven en ambos temas. */
export const ILLUSTRATIONS = {
  pages: <><rect x="22" y="14" width="52" height="68" rx="6" /><path d="M34 34h28M34 46h28M34 58h16" /><path d="M64 70l12 12" opacity=".5" /></>,
  trash: <><path d="M28 30h40l-4 50H32z" /><path d="M22 30h52M40 30v-8h16v8" /><path d="M42 44v26M54 44v26" opacity=".5" /></>,
  table: <><rect x="14" y="22" width="68" height="52" rx="6" /><path d="M14 40h68M38 40v34M60 40v34" /></>,
  calendar: <><rect x="16" y="22" width="64" height="58" rx="6" /><path d="M16 38h64M34 14v14M62 14v14" /><circle cx="36" cy="54" r="2.5" /><circle cx="48" cy="54" r="2.5" /><circle cx="60" cy="54" r="2.5" /></>,
  reminders: <><path d="M48 18a18 18 0 0 0-18 18v14l-6 10h48l-6-10V36a18 18 0 0 0-18-18z" /><path d="M42 74a6 6 0 0 0 12 0" /></>,
  search: <><circle cx="42" cy="42" r="20" /><path d="M57 57l20 20" /><path d="M34 42h16" opacity=".5" /></>,
} satisfies Record<string, ReactNode>;

export type IllustrationName = keyof typeof ILLUSTRATIONS;

export function Illustration({ name, size = 96 }: { name: IllustrationName; size?: number }) {
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} aria-hidden="true" focusable="false" {...common}>
      {ILLUSTRATIONS[name]}
    </svg>
  );
}
