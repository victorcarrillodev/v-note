import { useTranslation } from "react-i18next";
import { Dropdown } from "../components/ChoiceMenu";
import { INPUT } from "../components/formStyles";
import type { PreferenceStore } from "../theme/theme";

/** UI panel for selecting backup destination and enabling auto‑backup on idle. */
export function BackupPanel({ preferences }: { preferences: PreferenceStore }) {
  const { t } = useTranslation();

  const kind = preferences.get("backup_destination_kind") as string | undefined;
  const auto = preferences.get("backup_auto_idle") as boolean | undefined;

  const handleKind = (e: React.ChangeEvent<HTMLSelectElement>) => {
    preferences.set("backup_destination_kind", e.target.value);
  };
  const handleAuto = (e: React.ChangeEvent<HTMLSelectElement>) => {
    preferences.set("backup_auto_idle", e.target.value === "true");
  };

  return (
    <section className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-[var(--c-border)] px-4 py-3 last:border-b-0">
      <span className="text-[var(--c-text-muted)]">{t("settings.backupDestination")}</span>
      <Dropdown
        aria-label={t("settings.backupDestination")}
        value={kind ?? "local-folder"}
        onChange={handleKind}
        className={`${INPUT} max-w-56`}
      >
        <option value="local-folder">{t("settings.backupLocalFolder")}</option>
        <option value="google-drive">{t("settings.backupGoogleDrive")}</option>
        <option value="dropbox">{t("settings.backupDropbox")}</option>
        <option value="github">{t("settings.backupGitHub")}</option>
      </Dropdown>
      <span className="text-[var(--c-text-muted)] ml-4">{t("settings.backupAutoIdle")}</span>
      <Dropdown
        aria-label={t("settings.backupAutoIdle")}
        value={auto ? "true" : "false"}
        onChange={handleAuto}
        className={`${INPUT} max-w-32`}
      >
        <option value="true">{t("settings.enabled")}</option>
        <option value="false">{t("settings.disabled")}</option>
      </Dropdown>
    </section>
  );
}
