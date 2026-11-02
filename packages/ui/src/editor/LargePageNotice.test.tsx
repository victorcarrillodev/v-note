// T-134b: aviso (no bloqueante) al superar 5 000 bloques.
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { LargePageNotice } from "./LargePageNotice";

describe("LargePageNotice", () => {
  it("no aparece hasta superar 5 000 bloques", async () => {
    await renderWithI18n(<LargePageNotice blocks={5000} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("aparece con el número de bloques y sugiere dividir, sin bloquear nada", async () => {
    await renderWithI18n(<LargePageNotice blocks={5001} />);
    const n = screen.getByRole("status");
    expect(n).toHaveTextContent(/5001 bloques/);
    expect(n).toHaveTextContent(/dividirla/);
    expect(n).not.toHaveAttribute("aria-modal");
  });
});
