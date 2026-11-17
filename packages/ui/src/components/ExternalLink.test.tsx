import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExternalLink } from "./ExternalLink";
import { AppServicesProvider, type AppServices } from "../app/services";

describe("ExternalLink", () => {
  it("sin proveedor es un enlace normal en otra pestaña", () => {
    render(<ExternalLink href="https://unsplash.com/developers">Clave</ExternalLink>);
    const a = screen.getByRole("link", { name: "Clave" });
    expect(a).toHaveAttribute("href", "https://unsplash.com/developers");
    expect(a).toHaveAttribute("target", "_blank");
    expect(fireEvent.click(a)).toBe(true);
  });

  it("con openExternal (escritorio) lo abre por el sistema y no navega", () => {
    const openExternal = vi.fn();
    render(<AppServicesProvider services={{ openExternal } as unknown as AppServices}><ExternalLink href="https://unsplash.com/developers">Clave</ExternalLink></AppServicesProvider>);
    expect(fireEvent.click(screen.getByRole("link", { name: "Clave" }))).toBe(false);
    expect(openExternal).toHaveBeenCalledWith("https://unsplash.com/developers");
  });
});
