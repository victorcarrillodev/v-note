use std::{fs, io::Write, path::PathBuf, time::{Duration, SystemTime, UNIX_EPOCH}};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use tauri_plugin_notification::NotificationExt;

fn out_dir() -> PathBuf {
    let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../out");
    fs::create_dir_all(&dir).ok();
    dir
}

fn append_log(name: &str, line: &str) {
    if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(out_dir().join(name)) {
        let _ = writeln!(f, "{line}");
    }
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

#[tauri::command]
fn heartbeat(user_agent: String) -> Result<(), String> {
    let body = serde_json::json!({ "ts": now_ms(), "userAgent": user_agent });
    fs::write(out_dir().join("heartbeat.json"), body.to_string()).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_doc(data: Vec<u8>) -> Result<(), String> {
    let tmp = out_dir().join("doc.bin.tmp");
    fs::write(&tmp, data).map_err(|e| e.to_string())?;
    fs::rename(tmp, out_dir().join("doc.bin")).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_doc() -> Option<Vec<u8>> {
    fs::read(out_dir().join("doc.bin")).ok()
}

#[tauri::command]
fn quarantine_doc() -> Result<(), String> {
    let from = out_dir().join("doc.bin");
    if from.exists() {
        fs::rename(from, out_dir().join("doc.bin.corrupt")).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn hide_main(app: AppHandle) -> Result<(), String> {
    app.get_webview_window("main").ok_or("sin ventana")?.hide().map_err(|e| e.to_string())
}

#[tauri::command]
fn show_main(app: AppHandle) -> Result<(), String> {
    let w = app.get_webview_window("main").ok_or("sin ventana")?;
    w.show().map_err(|e| e.to_string())
}

#[tauri::command]
fn tray_status(app: AppHandle) -> bool {
    app.tray_by_id("main").is_some()
}

#[tauri::command]
fn notify(app: AppHandle, title: String, body: String) -> Result<(), String> {
    app.notification().builder().title(title).body(body).show().map_err(|e| e.to_string())
}

#[tauri::command]
fn open_reminder(app: AppHandle) -> Result<(), String> {
    WebviewWindowBuilder::new(&app, "reminder", WebviewUrl::App("index.html".into()))
        .title("Recordatorio")
        .inner_size(320.0, 160.0)
        .always_on_top(true)
        .focused(false)
        .build()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn window_count(app: AppHandle) -> usize {
    app.webview_windows().len()
}

#[tauri::command]
fn register_shortcut(app: AppHandle) -> Result<bool, String> {
    app.global_shortcut().register("CommandOrControl+Alt+N").map_err(|e| e.to_string())?;
    Ok(true)
}

fn keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new("vnote-spike", "github-token").map_err(|e| e.to_string())
}
#[tauri::command]
fn keyring_set(value: String) -> Result<(), String> {
    keyring_entry()?.set_password(&value).map_err(|e| e.to_string())
}
#[tauri::command]
fn keyring_get() -> Result<String, String> {
    keyring_entry()?.get_password().map_err(|e| e.to_string())
}
#[tauri::command]
fn keyring_delete() -> Result<(), String> {
    keyring_entry()?.delete_credential().map_err(|e| e.to_string())
}

/// Plan B de RF-24: abre el diálogo de impresión del sistema (permite "Guardar como PDF").
/// La impresión silenciosa a archivo con PrintOperation falla: la impresora virtual "Print to File"
/// está localizada por idioma y no se encuentra por nombre (ver spikes/RESULTS.md, T-023).
#[tauri::command]
fn print_pdf(app: AppHandle) -> Result<(), String> {
    app.get_webview_window("main").ok_or("sin ventana")?.print().map_err(|e| e.to_string())
}

fn show_main_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            append_log("quick.log", &argv.join(" "));
            if argv.iter().any(|a| a == "--quick-capture") {
                let _ = app.emit("quick-capture", ());
            }
            show_main_window(app);
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .on_window_event(|window, event| {
            // Cerrar la ventana principal la oculta a la bandeja.
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(|app| {
            let abrir = MenuItem::with_id(app, "open", "Abrir", true, None::<&str>)?;
            let captura = MenuItem::with_id(app, "capture", "Captura rápida", true, None::<&str>)?;
            let salir = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&abrir, &captura, &salir])?;
            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().expect("sin icono").clone())
                .menu(&menu)
                .on_menu_event(|app, ev| match ev.id.as_ref() {
                    "open" => show_main_window(app),
                    "capture" => {
                        let _ = app.emit("quick-capture", ());
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            let tick_ms: u64 = std::env::var("SPIKE_TICK_MS").ok().and_then(|v| v.parse().ok()).unwrap_or(60_000);
            let handle = app.handle().clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(Duration::from_millis(tick_ms));
                let _ = handle.emit("tick", now_ms());
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            heartbeat, save_doc, load_doc, quarantine_doc, hide_main, show_main, tray_status, notify,
            open_reminder, window_count, register_shortcut, keyring_set, keyring_get, keyring_delete, print_pdf
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar tauri");
}
