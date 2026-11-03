import { colors } from "../../packages/ui/src/design/tokens";
/** Manifiesto de la PWA. El nombre viene de la configuración de marca (único lugar donde vive). */
export function buildManifest(brand) {
    return {
        name: brand.name,
        short_name: brand.name,
        description: "Notas y bases de datos personales, locales y con respaldo en GitHub",
        lang: "es-MX",
        display: "standalone",
        start_url: "/",
        scope: "/",
        theme_color: colors.accent.light,
        background_color: colors.canvas.light,
        icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
    };
}
