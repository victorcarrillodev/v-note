import { jsx as _jsx } from "react/jsx-runtime";
import { render } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { createI18n } from "../src/i18n";
export async function renderWithI18n(ui, lng) {
    const i18n = await createI18n(lng);
    return { i18n, ...render(_jsx(I18nextProvider, { i18n: i18n, children: ui })) };
}
