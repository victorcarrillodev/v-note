import { createReactStyleSpec } from "@blocknote/react";
import { parseUnderline, UNDERLINE_STYLE_KEY } from "@vnote/core";

/**
 * Subrayado con estilo (liso, difuminado o marcatextos, en varios colores). El valor del estilo es «tipo:color»; si no se entiende,
 * el texto se ve sin subrayado y conserva su contenido. El trazo lo dibuja `underline.css` a partir de los atributos `data-ul-*`.
 */
export const underlineStyle = createReactStyleSpec(
  { type: UNDERLINE_STYLE_KEY, propSchema: "string" },
  {
    render: ({ value, contentRef }) => {
      const u = parseUnderline(value);
      return u ? <span ref={contentRef} className="ul" data-ul-kind={u.kind} data-ul-color={u.color} /> : <span ref={contentRef} />;
    },
  },
);
