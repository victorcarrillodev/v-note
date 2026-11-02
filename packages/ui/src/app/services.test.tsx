// T-106 (prueba primero): proveedor del núcleo/puertos y estado de interfaz.
import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { AppServicesProvider, useServices, useUiStore, type AppServices } from "./services";

const fakeServices = { marker: "svc" } as unknown as AppServices;

function Probe() {
  const s = useServices() as unknown as { marker: string };
  return <p>servicio:{s.marker}</p>;
}

describe("AppServicesProvider", () => {
  it("entrega los servicios a los componentes hijos", () => {
    render(<AppServicesProvider services={fakeServices}><Probe /></AppServicesProvider>);
    expect(screen.getByText("servicio:svc")).toBeInTheDocument();
  });
  it("usarlos fuera del proveedor lanza un error claro", () => {
    const spy = () => {};
    const orig = console.error; console.error = spy;
    expect(() => render(<Probe />)).toThrow(/AppServicesProvider/);
    console.error = orig;
  });
});

describe("estado de interfaz (zustand)", () => {
  it("guarda la página abierta y el espacio activo y notifica a los componentes", () => {
    function View() {
      const page = useUiStore((s) => s.openPageId);
      return <p>página:{page ?? "ninguna"}</p>;
    }
    render(<View />);
    expect(screen.getByText("página:ninguna")).toBeInTheDocument();
    act(() => useUiStore.getState().openPage("p1"));
    expect(screen.getByText("página:p1")).toBeInTheDocument();
    act(() => useUiStore.getState().reset());
    expect(screen.getByText("página:ninguna")).toBeInTheDocument();
  });
});
