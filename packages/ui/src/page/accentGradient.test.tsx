import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PageStyleScope } from "./PageStyleScope";

describe("acento degradado de la página", () => {
  it("marca el contenedor solo si el acento es un degradado", () => {
    render(<PageStyleScope style={{ accent: "#ff0000~#00ff00" }}>x</PageStyleScope>);
    expect(screen.getByTestId("page-style-scope")).toHaveAttribute("data-accent-gradient");
    cleanup();
    render(<PageStyleScope style={{ accent: "#ff0000" }}>x</PageStyleScope>);
    expect(screen.getByTestId("page-style-scope")).not.toHaveAttribute("data-accent-gradient");
  });
  it("los separadores se pintan con el degradado", () => {
    const css = readFileSync(join(__dirname, "pageStyle.css"), "utf8");
    expect(css).toMatch(/\[data-accent-gradient\] \.bn-editor hr[^{]*\{[^}]*var\(--c-accent-fill\)/);
  });
});
