// U-171 y U-172 (RF-10.3, RF-3.5, CL-24) y E-122 (RF-6.1): el ancho de contenido se elige en el menú de opciones, no en la cabecera.
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { makeController } from "../../tests/withController";
import { PageHeader } from "./PageHeader";
import { PageBody, pageLayoutClass } from "./PageBody";

describe("ancho de contenido", () => {
  it("la cabecera ya no tiene el interruptor de ancho completo (E-122)", async () => {
    const { controller } = await makeController();
    const r = await controller.createPage(null, "Ancha");
    if (!r.ok) throw new Error("x");
    await renderWithI18n(<PageHeader controller={controller} pageId={r.value.id} />);
    expect(screen.queryByRole("switch", { name: "Ancho completo" })).toBeNull();
  });
  it("el diseño usa siempre la variable de ancho que declara el estilo de la página", () => {
    expect(pageLayoutClass()).toContain("max-w-[var(--size-reading-width)]");
    expect(pageLayoutClass()).toContain("w-full");
  });
  it("«completo» quita el límite, y sin estilo se conserva el ancho de lectura", async () => {
    await renderWithI18n(<PageBody style={{ spacing: { width: "full" } }}><p>x</p></PageBody>);
    expect(screen.getByTestId("page-style-scope").style.getPropertyValue("--size-reading-width")).toBe("none");
  });
  it("el cuerpo de la página contiene el desplazamiento horizontal de contenido muy ancho (tabla de 30 columnas)", async () => {
    await renderWithI18n(<PageBody style={{}}><table><tbody><tr>{Array.from({ length: 30 }, (_, i) => <td key={i}>c{i}</td>)}</tr></tbody></table></PageBody>);
    const body = screen.getByTestId("page-body");
    expect(body.className).toContain("min-w-0");
    expect(body.className).toContain("[&_table]:block");
    expect(body.className).toContain("[&_table]:overflow-x-auto");
  });
});
