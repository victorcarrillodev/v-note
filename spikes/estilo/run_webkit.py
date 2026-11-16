"""Carga index.html en WebKitGTK (la misma webkit2gtk-4.1 que usa Tauri en Linux) e imprime el resultado."""
import json, os, sys, threading, functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import gi
gi.require_version("Gtk", "3.0"); gi.require_version("WebKit2", "4.1")
from gi.repository import Gtk, GLib, Gio, WebKit2

here = os.path.dirname(os.path.abspath(__file__))
handler = functools.partial(SimpleHTTPRequestHandler, directory=here)
handler.log_message = lambda *a: None
srv = ThreadingHTTPServer(("127.0.0.1", 0), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
url = f"http://127.0.0.1:{srv.server_address[1]}/" + (sys.argv[1] if len(sys.argv) > 1 else "index.html")

win = Gtk.Window(title="spike estilo (se cierra sola)"); win.set_default_size(1280, 900)
view = WebKit2.WebView()
if os.environ.get("SCHEME") == "tauri":
    # Igual que Tauri en Linux: la app se sirve desde tauri://localhost (esquema propio, seguro y con CORS)
    ctx = view.get_context()
    def serve(req):
        path = req.get_path().lstrip("/") or "index.html"
        full = os.path.join(here, path)
        if not os.path.isfile(full):
            req.finish_error(GLib.Error.new_literal(Gio.io_error_quark(), "no existe", Gio.IOErrorEnum.NOT_FOUND)); return
        data = open(full, "rb").read()
        mime = {".html": "text/html", ".js": "application/javascript", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg"}.get(os.path.splitext(path)[1], "application/octet-stream")
        req.finish(Gio.MemoryInputStream.new_from_bytes(GLib.Bytes.new(data)), len(data), mime)
    ctx.register_uri_scheme("tauri", serve)
    sm = ctx.get_security_manager(); sm.register_uri_scheme_as_secure("tauri"); sm.register_uri_scheme_as_cors_enabled("tauri")
    url = "tauri://localhost/" + (sys.argv[1] if len(sys.argv) > 1 else "index.html")
win.add(view); win.show_all()
view.load_uri(url)
state = {"t": 0}
def done(v, res):
    try:
        val = view.evaluate_javascript_finish(res).to_string()
    except Exception as e:
        val = json.dumps({"error": str(e)})
    if val not in ("null", "undefined"):
        print(val); Gtk.main_quit()
def poll():
    state["t"] += 1
    if state["t"] > 600:
        print(json.dumps({"error": "timeout"})); Gtk.main_quit(); return False
    view.evaluate_javascript("JSON.stringify(window.__result ?? null)", -1, None, None, None, done)
    return True
GLib.timeout_add(500, poll)
Gtk.main()
