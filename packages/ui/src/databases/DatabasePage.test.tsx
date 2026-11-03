// U-178 (RF-12.4): mientras una base de datos se abre, el espacio se reserva con un esqueleto neutro.
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { DatabasePage } from "./DatabasePage";
import type { WorkspaceController } from "../workspace/controller";

describe("carga de una base de datos (U-178)", () => {
  it("mientras carga reserva el espacio con un esqueleto neutro", () => {
    const controller = { openDatabase: () => new Promise(() => {}) } as unknown as WorkspaceController;
    const { container } = render(<DatabasePage controller={controller} pageId="p" />);
    const skeleton = container.querySelector<HTMLElement>(".animate-pulse");
    expect(skeleton).not.toBeNull();
    expect(skeleton!.style.height).toBe("240px");
    expect(skeleton).toHaveAttribute("aria-hidden", "true");
  });
});
