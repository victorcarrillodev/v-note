import type { ReactElement } from "react";
import { type RenderResult } from "@testing-library/react";
import type { i18n as I18n } from "i18next";
export declare function renderWithI18n(ui: ReactElement, lng?: string): Promise<RenderResult & {
    i18n: I18n;
}>;
