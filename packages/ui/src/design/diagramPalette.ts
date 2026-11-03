/**
 * Paleta de relleno de los diagramas. Los diagramas guardan el color como hexadecimal (formato de archivo ya existente, RNF-11),
 * así que el valor guardado no cambia; al DIBUJAR se traduce al token del tema para que se vea bien en claro y oscuro.
 */
export const DIAGRAM_COLORS: { id: string; hex: string; token: string }[] = [
  { id: "blue", hex: "#dbeafe", token: "var(--block-blue-bg)" }, { id: "green", hex: "#dcfce7", token: "var(--block-green-bg)" },
  { id: "yellow", hex: "#fef9c3", token: "var(--block-yellow-bg)" }, { id: "red", hex: "#fee2e2", token: "var(--block-red-bg)" },
  { id: "purple", hex: "#ede9fe", token: "var(--block-purple-bg)" }, { id: "orange", hex: "#ffedd5", token: "var(--block-orange-bg)" },
  { id: "gray", hex: "#e5e7eb", token: "var(--block-gray-bg)" }, { id: "white", hex: "#ffffff", token: "var(--c-card)" },
];

/** Relleno a dibujar para un color guardado: el token del tema si es de la paleta; si es otro valor (archivos antiguos), tal cual. */
export const fillFor = (stored: string): string => DIAGRAM_COLORS.find((c) => c.hex.toLowerCase() === stored.toLowerCase())?.token ?? stored;
