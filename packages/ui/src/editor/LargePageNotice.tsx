import { useTranslation } from "react-i18next";
import { InlineAlert } from "../components/InlineAlert";
import { isLargePage } from "@vnote/core";

export function LargePageNotice({ blocks }: { blocks: number }) {
  const { t } = useTranslation();
  if (!isLargePage(blocks)) return null;
  return <InlineAlert tone="info">{t("editor.largePage", { count: blocks, interpolation: { escapeValue: false } })}</InlineAlert>;
}
