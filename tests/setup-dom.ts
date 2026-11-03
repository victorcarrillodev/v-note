import { afterEach } from "vitest";

// Solo en entornos con DOM: matchers de jest-dom y limpieza entre pruebas.
if (typeof document !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => cleanup());
  // jsdom no trae estas APIs, que usan cmdk y Radix.
  const g = globalThis as unknown as Record<string, unknown>;
  g.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  (Element.prototype as unknown as Record<string, unknown>).scrollIntoView ??= () => {};
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  // Ancho de escritorio por defecto (jsdom mide 1 024 px, que por diseño ya es el modo de ventana estrecha).
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1400 });
  afterEach(() => { (window as unknown as { innerWidth: number }).innerWidth = 1400; });
}
