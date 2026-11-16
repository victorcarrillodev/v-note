// U-171 y U-172 (RF-10.3, RF-3.5, CL-24): «Ancho completo» por página y contenido muy ancho sin desplazar toda la página.
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { makeController } from "../../tests/withController";
import { PageHeader } from "./PageHeader";
import { PageBody, pageLayoutClass } from "./PageBody";

describe("ancho completo", () => {
  it("el interruptor persiste en la página y sobrevive a recargar el árbol", async () => {
    const { controller } = await makeController();
    const r = await controller.createPage(null, "Ancha");
    if (!r.ok) throw new Error("x");
    await renderWithI18n(<PageHeader controller={controller} pageId={r.value.id} />);
    const sw = screen.getByRole("switch", { name: "Ancho completo" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    await userEvent.click(sw);
    await controller.refresh();
    expect(controller.getSnapshot().tree[0]!.page.style.spacing?.width).toBe("full"); // E-042: vive en el estilo
    expect(screen.getByRole("switch", { name: "Ancho completo" })).toHaveAttribute("aria-checked", "true");
  });
  it("el diseño usa el ancho de lectura o todo el ancho", () => {
    expect(pageLayoutClass(false)).toContain("max-w-[var(--size-reading-width)]");
    expect(pageLayoutClass(true)).not.toContain("max-w-[var(--size-reading-width)]");
    expect(pageLayoutClass(true)).toContain("w-full");
  });
  it("el cuerpo de la página contiene el desplazamiento horizontal de contenido muy ancho (tabla de 30 columnas)", async () => {
    await renderWithI18n(<PageBody fullWidth><table><tbody><tr>{Array.from({ length: 30 }, (_, i) => <td key={i}>c{i}</td>)}</tr></tbody></table></PageBody>);
    const body = screen.getByTestId("page-body");
    expect(body.className).toContain("min-w-0");
    expect(body.className).toContain("[&_table]:block");
    expect(body.className).toContain("[&_table]:overflow-x-auto");
  });
});
