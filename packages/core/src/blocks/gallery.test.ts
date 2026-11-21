import { describe, it, expect } from "vitest";
import type { Block } from "./types";
import { galleryLayoutOf, parseGallery, serializeGallery } from "./gallery";
import { blocksToHtml, collectAssetUrls, newReport } from "../export/html";
import { blocksToPlainText } from "../search/plainText";
import { blocksToMarkdown } from "../backup/markdown";
import { assetUrl } from "../assets/attach";

const A = assetUrl("a".repeat(64));
const gallery = (images: unknown, layout = "mosaic"): Block => ({ id: "g", type: "gallery", props: { images: typeof images === "string" ? images : serializeGallery(images as never), layout }, content: undefined, children: [] });
const ctx = (over = {}) => ({ assets: new Map(), databases: new Map(), pageAnchors: new Map(), report: newReport(), ...over });

describe("galería de imágenes", () => {
  it("lee y escribe la lista; lo inválido se ignora", () => {
    const imgs = [{ url: A, name: "a.png", caption: "Una", cols: 1, rows: 1, fit: "" as const }];
    expect(parseGallery(serializeGallery(imgs))).toEqual(imgs);
    expect(parseGallery("no es json")).toEqual([]);
    expect(parseGallery('[1,{"url":""},{"url":"https://x/y.png"}]')).toEqual([{ url: "https://x/y.png", name: "", caption: "", cols: 1, rows: 1, fit: "" }]);
    expect(parseGallery(undefined)).toEqual([]);
  });
  it("el diseño inválido cae en mosaico", () => {
    expect(galleryLayoutOf("carousel")).toBe("carousel");
    expect(galleryLayoutOf("x")).toBe("mosaic");
  });
  it("se exporta a HTML con su diseño y sus adjuntos", () => {
    const b = gallery([{ url: A, name: "a.png", caption: "Una" }, { url: "https://x.test/y.png", name: "", caption: "" }], "carousel");
    expect(collectAssetUrls([b])).toEqual([A]);
    const out = blocksToHtml([b], ctx({ assets: new Map([[A, { dataUri: "data:image/png;base64,AA" }]]) }));
    expect(out).toContain('class="gallery gallery-carousel"');
    expect(out).toContain('src="data:image/png;base64,AA"');
    expect(out).toContain("<figcaption>Una</figcaption>");
    expect(out).toContain('src="https://x.test/y.png"');
  });
  it("un adjunto que falta se avisa y no rompe la galería", () => {
    const c = ctx();
    const out = blocksToHtml([gallery([{ url: A, name: "a.png", caption: "" }])], c);
    expect(out).not.toContain("<img");
    expect(c.report.missing.length + c.report.warnings.length).toBeGreaterThan(0);
  });
  it("el texto de búsqueda incluye nombres y pies; el Markdown las imágenes", () => {
    const b = gallery([{ url: A, name: "playa.png", caption: "Verano" }]);
    expect(blocksToPlainText([b])).toContain("playa.png Verano");
    expect(blocksToMarkdown([b])).toContain(`![Verano](${A})`);
  });
  it("el mosaico personalizado exporta cuánto ocupa cada imagen; el regular no", () => {
    const imgs = [{ url: "https://x.test/y.png", name: "", caption: "", cols: 2, rows: 3 }];
    const custom = { ...gallery(imgs), props: { ...gallery(imgs).props, mosaicStyle: "custom" } };
    expect(blocksToHtml([custom], ctx())).toContain("grid-column:span 2;grid-row:span 3");
    expect(blocksToHtml([gallery(imgs)], ctx())).not.toContain("grid-column");
  });
  it("los tamaños se limitan de 1 a 4", () => {
    expect(parseGallery('[{"url":"u","cols":9,"rows":0}]')[0]).toMatchObject({ cols: 4, rows: 1 });
  });
  it("el ajuste de imagen y la altura se exportan; el ajuste propio manda sobre el de la galería", () => {
    const imgs = [{ url: "https://x.test/a.png", name: "", caption: "", cols: 1, rows: 1, fit: "" }, { url: "https://x.test/b.png", name: "", caption: "", cols: 1, rows: 1, fit: "contain" }];
    const b = { ...gallery(imgs), props: { ...gallery(imgs).props, fit: "fill", rowHeight: "large" } };
    const out = blocksToHtml([b], ctx());
    expect(out).toContain("grid-auto-rows:20rem");
    expect(out).toContain("object-fit:fill");
    expect(out).toContain("object-fit:contain");
  });
  it("un ajuste inválido se ignora", () => {
    expect(parseGallery('[{"url":"u","fit":"zoom"}]')[0]!.fit).toBe("");
  });
});
