// U-161 (RF-5.6, RF-14.9): cada variante del aviso destacado muestra ícono y rótulo, no solo color.
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { CalloutView, CALLOUT_VARIANTS } from "./schema";
import { dropdownOptions } from "../../tests/dropdown";

const LABEL = { info: "Información", success: "Éxito", warning: "Advertencia", danger: "Peligro" } as const;

describe("aviso destacado", () => {
  for (const v of CALLOUT_VARIANTS) {
    it(`variante ${v}: ícono + rótulo + color de los tokens`, async () => {
      const { container } = await renderWithI18n(<CalloutView variant={v} onVariant={() => {}} content={<p>Texto</p>} />);
      const box = container.querySelector(`[data-callout-variant="${v}"]`) as HTMLElement;
      expect(box).toBeTruthy();
      expect(box.querySelector("svg")).toBeTruthy(); // ícono SVG, no emoji
      expect(box.querySelector("[role=combobox]")!.textContent).toBe(LABEL[v]); // rótulo visible
      expect(box.className).toMatch(/chip-/);
      expect(box.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}ℹ⚠⛔✅]/u);
    });
  }
  it("el tipo se cambia con un selector accesible con nombres traducidos", async () => {
    await renderWithI18n(<CalloutView variant="info" onVariant={() => {}} content={<p>x</p>} />);
    const sel = screen.getByLabelText("Tipo de aviso");
    expect((await dropdownOptions(sel)).map((o) => o.label)).toEqual(Object.values(LABEL));
  });
});
