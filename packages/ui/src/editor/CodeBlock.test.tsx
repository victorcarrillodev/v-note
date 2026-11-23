// U-163 (prueba primero): bloque de código con lenguaje y botón «Copiar» que confirma «Copiado» 1,5 s.
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { defaultBlockSpecs } from "@blocknote/core";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { CodeBlockView, codeBlock } from "./CodeBlock";
import { choose, dropdownOptions } from "../../tests/dropdown";

function setup(language = "text") {
  const updateBlock = vi.fn();
  const editor = { updateBlock } as never;
  const block = { id: "b1", type: "codeBlock", props: { language }, content: [] } as never;
  return { updateBlock, editor, block };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("bloque de código (U-163)", () => {
  it("muestra el lenguaje con su nombre accesible y lo guarda al cambiarlo", async () => {
    const { editor, block, updateBlock } = setup();
    await renderWithI18n(<CodeBlockView block={block} editor={editor} contentRef={() => {}} />);
    const select = screen.getByRole("combobox", { name: "Lenguaje del bloque" });
    expect(select).toHaveAttribute("data-value", "text");
    await choose(userEvent.setup(), select, "javascript");
    expect(updateBlock).toHaveBeenCalledWith("b1", { props: { language: "javascript" } });
  });

  it("muestra el idioma tal cual cuando no está en la lista (importado)", async () => {
    const { editor, block } = setup("cobol");
    await renderWithI18n(<CodeBlockView block={block} editor={editor} contentRef={() => {}} />);
    const sel = screen.getByRole("combobox", { name: "Lenguaje del bloque" });
    expect(sel).toHaveAttribute("data-value", "cobol");
    expect((await dropdownOptions(sel)).map((o) => o.value)).toContain("cobol");
  });

  it("conserva el análisis de HTML y el lenguaje del bloque predeterminado", () => {
    const spec = codeBlock();
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.className = "language-typescript";
    pre.appendChild(code);
    expect(spec.implementation.parse?.(pre)).toEqual({ language: "typescript" });
    expect(spec.implementation.parseContent).toBe(defaultBlockSpecs.codeBlock.implementation.parseContent);
  });

  it("copia el contenido y muestra «Copiado» durante 1,5 s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const { editor, block } = setup("javascript");
    await renderWithI18n(
      <CodeBlockView block={block} editor={editor} contentRef={(node) => { if (node) node.textContent = "const a = 1;"; }} />,
    );
    const copy = screen.getByRole("button", { name: "Copiar código" });
    expect(copy).toHaveTextContent("Copiar");
    await act(async () => { fireEvent.click(copy); });
    expect(writeText).toHaveBeenCalledWith("const a = 1;");
    expect(copy).toHaveTextContent("Copiado");
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(copy).toHaveTextContent("Copiar");
  });
});
