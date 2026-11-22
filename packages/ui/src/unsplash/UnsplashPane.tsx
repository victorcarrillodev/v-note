import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { UnsplashErrorKind, UnsplashPhoto } from "@vnote/core";
import { Button } from "../components/Button";
import { INPUT, MUTED } from "../components/formStyles";
import { useUnsplash } from "./UnsplashContext";

/** Temas para la selección inicial: al abrir la pestaña se carga uno al azar, para no mostrarla vacía. */
const RANDOM_TOPICS = ["nature", "landscape", "mountains", "ocean", "forest", "city", "architecture", "sky", "minimal", "texture", "abstract", "space"];

/**
 * Pestaña «Unsplash» del selector de portada (RF-2.4 a RF-2.6, CL-8, CL-9): búsqueda con miniaturas y «Más resultados».
 * Los errores se muestran aquí y no afectan a las demás pestañas. Si falta la clave o Unsplash la rechaza, se vuelve a pedir.
 */
export function UnsplashPane({ onPick, picking, pickError }: { onPick: (photo: UnsplashPhoto) => void; picking: boolean; pickError: UnsplashErrorKind | null }) {
  const { t } = useTranslation();
  const u = useUnsplash();
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [rejected, setRejected] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UnsplashErrorKind | null>(null);

  useEffect(() => { let alive = true; void u.keyStore?.get().then((k) => { if (alive) setHasKey(!!k); }); return () => { alive = false; }; }, [u.keyStore]);
  // Un error al elegir la foto por clave rechazada también vuelve a pedir la clave.
  useEffect(() => { if (pickError === "unauthorized") { setHasKey(false); setRejected(true); } }, [pickError]);

  const askAgain = async () => { await u.keyStore?.clear(); setHasKey(false); setRejected(true); setPhotos([]); };
  const run = async (q: string, nextPage: number) => {
    const client = await u.getClient();
    if (!client) { setHasKey(false); return; }
    setLoading(true); setError(null);
    const r = await client.search(q, nextPage);
    setLoading(false);
    if (!r.ok) { if (r.error.kind === "unauthorized") await askAgain(); else setError(r.error.kind); return; }
    setSearched(q); setPage(nextPage); setPages(r.value.totalPages);
    setPhotos((prev) => (nextPage === 1 ? r.value.results : [...prev, ...r.value.results]));
  };
  // Con clave guardada, la pestaña abre con fotos de un tema al azar ya cargadas.
  useEffect(() => {
    if (hasKey !== true) return;
    void run(RANDOM_TOPICS[Math.floor(Math.random() * RANDOM_TOPICS.length)]!, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasKey]);
  const submit = (e: FormEvent) => { e.preventDefault(); if (query.trim() !== "") void run(query.trim(), 1); };
  const saveKey = async (e: FormEvent) => {
    e.preventDefault();
    const r = await u.keyStore!.set(keyDraft);
    if (r.ok) { setKeyDraft(""); setHasKey(true); setRejected(false); }
  };

  if (hasKey === null) return null;
  if (!hasKey) {
    return (
      <form onSubmit={(e) => void saveKey(e)} className="flex flex-col gap-2">
        <p role={rejected ? "alert" : "status"} className="text-[length:var(--text-ui-small-size)]">{rejected ? t("unsplash.needKeyAgain") : t("unsplash.needKey")}</p>
        <label htmlFor="unsplash-pane-key" className="text-[length:var(--text-ui-small-size)] font-medium">{t("unsplash.keyLabel")}</label>
        <input id="unsplash-pane-key" type="password" autoComplete="off" spellCheck={false} value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} className={INPUT} />
        <Button type="submit" size="sm" className="self-start" disabled={keyDraft.trim() === ""}>{t("unsplash.saveKey")}</Button>
      </form>
    );
  }
  const shownError = pickError && pickError !== "unauthorized" ? pickError : error;
  return (
    <div className="flex flex-col gap-2">
      <form role="search" onSubmit={submit} className="flex gap-2">
        <input type="search" aria-label={t("unsplash.searchLabel")} value={query} onChange={(e) => setQuery(e.target.value)} className={INPUT} />
        <Button type="submit" size="sm" disabled={loading || query.trim() === ""}>{t("unsplash.searchButton")}</Button>
      </form>
      {shownError && <p role="alert" className="text-[length:var(--text-ui-small-size)] text-[var(--c-danger)]">{t(`unsplash.errors.${shownError}`)}</p>}
      {picking && <p role="status" className={MUTED}>{t("unsplash.downloading")}</p>}
      {searched !== "" && photos.length === 0 && !loading && !error && <p role="status" className={MUTED}>{t("unsplash.noResults")}</p>}
      {photos.length > 0 && (
        <ul aria-label={t("unsplash.results")} className="grid max-h-80 grid-cols-4 gap-1.5 overflow-y-auto">
          {photos.map((p) => (
            <li key={p.id}>
              <button type="button" disabled={picking} aria-label={t("unsplash.photoOf", { author: p.author })} title={t("unsplash.photoOf", { author: p.author })} onClick={() => onPick(p)}
                className="block aspect-[3/2] w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--c-border)] bg-[var(--c-raised)] hover:outline hover:outline-2 hover:outline-[var(--c-accent)] disabled:opacity-60">
                <img src={p.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {page > 0 && page < pages && <Button size="sm" className="self-start" disabled={loading} onClick={() => void run(searched, page + 1)}>{t("unsplash.more")}</Button>}
      <p className={MUTED}>{t("unsplash.attribution")}</p>
    </div>
  );
}
