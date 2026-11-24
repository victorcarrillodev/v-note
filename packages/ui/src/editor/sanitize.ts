import DOMPurify from "dompurify";

/** Etiquetas de contenido que se permiten al pegar/importar; todo lo demás (scripts, iframes, svg, formularios, estilos...) se elimina. */
const ALLOWED_TAGS = [
  "p", "br", "hr", "div", "span", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "b", "em", "i", "u", "s", "del", "mark", "code", "pre", "kbd", "sub", "sup",
  "blockquote", "ul", "ol", "li", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "a", "img", "details", "summary",
];
const ALLOWED_ATTR = ["href", "src", "alt", "title", "colspan", "rowspan", "start", "open", "checked", "type", "class",
  // Estilos propios del editor al copiar y pegar dentro de la app (p. ej. el subrayado con estilo): inertes; al leerlos se validan.
  "data-style-type", "data-value"];

/**
 * Sanea HTML pegado o importado (CL-24, D-30): nunca llega código ejecutable al documento.
 * Solo se admiten URLs http(s), mailto y data:image; sin atributos on*, `style` ni etiquetas activas.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ADD_URI_SAFE_ATTR: ["data-value"], // «tipo:color» tiene forma de esquema de URL; no es un enlace
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|data:image\/(?:png|jpe?g|gif|webp);base64,|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    SANITIZE_DOM: true,
    SANITIZE_NAMED_PROPS: true,
    FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "svg", "math", "form", "input", "button", "link", "meta", "base", "template", "noscript"],
    FORBID_ATTR: ["style", "srcset", "srcdoc", "formaction", "action", "background"],
  });
}
