// Entrada de DESARROLLO del catálogo de componentes (RF-17.2, RF-17.3): no forma parte del build de producción.
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { createI18n } from "@vnote/ui";
import { Catalog } from "../../../packages/ui/src/catalog/Catalog";
import "./styles.css";

void createI18n().then((i18n) => createRoot(document.getElementById("root")!).render(<I18nextProvider i18n={i18n}><Catalog /></I18nextProvider>));
