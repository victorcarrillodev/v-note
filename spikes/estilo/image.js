// Página común a WebKitGTK y Chrome. Deja el resultado en window.__result.
const now = () => performance.now();
const fit = (w, h) => (w <= 2560 ? [w, h] : [2560, Math.round(h * 2560 / w)]);
async function main() {
  const out = { ua: navigator.userAgent, offscreenInMain: typeof OffscreenCanvas !== "undefined" };
  const blob = await (await fetch(new URLSearchParams(location.search).get("src") ?? "big.png")).blob();
  out.inputBytes = blob.size;
  // E-001/E-002 (worker) y respuesta del hilo principal mientras tanto
  let maxGap = 0, last = now();
  const iv = setInterval(() => { const n = now(); maxGap = Math.max(maxGap, n - last); last = n; }, 10);
  const w = new Worker("worker.js");
  const r = await new Promise((res) => { w.onmessage = (e) => res(e.data); w.onerror = (e) => res({ error: String(e.message) }); w.postMessage({ blob }); });
  clearInterval(iv);
  out.worker = { ...r, mainThreadMaxGapMs: Math.round(maxGap) };
  // Alternativa en el hilo principal
  const t0 = now();
  const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
  const decodeMs = now() - t0;
  const [W, H] = fit(bmp.width, bmp.height);
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H); ctx.drawImage(bmp, 0, 0, W, H);
  const jpg = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.85));
  out.main = { decodeMs: Math.round(decodeMs), totalMs: Math.round(now() - t0), outType: jpg && jpg.type, outBytes: jpg && jpg.size, w: W, h: H };
  // Motivo de DP-4: ¿codifica WebP?
  const webp = await new Promise((res) => c.toBlob(res, "image/webp", 0.85));
  out.webpEncodes = !!webp && webp.type === "image/webp";
  // E-003: orientación EXIF
  const eb = await (await fetch("exif6.jpg")).blob();
  const a = await createImageBitmap(eb, { imageOrientation: "from-image" });
  out.exif = { fromImage: `${a.width}x${a.height}`, esperado: "200x400" };
  window.__result = out;
}
main().catch((e) => { window.__result = { error: String(e) }; });
