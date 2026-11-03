export type Brand = {
    name: string;
    appId: string;
};
type Icon = {
    src: string;
    sizes: string;
    type: string;
    purpose?: string;
};
export type Manifest = {
    name: string;
    short_name: string;
    description: string;
    lang: string;
    display: "standalone";
    start_url: string;
    scope: string;
    theme_color: string;
    background_color: string;
    icons: Icon[];
};
/** Manifiesto de la PWA. El nombre viene de la configuración de marca (único lugar donde vive). */
export declare function buildManifest(brand: Brand): Manifest;
export {};
