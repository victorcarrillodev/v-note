import { Component, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../components/Button";
import { InlineAlert } from "../components/InlineAlert";

/** Pantalla de error global: explica qué pasó y ofrece salidas; nunca deja la ventana en blanco (RF-11.8). */
export function ErrorScreen({ cause, onRetry, onBack }: { cause?: string; onRetry: () => void; onBack?: () => void }) {
  const { t } = useTranslation();
  return (
    <main className="mx-auto flex max-w-[var(--size-reading-width)] flex-col gap-4 p-8">
      <h1 className="text-[length:var(--text-h2-size)] font-semibold">{t("errorScreen.title")}</h1>
      <InlineAlert tone="error">{cause ?? t("errorScreen.generic")}</InlineAlert>
      <p className="text-[var(--c-text-muted)]">{t("errorScreen.safe")}</p>
      <div className="flex gap-2">
        <Button variant="primary" onClick={onRetry}>{t("errorScreen.retry")}</Button>
        {onBack && <Button onClick={onBack}>{t("errorScreen.back")}</Button>}
      </div>
    </main>
  );
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() {
    if (!this.state.failed) return this.props.children;
    return <ErrorScreen onRetry={() => this.setState({ failed: false })} />;
  }
}
