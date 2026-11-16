// E-004/E-005: ¿se puede llamar a Unsplash desde la app? Sin clave real: un 401 legible prueba que CORS deja pasar.
const API = "https://api.unsplash.com/search/photos?query=mountain&per_page=1";
const IMG = "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=200&fm=jpg&q=85";
async function probe(f) { try { const r = await f(); return { ok: true, status: r.status, rateLimit: r.headers.get("X-RateLimit-Remaining") }; } catch (e) { return { ok: false, error: String(e) }; } }
async function main() {
  const out = { origin: location.origin };
  out.apiConCabeceraAuthorization = await probe(() => fetch(API, { headers: { Authorization: "Client-ID clave-invalida", "Accept-Version": "v1" } }));
  out.apiConClientIdEnLaUrl = await probe(() => fetch(API + "&client_id=clave-invalida", { headers: { "Accept-Version": "v1" } }));
  try { const b = await (await fetch(IMG)).blob(); out.imagen = { ok: true, type: b.type, bytes: b.size }; }
  catch (e) { out.imagen = { ok: false, error: String(e) }; }
  window.__result = out;
}
main().catch((e) => { window.__result = { error: String(e) }; });
