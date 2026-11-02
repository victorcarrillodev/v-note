import { useTranslation } from "react-i18next";
import { isLargePage } from "@vnote/core";

export function LargePageNotice({ blocks }: { blocks: number }) {
  const { t } = useTranslation();
  if (!isLargePage(blocks)) return null;
  return <p role="status" className="mb-2 rounded border border-amber-500 bg-amber-50 p-2 text-sm text-amber-900">{t("editor.largePage", { count: blocks, interpolation: { escapeValue: false } })}</p>;
}
