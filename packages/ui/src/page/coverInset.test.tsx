// La portada con esquinas redondeadas se separa de los lados y de arriba, más cuanto mayor es el radio.
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { makeController } from "../../tests/withController";
import { PageHeader } from "./PageHeader";

async function bleed(style: object) {
  const { controller } = await makeController();
  const r = await controller.createPage(null, "P");
  if (!r.ok) throw new Error("x");
  await controller.setPageProps(r.value.id, { cover: "gradient:sky", style });
  await renderWithI18n(<PageHeader controller={controller} pageId={r.value.id} workspaceName="W" />);
  return screen.getByTestId("cover-bleed");
}
describe("separación de la portada redondeada", () => {
  it("sin radio no hay separación", async () => { expect((await bleed({})).getAttribute("style")).toContain("margin-top: -24px"); });
  it("con radio 20 se separa 30 px", async () => { expect((await bleed({ cover: { radius: 20 } })).getAttribute("style")).toContain("margin-top: 6px"); });
  it("con «Esquinas redondeadas» también", async () => { expect((await bleed({ header: { rounded: true } })).getAttribute("style")).toContain("margin-top: 0px"); });
});
