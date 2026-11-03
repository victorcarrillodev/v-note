// U-070, U-072, U-073 (RF-3.4, RF-11.2, CL-1): migas de pan navegables, estado de guardado y última edición.
import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { HeaderBar } from "./HeaderBar";
import { relativeParts } from "./relativeTime";
import { createSaveStatusStore } from "./saveStatusStore";

const crumbs = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, title: `Nivel ${i}` }));

describe("relativeParts", () => {
  it.each([[10_000, "now", 0], [60_000, "minutes", 1], [5 * 60_000, "minutes", 5], [3 * 3_600_000, "hours", 3], [2 * 86_400_000, "days", 2]] as const)("%i ms → %s %i", (ms, key, count) => {
    expect(relativeParts(ms)).toEqual({ key, count });
  });
});

describe("migas de pan (RF-3.4)", () => {
  it("cada miga es navegable y la última es la página actual (sin enlace)", async () => {
    const onNavigate = vi.fn();
    await renderWithI18n(<HeaderBar crumbs={crumbs(3)} onNavigate={onNavigate} status={{ kind: "saved" }} onRetry={() => {}} />);
    const nav = screen.getByRole("navigation", { name: /ruta/i });
    await userEvent.click(within(nav).getByRole("button", { name: "Nivel 0" }));
    expect(onNavigate).toHaveBeenCalledWith("p0");
    expect(within(nav).getByText("Nivel 2")).toHaveAttribute("aria-current", "page");
    expect(within(nav).queryByRole("button", { name: "Nivel 2" })).toBeNull();
  });
  it("con 8 niveles muestra inicio, «…» y los últimos; el «…» abre las migas ocultas", async () => {
    const onNavigate = vi.fn();
    await renderWithI18n(<HeaderBar crumbs={crumbs(8)} onNavigate={onNavigate} status={{ kind: "saved" }} onRetry={() => {}} />);
    const nav = screen.getByRole("navigation", { name: /ruta/i });
    expect(within(nav).getByText("Nivel 7")).toBeInTheDocument();
    expect(within(nav).queryByText("Nivel 3")).toBeNull();
    await userEvent.click(within(nav).getByRole("button", { name: /migas ocultas/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Nivel 3" }));
    expect(onNavigate).toHaveBeenCalledWith("p3");
  });
  it("un título largo se trunca con el título completo disponible", async () => {
    const long = "T".repeat(200);
    await renderWithI18n(<HeaderBar crumbs={[{ id: "a", title: long }]} onNavigate={() => {}} status={{ kind: "saved" }} onRetry={() => {}} />);
    const el = screen.getByText(long);
    expect(el.className).toContain("truncate");
    expect(el).toHaveAttribute("title", long);
  });
});

describe("estado de guardado (RF-3.4, RF-11.2)", () => {
  it("«Guardado» con ícono y texto, como estado discreto", async () => {
    const { container } = await renderWithI18n(<HeaderBar crumbs={[]} onNavigate={() => {}} status={{ kind: "saved" }} onRetry={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent("Guardado");
    expect(container.querySelector("[role=status] svg")).not.toBeNull();
  });
  it("«Guardando…»", async () => {
    await renderWithI18n(<HeaderBar crumbs={[]} onNavigate={() => {}} status={{ kind: "saving" }} onRetry={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent("Guardando…");
  });
  it("el error es persistente (role=alert), con la causa y «Reintentar» que llama a onRetry", async () => {
    const onRetry = vi.fn();
    await renderWithI18n(<HeaderBar crumbs={[]} onNavigate={() => {}} status={{ kind: "error", message: "disco lleno" }} onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No se guardó");
    expect(screen.getByRole("alert")).toHaveTextContent("disco lleno");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalled();
  });
  it("el tooltip del indicador muestra la última edición", async () => {
    const now = 10 * 60_000;
    await renderWithI18n(<HeaderBar crumbs={[]} onNavigate={() => {}} status={{ kind: "saved" }} onRetry={() => {}} lastEditedAt={now - 2 * 60_000} now={now} />);
    expect(screen.getByRole("status")).toHaveAttribute("title", "Editado hace 2 min");
  });
});

describe("almacén del estado de guardado", () => {
  it("aplica eventos y notifica a quienes escuchan", () => {
    const store = createSaveStatusStore();
    const seen: string[] = [];
    const off = store.subscribe(() => seen.push(store.getSnapshot().kind));
    store.dispatch({ type: "edit" });
    store.dispatch({ type: "saved" });
    store.dispatch({ type: "failed", message: "x" });
    off();
    store.dispatch({ type: "saved" });
    expect(seen).toEqual(["saving", "saved", "error"]);
    expect(store.getSnapshot().kind).toBe("saved");
  });
  it("«retry» invoca el reintento registrado y pasa a «guardando»", () => {
    const store = createSaveStatusStore();
    const retry = vi.fn();
    store.setRetry(retry);
    store.dispatch({ type: "failed", message: "x" });
    store.retry();
    expect(retry).toHaveBeenCalled();
    expect(store.getSnapshot().kind).toBe("saving");
  });
});
