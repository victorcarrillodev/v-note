import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { FreePhoto, FreePhotoPage, UnsplashErrorKind, UnsplashResult } from "@vnote/core";
import { Button } from "../components/Button";
import { INPUT, MUTED } from "../components/formStyles";
import { useUnsplash } from "./UnsplashContext";

type Mode = { kind: "commons"; query: string } | { kind: "picsum" };

/**
 * Pestaña «Fotos libres» del selector de portada: Wikimedia Commons (búsqueda) y Picsum (galería), sin clave.
 * No sale ninguna petición hasta que la persona busca o abre la galería.
 */
export function FreePhotosPane({ onPick, picking, pickError }: { onPick: (photo: FreePhoto) => void; picking: boolean; pickError: UnsplashErrorKind | null }) {
  const { t } = useTranslation();
  const u = useUnsplash();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode | null>(null);
  const [photos, setPhotos] = useState<FreePhoto[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UnsplashErrorKind | null>(null);

  const run = async (m: Mode, nextPage: number) => {
    const client = u.getFreeClient();
    if (!client) return;
    setLoading(true); setError(null);
    const r: UnsplashResult<FreePhotoPage> = m.kind === "commons" ? await client.searchCommons(m.query, nextPage) : await client.listPicsum(nextPage);
    setLoading(false);
    if (!r.ok) { setError(r.error.kind); return; }
    setMode(m); setPage(nextPage); setHasMore(r.value.hasMore);
    setPhotos((prev) => (nextPage === 1 ? r.value.results : [...prev, ...r.value.results]));
  };
  const submit = (e: FormEvent) => { e.preventDefault(); if (query.trim() !== "") void run({ kind: "commons", query: query.trim() }, 1); };
  const shownError = pickError ?? error;

  return (
    <div className="flex flex-col gap-2">
      <form role="search" onSubmit={submit} className="flex gap-2">
        <input type="search" aria-label={t("freePhotos.searchLabel")} value={query} onChange={(e) => setQuery(e.target.value)} className={INPUT} />
        <Button type="submit" size="sm" disabled={loading || query.trim() === ""}>{t("freePhotos.searchButton")}</Button>
      </form>
      <Button size="sm" className="self-start" disabled={loading} onClick={() => void run({ kind: "picsum" }, 1)}>{t("freePhotos.gallery")}</Button>
      {shownError && <p role="alert" className="text-[length:var(--text-ui-small-size)] text-[var(--c-danger)]">{t(`freePhotos.errors.${shownError}`)}</p>}
      {picking && <p role="status" className={MUTED}>{t("freePhotos.downloading")}</p>}
      {mode && photos.length === 0 && !loading && !error && <p role="status" className={MUTED}>{t("freePhotos.noResults")}</p>}
      {photos.length > 0 && (
        <ul aria-label={t("freePhotos.results")} className="grid max-h-64 grid-cols-3 gap-1.5 overflow-y-auto">
          {photos.map((p) => (
            <li key={p.id}>
              <button type="button" disabled={picking} aria-label={t("freePhotos.photoOf", { author: p.author })} title={t("freePhotos.photoOf", { author: p.author })} onClick={() => onPick(p)}
                className="block aspect-[3/2] w-full overflow-hidden rounded-[var(--radius-md)] bg-[var(--c-raised)] hover:outline hover:outline-2 hover:outline-[var(--c-accent)] disabled:opacity-60">
                <img src={p.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {mode && hasMore && <Button size="sm" className="self-start" disabled={loading} onClick={() => void run(mode, page + 1)}>{t("freePhotos.more")}</Button>}
      <p className={MUTED}>{t("freePhotos.privacy")}</p>
      <p className={MUTED}>{t("freePhotos.attribution")}</p>
    </div>
  );
}
