export type Brand = { name: string; appId: string };

type Icon = { src: string; sizes: string; type: string; purpose?: string };
export type Manifest = {
  name: string; short_name: string; description: string; lang: string; display: "standalone"; start_url: string; scope: string;
  theme_color: string; background_color: string; icons: Icon[];
};

/** Manifiesto de la PWA. El nombre viene de la configuración de marca (único lugar donde vive). */
export function buildManifest(brand: Brand): Manifest {
  return {
    name: brand.name,
    short_name: brand.name,
    description: "Notas y bases de datos personales, locales y con respaldo en GitHub",
    lang: "es-MX",
    display: "standalone",
    start_url: "/",
    scope: "/",
    theme_color: "#2563eb",
    background_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
