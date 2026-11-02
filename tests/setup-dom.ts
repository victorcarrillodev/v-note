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
}
