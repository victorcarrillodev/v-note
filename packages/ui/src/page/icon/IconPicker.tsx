import { useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Popover } from "../../components/Popover";
import { Tabs } from "../../components/Tabs";
import { Button } from "../../components/Button";
import { EMOJIS, randomEmoji, searchEmojis, type EmojiEntry } from "./emojiData";
import { loadRecentEmojis, rememberEmoji } from "./recentEmojis";
import type { IconImportError } from "./importIconImage";

const CELL = "inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-xl leading-none hover:bg-[var(--c-raised)] focus-visible:bg-[var(--c-raised)] [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11";
const ERROR_KEY: Record<IconImportError, string> = { empty: "cover.errEmpty", tooLarge: "cover.errTooLarge", unsupported: "cover.errUnsupported", corrupt: "cover.errCorrupt", save: "cover.errSave" };

/**
 * Selector de ícono de página, como el de Notion: pestañas «Emoji» (búsqueda, recientes, grupos y uno al azar) y «Subir» (imagen propia),
 * y «Quitar» siempre a la vista. Cada elección cierra el selector y escribe una sola entrada del historial.
 */
export function IconPicker({ trigger, open, onOpenChange, hasIcon, canUpload, uploading = false, error, onEmoji, onFile, onRemove }: {
  trigger: ReactNode; open: boolean; onOpenChange: (o: boolean) => void; hasIcon: boolean;
  canUpload: boolean; uploading?: boolean; error: IconImportError | null;
  onEmoji: (emoji: string) => void; onFile: (file: File) => void; onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"emoji" | "upload">("emoji");
  const tabs = [{ value: "emoji", label: t("iconPicker.tabEmoji") }, ...(canUpload ? [{ value: "upload", label: t("iconPicker.tabUpload") }] : [])];
  const pick = (char: string) => { rememberEmoji(char); onEmoji(char); onOpenChange(false); };
  return (
    <Popover wide open={open} onOpenChange={onOpenChange} align="start" trigger={trigger}>
      <div role="group" aria-label={t("iconPicker.title")} className="flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <Tabs label={t("iconPicker.tabs")} value={tab} onChange={(v) => setTab(v as typeof tab)} tabs={tabs} />
          {hasIcon && <Button variant="ghost" size="sm" onClick={() => { onRemove(); onOpenChange(false); }}>{t("iconPicker.remove")}</Button>}
        </div>
        {tab === "emoji" && <EmojiPane onPick={pick} />}
        {tab === "upload" && canUpload && <UploadPane error={error} uploading={uploading} onFile={onFile} />}
      </div>
    </Popover>
  );
}

function EmojiPane({ onPick }: { onPick: (emoji: string) => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const recent = useMemo(() => loadRecentEmojis(), []);
  const found = query.trim() ? searchEmojis(query) : null;
  const grid = (items: { char: string; words: string }[]) => items.map((e) => (
    <button key={e.char} type="button" className={CELL} aria-label={`${e.char} ${e.words.split(" ")[0]}`} title={e.words.split(" ")[0] ?? ""} onClick={() => onPick(e.char)}>{e.char}</button>
  ));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <input autoFocus type="search" aria-label={t("iconPicker.search")} placeholder={t("iconPicker.search")} value={query} onChange={(e) => setQuery(e.target.value)}
          className="h-8 min-w-0 flex-1 rounded-[var(--radius-md)] bg-[var(--c-raised)] px-2 text-[length:var(--text-ui-size)]" />
        <Button size="sm" variant="ghost" aria-label={t("iconPicker.random")} title={t("iconPicker.random")} onClick={() => onPick(randomEmoji())}>🎲</Button>
      </div>
      <div className="max-h-72 overflow-y-auto pr-1">
        {found ? (
          found.length === 0 ? <p role="status" className="p-2 text-[length:var(--text-ui-small-size)] text-[var(--c-text-muted)]">{t("iconPicker.noResults")}</p>
            : <div className="flex flex-wrap gap-0.5">{grid(found)}</div>
        ) : (
          <>
            {recent.length > 0 && <Section title={t("iconPicker.recent")}>{grid(recent.map((char): EmojiEntry => ({ char, words: "" })))}</Section>}
            {EMOJIS.map((g) => <Section key={g.id} title={t(`iconPicker.groups.${g.id}`)}>{grid(g.entries)}</Section>)}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-2">
      <h3 className="mb-1 text-[length:var(--text-note-size)] font-semibold uppercase tracking-wide text-[var(--c-text-muted)]">{title}</h3>
      <div className="flex flex-wrap gap-0.5">{children}</div>
    </section>
  );
}

function UploadPane({ error, uploading, onFile }: { error: IconImportError | null; uploading: boolean; onFile: (f: File) => void }) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-2 py-1">
      <Button disabled={uploading} onClick={() => input.current?.click()}>{t("iconPicker.uploadPick")}</Button>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" tabIndex={-1} aria-label={t("iconPicker.uploadPick")} className="sr-only"
        onChange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (f) onFile(f); }} />
      <p className="text-[length:var(--text-note-size)] text-[var(--c-text-muted)]">{t("iconPicker.uploadHint")}</p>
      {uploading && <p role="status" className="text-[length:var(--text-ui-small-size)]">{t("iconPicker.uploading")}</p>}
      {error && <p role="alert" className="text-[length:var(--text-ui-small-size)] text-[var(--c-danger)]">{t(ERROR_KEY[error])}</p>}
    </div>
  );
}
