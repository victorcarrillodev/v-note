import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../components/Button";
import { TextField } from "../components/fields";
import { Wordmark } from "./Logo";

/** Primera apertura (sin espacios de trabajo): logotipo, frase y las dos rutas de arranque (crear o restaurar). */
export function WelcomeScreen({ onCreate, onRestore }: { onCreate: (name: string) => void; onRestore?: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const submit = () => {
    if (name.trim() === "") { setError(t("welcome.nameRequired")); return; }
    setError(undefined);
    onCreate(name.trim());
  };
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-6 py-16 text-center">
      <Wordmark size={48} />
      <h1 className="text-[length:var(--text-h1-size)] font-bold leading-tight">{t("welcome.title")}</h1>
      <p className="text-[length:var(--text-reading-size)] text-[var(--c-text-muted)]">{t("welcome.tagline")}</p>
      <form className="flex w-full flex-col gap-3 text-left" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <TextField label={t("workspace.namePlaceholder")} ariaLabel={t("workspace.namePlaceholder")} value={name} onChange={setName} {...(error ? { error } : {})} />
        <Button type="submit" variant="primary">{t("workspace.create")}</Button>
      </form>
      {onRestore && <Button onClick={onRestore}>{t("app.restore")}</Button>}
    </div>
  );
}
