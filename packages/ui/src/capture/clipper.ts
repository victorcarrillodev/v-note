export type WebClip = { title: string; url: string; selection: string };

/** Texto que se pega en la captura rápida: título, enlace y la selección como cita. */
export function clipMarkdown({ title, url, selection }: WebClip): string {
  const quoted = selection.split("\n").map((l) => l.trim()).filter((l) => l !== "").map((l) => `> ${l}`);
  return [title.trim() || url, url, ...quoted].join("\n");
}

/** Marcador del navegador: copia el recorte; no envía nada a ningún lado. */
export function bookmarkletCode(done: string): string {
  const source = `(function(){var u=location.href;var s=String(window.getSelection()).split("\\n").map(function(l){return l.trim()}).filter(Boolean).map(function(l){return "> "+l});var t=[document.title.trim()||u,u].concat(s).join("\\n");navigator.clipboard.writeText(t).then(function(){alert(${JSON.stringify(done)})},function(){prompt(${JSON.stringify(done)},t)})})()`;
  return `javascript:${encodeURIComponent(source)}`;
}
