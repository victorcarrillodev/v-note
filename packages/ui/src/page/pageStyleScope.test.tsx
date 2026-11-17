// E-117 a E-119 (RF-4.3, RF-5.2, RF-6.4, DP-5): el estilo vive en el contenedor de la página, no en <html>.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { screen } from "@testing-library/react";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { PageStyleScope } from "./PageStyleScope";

const css = readFileSync(resolve(__dirname, "pageStyle.css"), "utf8");
const ruleFor = (selector: string) => {
  const i = css.indexOf(selector);
  expect(i, `falta la regla ${selector}`).toBeGreaterThanOrEqual(0);
  return css.slice(css.indexOf("{", i) + 1, css.indexOf("}", i));
};

describe("PageStyleScope (E-117)", () => {
  it("pone las variables en el contenedor y <html> no cambia", async () => {
    const before = document.documentElement.getAttribute("style");
    await renderWithI18n(<PageStyleScope style={{ typography: { body: "lora", headings: "caveat" }, spacing: { width: "wide", textSize: "large", leading: "relaxed" }, accent: "purple" }}><p>x</p></PageStyleScope>);
    const el = screen.getByTestId("page-style-scope");
    const v = (n: string) => el.style.getPropertyValue(n);
    expect(v("--font-content")).toBe("var(--font-lora)");
    expect(v("--font-headings")).toBe("var(--font-caveat)");
    expect(v("--text-reading-size")).toBe("var(--page-text-large)");
    expect(v("--text-reading-line")).toBe("var(--page-leading-relaxed)");
    expect(v("--block-gap")).toBe("var(--page-gap-relaxed)");
    expect(v("--size-reading-width")).toBe("var(--page-width-wide)");
    expect(v("--c-accent")).toBe("var(--block-purple-text)");
    expect(document.documentElement.getAttribute("style")).toBe(before);
    expect(document.documentElement.style.getPropertyValue("--font-content")).toBe("");
  });
  it("sin estilo no declara ninguna variable: todo se hereda de la apariencia global", async () => {
    await renderWithI18n(<PageStyleScope style={{}}><p>x</p></PageStyleScope>);
    expect(screen.getByTestId("page-style-scope").getAttribute("style") ?? "").toBe("");
    expect(screen.getByTestId("page-style-scope")).not.toHaveAttribute("data-block-gap");
    expect(screen.getByTestId("page-style-scope")).not.toHaveAttribute("data-reading");
  });
  it("dos páginas no se contaminan: cada contenedor lleva solo su estilo", async () => {
    await renderWithI18n(<><PageStyleScope style={{ accent: "red" }}><p>a</p></PageStyleScope><PageStyleScope style={{}}><p>b</p></PageStyleScope></>);
    const [a, b] = screen.getAllByTestId("page-style-scope");
    expect(a!.style.getPropertyValue("--c-accent")).toBe("var(--block-red-text)");
    expect(b!.style.getPropertyValue("--c-accent")).toBe("");
  });
});

describe("fuente de los títulos (E-118)", () => {
  it("--font-headings se aplica al título de la página y a los encabezados del editor", () => {
    const r = ruleFor('.page-scope [data-page-title]');
    expect(r).toContain("font-family: var(--font-headings)");
    expect(css).toContain('.page-scope .bn-block-content[data-content-type="heading"]');
  });
  it("el texto del editor sigue a --font-content", () => {
    expect(ruleFor(".page-scope .bn-container.bn-mantine")).toContain("--bn-font-family: var(--font-content)");
  });
});

describe("separación entre bloques (E-119)", () => {
  it("--block-gap separa los bloques del editor solo cuando la página elige interlineado", async () => {
    expect(ruleFor(".page-scope[data-block-gap] .bn-block-outer")).toContain("margin-top: var(--block-gap)");
    await renderWithI18n(<PageStyleScope style={{ spacing: { leading: "compact" } }}><p>x</p></PageStyleScope>);
    expect(screen.getByTestId("page-style-scope")).toHaveAttribute("data-block-gap");
  });
  it("el tamaño y el interlineado del texto se aplican al editor solo cuando la página los elige", () => {
    expect(ruleFor(".page-scope[data-reading] .bn-editor")).toContain("font-size: var(--text-reading-size)");
    expect(ruleFor(".page-scope[data-reading] .bn-editor")).toContain("line-height: var(--text-reading-line)");
  });
});
