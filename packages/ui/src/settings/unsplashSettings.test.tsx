// E-160 a E-163 (RF-9.1, RF-9.2, RF-9.4): preferencia «Activar Unsplash», clave y creación del cliente.
import { describe, it, expect, vi } from "vitest";
import { act, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryKeychain, UnsplashClient, type Keychain, type UnsplashFetch } from "@vnote/core";
import { renderWithI18n } from "../../tests/renderWithI18n";
import { ThemeProvider, MemoryPreferences } from "../theme/theme";
import { SettingsView } from "./SettingsView";
import { UNSPLASH_PREFERENCE, UnsplashProvider, useUnsplash, type UnsplashRuntime } from "../unsplash/UnsplashContext";
import type { ReactNode } from "react";

const noFetch: UnsplashFetch = async () => { throw new Error("no debería salir ninguna petición"); };
const runtime = (over: Partial<UnsplashRuntime> = {}): UnsplashRuntime => ({ platform: "desktop", keychain: new MemoryKeychain(), fetch: noFetch, ...over });

async function settings(rt: UnsplashRuntime | undefined, prefs = new MemoryPreferences()) {
  const user = userEvent.setup();
  await renderWithI18n(<ThemeProvider preferences={prefs}><UnsplashProvider runtime={rt} preferences={prefs}><SettingsView preferences={prefs} /></UnsplashProvider></ThemeProvider>);
  return { user, prefs };
}

describe("preferencia «Activar Unsplash» (E-160)", () => {
  it("está apagada por defecto", async () => {
    const prefs = new MemoryPreferences();
    const { result } = renderHook(() => useUnsplash(), { wrapper: ({ children }: { children: ReactNode }) => <UnsplashProvider runtime={runtime()} preferences={prefs}>{children}</UnsplashProvider> });
    expect(result.current.enabled).toBe(false);
    expect(prefs.get(UNSPLASH_PREFERENCE)).toBeNull();
  });
  it("encenderla se guarda como preferencia del dispositivo y se recuerda", async () => {
    const prefs = new MemoryPreferences();
    const wrapper = ({ children }: { children: ReactNode }) => <UnsplashProvider runtime={runtime()} preferences={prefs}>{children}</UnsplashProvider>;
    const a = renderHook(() => useUnsplash(), { wrapper });
    act(() => a.result.current.setEnabled(true));
    expect(a.result.current.enabled).toBe(true);
    expect(prefs.get(UNSPLASH_PREFERENCE)).toBe("1");
    a.unmount();
    expect(renderHook(() => useUnsplash(), { wrapper }).result.current.enabled).toBe(true);
  });
});

