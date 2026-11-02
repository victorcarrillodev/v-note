// T-166 (prueba primero): aviso de versión nueva con botón de descarga.
import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { UpdateNotice } from "./UpdateNotice";

const NEW = { available: true as const, version: "0.2.0", url: "https://github.com/yo/notas-app/releases/tag/v0.2.0" };

describe("UpdateNotice", () => {
  it("si la versión remota es mayor muestra el aviso con la versión y un botón de descarga", async () => {
    const onDownload = vi.fn();
    await renderWithI18n(<UpdateNotice check={async () => NEW} onDownload={onDownload} />);
    const n = await screen.findByRole("status");
    expect(n).toHaveTextContent("0.2.0");
    await userEvent.click(screen.getByRole("button", { name: /descargar/i }));
    expect(onDownload).toHaveBeenCalledWith(NEW.url);
  });
  it("si no hay versión nueva no muestra nada", async () => {
    await renderWithI18n(<UpdateNotice check={async () => ({ available: false })} onDownload={() => {}} />);
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });
  it("si la consulta falla (sin red) no molesta ni lanza", async () => {
    await renderWithI18n(<UpdateNotice check={async () => { throw new Error("offline"); }} onDownload={() => {}} />);
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });
  it("se puede descartar el aviso", async () => {
    await renderWithI18n(<UpdateNotice check={async () => NEW} onDownload={() => {}} />);
    await screen.findByRole("status");
    await userEvent.click(screen.getByRole("button", { name: /cerrar aviso/i }));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
