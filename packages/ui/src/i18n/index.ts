import i18next, { type i18n } from "i18next";
import { initReactI18next } from "react-i18next";
import { esMX } from "./es-MX";
import { en } from "./en";

export const DEFAULT_LANGUAGE = "es-MX";
export const resources = { "es-MX": { translation: esMX }, en: { translation: en } } as const;
export type Language = keyof typeof resources;

/** Crea una instancia de i18n (español de México por defecto; lo que falte en otro idioma cae al español). */
export async function createI18n(lng: string = DEFAULT_LANGUAGE): Promise<i18n> {
  const instance = i18next.createInstance();
  await instance.use(initReactI18next).init({
    // Copia profunda: i18next muta el objeto que recibe (p. ej. con addResource) y contaminaría otras instancias.
    resources: structuredClone(resources),
    lng,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return instance;
}