describe("Ajustes de Unsplash (E-161)", () => {
  it("interruptor, explicación de lo que sale del equipo, campo de clave y enlace para desarrolladores", async () => {
    await settings(runtime());
    const region = screen.getByRole("region", { name: "Fotos de Unsplash" });
    expect(screen.getByRole("switch", { name: "Activar Unsplash" })).not.toBeChecked();
    expect(region).toHaveTextContent("api.unsplash.com");
    expect(region).toHaveTextContent("images.unsplash.com");
    expect(region).toHaveTextContent("El contenido de tus páginas nunca se envía");
    expect(screen.getByLabelText("Clave de acceso de Unsplash")).toHaveAttribute("type", "password");
    const link = screen.getByRole("link", { name: /página de desarrolladores de Unsplash/ });
    expect(link).toHaveAttribute("href", "https://unsplash.com/developers");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
  it("encender el interruptor activa Unsplash", async () => {
    const { user, prefs } = await settings(runtime());
    await user.click(screen.getByRole("switch", { name: "Activar Unsplash" }));
    expect(prefs.get(UNSPLASH_PREFERENCE)).toBe("1");
    expect(screen.getByRole("switch", { name: "Activar Unsplash" })).toBeChecked();
  });
  it("guarda la clave en el llavero, recortada, y no la deja a la vista; «Borrar clave» la quita", async () => {
    const kc = new MemoryKeychain();
    const { user } = await settings(runtime({ keychain: kc }));
    const input = screen.getByLabelText("Clave de acceso de Unsplash");
    await user.type(input, "  abc123  ");
    await user.click(screen.getByRole("button", { name: "Guardar clave" }));
    await waitFor(async () => expect(await kc.get("unsplash-access-key")).toBe("abc123"));
    expect(await screen.findByText("Clave guardada")).toBeInTheDocument();
    expect(input).toHaveValue("");
    expect(document.body.textContent).not.toContain("abc123");
    await user.click(screen.getByRole("button", { name: "Borrar clave" }));
    await waitFor(async () => expect(await kc.get("unsplash-access-key")).toBeNull());
    expect(await screen.findByText("Clave borrada")).toBeInTheDocument();
  });
  it("una clave con espacios dentro se rechaza", async () => {
    const { user } = await settings(runtime());
    await user.type(screen.getByLabelText("Clave de acceso de Unsplash"), "a b");
    await user.click(screen.getByRole("button", { name: "Guardar clave" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("sin espacios");
  });
  it("sin llavero avisa de que la clave solo se usará en esta sesión", async () => {
    const broken: Keychain = { get: async () => { throw new Error("x"); }, set: async () => { throw new Error("x"); }, delete: async () => {} };
    const { user } = await settings(runtime({ keychain: broken }));
    await user.type(screen.getByLabelText("Clave de acceso de Unsplash"), "abc");
    await user.click(screen.getByRole("button", { name: "Guardar clave" }));
    expect(await screen.findByText(/solo se usará en esta sesión/)).toBeInTheDocument();
  });
  it("si el cascarón no ofrece Unsplash, el panel no existe", async () => {
    await settings(undefined);
    expect(screen.queryByRole("region", { name: "Fotos de Unsplash" })).toBeNull();
  });
});

describe("aviso en la web (E-162)", () => {
  it("la web avisa de que la clave no se guarda al recargar", async () => {
    await settings(runtime({ platform: "web" }));
    expect(screen.getByText(/solo vive mientras la página está abierta/)).toBeInTheDocument();
  });
  it("el escritorio dice que se guarda en el llavero", async () => {
    await settings(runtime({ platform: "desktop" }));
    expect(screen.getByText("Se guarda en el llavero del sistema.")).toBeInTheDocument();
    expect(screen.queryByText(/solo vive mientras/)).toBeNull();
  });
});

describe("el cliente solo se crea con Unsplash activado (E-163, RF-9.4)", () => {
  const withProvider = (rt: UnsplashRuntime, prefs: MemoryPreferences) => renderHook(() => useUnsplash(), { wrapper: ({ children }: { children: ReactNode }) => <UnsplashProvider runtime={rt} preferences={prefs}>{children}</UnsplashProvider> });
  it("apagado, no se crea el cliente aunque haya clave", async () => {
    const createClient = vi.fn((o: { fetch: UnsplashFetch; key: string }) => new UnsplashClient(o));
    const kc = new MemoryKeychain(); await kc.set("unsplash-access-key", "abc");
    const { result } = withProvider(runtime({ keychain: kc, createClient }), new MemoryPreferences());
    expect(await result.current.getClient()).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });
  it("activado y con clave, se crea con el `fetch` del cascarón", async () => {
    const createClient = vi.fn((o: { fetch: UnsplashFetch; key: string }) => new UnsplashClient(o));
    const kc = new MemoryKeychain(); await kc.set("unsplash-access-key", "abc");
    const prefs = new MemoryPreferences(); prefs.set(UNSPLASH_PREFERENCE, "1");
    const rt = runtime({ keychain: kc, createClient });
    const { result } = withProvider(rt, prefs);
    expect(await result.current.getClient()).toBeInstanceOf(UnsplashClient);
    expect(createClient).toHaveBeenCalledWith({ fetch: rt.fetch, key: "abc" });
  });
  it("activado pero sin clave, tampoco", async () => {
    const createClient = vi.fn((o: { fetch: UnsplashFetch; key: string }) => new UnsplashClient(o));
    const prefs = new MemoryPreferences(); prefs.set(UNSPLASH_PREFERENCE, "1");
    const { result } = withProvider(runtime({ createClient }), prefs);
    expect(await result.current.getClient()).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });
  it("sin servicio del cascarón, no hay nada", async () => {
    const { result } = renderHook(() => useUnsplash(), { wrapper: ({ children }: { children: ReactNode }) => <UnsplashProvider runtime={undefined} preferences={new MemoryPreferences()}>{children}</UnsplashProvider> });
    expect(result.current.supported).toBe(false);
    expect(await result.current.getClient()).toBeNull();
  });
});
