// U-143 (RF-18.2, CL-3): con textos ~40 % más largos (por traducción) nada queda cortado sin forma de leerlo completo.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { Tabs } from "./Tabs";

const largo = "Texto bastante más largo que el habitual para comprobar que no se corta sin forma de leerlo completo";

describe("textos largos (+40 %) (U-143)", () => {
  it("el botón conserva el texto completo, sin truncarlo", () => {
    render(<Button>{largo}</Button>);
    const b = screen.getByRole("button");
    expect(b.textContent).toBe(largo);
    expect(b.className).not.toContain("truncate");
  });
  it("una etiqueta que se trunca expone el texto completo (title)", () => {
    render(<Chip>{largo}</Chip>);
    expect(screen.getByTitle(largo)).toHaveTextContent(largo);
  });
  it("las pestañas conservan el texto completo como nombre accesible", () => {
    render(<Tabs label="Vistas" value="a" onChange={() => {}} tabs={[{ value: "a", label: largo }]} />);
    expect(screen.getByRole("tab", { name: largo })).toBeInTheDocument();
  });
});
