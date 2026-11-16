// E-001/E-002: decodificar y codificar a JPEG 0,85 dentro de un worker con OffscreenCanvas.
onmessage = async (e) => {
  const t0 = performance.now();
  if (typeof OffscreenCanvas === "undefined") { postMessage({ offscreenInWorker: false }); return; }
  try {
    const bmp = await createImageBitmap(e.data.blob, { imageOrientation: "from-image" });
    const decodeMs = performance.now() - t0;
    let W = bmp.width, H = bmp.height;
    if (W > 2560) { H = Math.round(H * 2560 / W); W = 2560; }
    const c = new OffscreenCanvas(W, H);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H); ctx.drawImage(bmp, 0, 0, W, H);
    const out = await c.convertToBlob({ type: "image/jpeg", quality: 0.85 });
    postMessage({ offscreenInWorker: true, decodeMs: Math.round(decodeMs), totalMs: Math.round(performance.now() - t0), outType: out.type, outBytes: out.size, w: W, h: H });
  } catch (err) { postMessage({ offscreenInWorker: true, error: String(err) }); }
};
