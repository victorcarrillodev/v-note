import brandConfig from "../../../../brand.config.json";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Plugin de Vite: pone el nombre del producto (de `brand.config.json`, único lugar donde vive) como título de la ventana. */
export function brandPlugin(brand: { name: string } = brandConfig) {
  return {
    name: "vnote-brand",
    transformIndexHtml(html: string): string {
      return html.replace(/<title>[^<]*<\/title>/, `<title>${esc(brand.name)}</title>`);
    },
  };
}
