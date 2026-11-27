// study-features-2 T-3 (prueba primero): ecuación en línea dentro del texto de un bloque.
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { InlineMathView } from "./InlineMath";
import { schema } from "../editor/schema";

describe("ecuación en línea", () => {
  it("se ve compuesta con KaTeX y no es editable al pasar el ratón por encima", async () => {
    const { container } = await renderWithI18n(<InlineMathView formula="x^2" editable onChange={() => {}} />);
    expect(container.querySelector(".katex")).not.toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("al pulsarla se edita en su sitio; cada cambio se guarda y Enter la cierra", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    await renderWithI18n(<InlineMathView formula="x" editable onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Editar ecuación en línea" }));
    const box = screen.getByRole("textbox", { name: "Fórmula en línea" });
    await user.type(box, "^2");
    expect(onChange).toHaveBeenLastCalledWith("x^2");
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("vacía abre el editor sola y muestra un texto guía si se cierra sin fórmula", async () => {
    const user = userEvent.setup();
    await renderWithI18n(<InlineMathView formula="" editable onChange={() => {}} />);
    expect(screen.getByRole("textbox", { name: "Fórmula en línea" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Editar ecuación en línea" })).toHaveTextContent("fórmula");
  });

  it("sin permiso de edición no se puede abrir el editor", async () => {
    const user = userEvent.setup();
    await renderWithI18n(<InlineMathView formula="x" editable={false} onChange={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Editar ecuación en línea" }));
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("una fórmula inválida no rompe la página (se muestra el error de KaTeX en rojo)", async () => {
    const { container } = await renderWithI18n(<InlineMathView formula={"\\frac{"} editable onChange={() => {}} />);
    expect(container.querySelector(".katex-error, .katex")).not.toBeNull();
  });

  it("el esquema del editor reconoce el contenido en línea «math»", () => {
    expect(Object.keys(schema.inlineContentSpecs)).toContain("math");
  });
});
