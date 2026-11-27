use std::{collections::HashMap, sync::{Arc, Mutex, atomic::{AtomicU32, Ordering}}};
use percent_encoding::percent_decode_str;
use tauri::{ipc::{InvokeBody, Request, Response}, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use vnote_db::{fsutil, AssetDir, Database};
use std::path::PathBuf;
use base64::Engine as _;

/// Conexiones abiertas, por identificador. Una conexión por espacio de trabajo (plan D-1).
#[derive(Default)]
struct Dbs {
    next: AtomicU32,
    map: Mutex<HashMap<u32, Arc<Database>>>,
}

impl Dbs {
    fn get(&self, handle: u32) -> Result<Arc<Database>, String> {
        self.map.lock().unwrap().get(&handle).cloned().ok_or_else(|| "base de datos no abierta".to_string())
    }
}

#[tauri::command]
fn db_open(dbs: State<Dbs>, path: String) -> Result<u32, String> {
    let db = Database::open(&path)?;
    let handle = dbs.next.fetch_add(1, Ordering::SeqCst) + 1;
    dbs.map.lock().unwrap().insert(handle, Arc::new(db));
    Ok(handle)
}

#[tauri::command]
fn db_exec(dbs: State<Dbs>, handle: u32, sql: String, params: Vec<serde_json::Value>) -> Result<(), String> {
    dbs.get(handle)?.exec(&sql, &params)
}

#[tauri::command]
fn db_query(dbs: State<Dbs>, handle: u32, sql: String, params: Vec<serde_json::Value>) -> Result<Vec<serde_json::Value>, String> {
    dbs.get(handle)?.query(&sql, &params)
}

#[tauri::command]
fn db_begin(dbs: State<Dbs>, handle: u32) -> Result<(), String> { dbs.get(handle)?.begin() }
#[tauri::command]
fn db_commit(dbs: State<Dbs>, handle: u32) -> Result<(), String> { dbs.get(handle)?.commit() }
#[tauri::command]
fn db_rollback(dbs: State<Dbs>, handle: u32) -> Result<(), String> { dbs.get(handle)?.rollback() }

#[tauri::command]
fn db_close(dbs: State<Dbs>, handle: u32) -> Result<(), String> {
    dbs.map.lock().unwrap().remove(&handle);
    Ok(())
}

// ---- Adjuntos: archivos direccionados por hash; los bytes viajan en crudo (sin JSON) ----

#[derive(serde::Serialize)]
struct AssetInfo {
    hash: String,
    size: u64,
}

#[tauri::command]
fn asset_put(request: Request) -> Result<AssetInfo, String> {
    let root = request.headers().get("x-root").and_then(|v| v.to_str().ok()).ok_or("falta la carpeta de adjuntos")?;
    let root = percent_decode_str(root).decode_utf8().map_err(|e| e.to_string())?.to_string();
    let InvokeBody::Raw(data) = request.body() else { return Err("se esperaban bytes en crudo".into()) };
    let (hash, size) = AssetDir::new(root.into()).put(data)?;
    Ok(AssetInfo { hash, size })
}

#[tauri::command]
fn asset_get(root: String, hash: String) -> Result<Response, String> {
    match AssetDir::new(root.into()).get(&hash)? {
        Some(bytes) => Ok(Response::new(bytes)),
        None => Err("NOT_FOUND".into()),
    }
}

#[tauri::command]
fn asset_has(root: String, hash: String) -> Result<bool, String> { AssetDir::new(root.into()).has(&hash) }
#[tauri::command]
fn asset_delete(root: String, hash: String) -> Result<(), String> { AssetDir::new(root.into()).delete(&hash) }
#[tauri::command]
fn asset_list(root: String) -> Result<Vec<String>, String> { AssetDir::new(root.into()).list() }

// ---- Configuración y carpetas de la aplicación ----

mod reminder;
mod ticker;

fn dir_from(app: &tauri::AppHandle, env: &str, default: Result<PathBuf, tauri::Error>) -> Result<PathBuf, String> {
    // La variable de entorno permite aislar los datos en pruebas automáticas sin tocar los de la persona usuaria.
    match std::env::var(env) {
        Ok(v) if !v.is_empty() => Ok(PathBuf::from(v)),
        _ => default.map_err(|e| e.to_string()),
    }
    .map(|p| { let _ = app; p })
}

fn current_os() -> vnote_db::fsutil::Os {
    if cfg!(target_os = "windows") { vnote_db::fsutil::Os::Windows }
    else if cfg!(target_os = "macos") { vnote_db::fsutil::Os::MacOs }
    else { vnote_db::fsutil::Os::Linux }
}

fn data_dir_env() -> vnote_db::fsutil::DataDirEnv {
    let var = |k: &str| std::env::var_os(k).filter(|v| !v.is_empty()).map(PathBuf::from);
    vnote_db::fsutil::DataDirEnv {
        home: var(if cfg!(target_os = "windows") { "USERPROFILE" } else { "HOME" }),
        xdg_data_home: var("XDG_DATA_HOME"),
        appdata: var("APPDATA"),
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AppDirs {
    data_dir: String,
}

#[tauri::command]
fn app_dirs(app: tauri::AppHandle) -> Result<AppDirs, String> {
    let standard = vnote_db::fsutil::standard_data_dir(current_os(), &data_dir_env(), &app.config().identifier);
    let default = match standard {
        Some(p) => Ok(p),
        None => app.path().app_data_dir(),
    };
    let dir = dir_from(&app, "VNOTE_DATA_DIR", default)?;
    Ok(AppDirs { data_dir: dir.to_string_lossy().to_string() })
}

#[tauri::command]
fn config_read(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let dir = dir_from(&app, "VNOTE_CONFIG_DIR", app.path().app_config_dir())?;
    fsutil::read_text(&dir.join("config.json"))
}

#[tauri::command]
fn config_write(app: tauri::AppHandle, text: String) -> Result<(), String> {
    let dir = dir_from(&app, "VNOTE_CONFIG_DIR", app.path().app_config_dir())?;
    fsutil::atomic_write(&dir.join("config.json"), &text)
}

#[tauri::command]
fn path_exists(path: String) -> bool { std::path::Path::new(&path).exists() }

/// Abre una carpeta en el explorador de archivos del sistema (sin dependencias adicionales). Solo acepta carpetas existentes.
#[tauri::command]
fn reveal_path(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if !p.is_dir() { return Err("La carpeta no existe".into()); }
    #[cfg(target_os = "linux")]
    let cmd = "xdg-open";
    #[cfg(target_os = "macos")]
    let cmd = "open";
    #[cfg(target_os = "windows")]
    let cmd = "explorer";
    std::process::Command::new(cmd).arg(p).spawn().map(|_| ()).map_err(|e| e.to_string())
}

/// Guarda una exportación HTML en la carpeta de Descargas sin sobrescribir nada y devuelve la ruta final.
#[tauri::command]
fn export_save(app: tauri::AppHandle, file_name: String, content: String) -> Result<String, String> {
    let dir = dir_from(&app, "VNOTE_EXPORT_DIR", app.path().download_dir())?;
    vnote_db::fsutil::write_new_unique(&dir, &file_name, &content).map(|p| p.to_string_lossy().to_string())
}

/// Exportar a PDF (RF-24, T-409): carga el documento exportado en una ventana propia y abre el diálogo de impresión del sistema («Guardar como PDF»).
#[tauri::command]
fn print_html(app: tauri::AppHandle, html: String) -> Result<(), String> {
    use tauri::webview::PageLoadEvent;
    let path = std::env::temp_dir().join(format!("vnote-print-{}.html", std::process::id()));
    std::fs::write(&path, html).map_err(|e| e.to_string())?;
    let url = tauri::Url::from_file_path(&path).map_err(|_| "ruta de impresión no válida".to_string())?;
    if let Some(old) = app.get_webview_window("print") { let _ = old.close(); }
    WebviewWindowBuilder::new(&app, "print", WebviewUrl::External(url))
        .title("Documento exportado")
        .inner_size(800.0, 600.0)
        .on_page_load(move |webview, payload| {
            if !matches!(payload.event(), PageLoadEvent::Finished) { return; }
            let wv = webview.clone();
            let file = path.clone();
            std::thread::spawn(move || {
                let _ = wv.print();
                let _ = wv.close();
                let _ = std::fs::remove_file(file);
            });
        })
        .build()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

fn open_in_browser(url: &str) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    let cmd = "xdg-open";
    #[cfg(target_os = "macos")]
    let cmd = "open";
    #[cfg(target_os = "windows")]
    let cmd = "explorer";
    std::process::Command::new(cmd).arg(url).spawn().map(|_| ()).map_err(|e| e.to_string())
}

/// Abre en el navegador la página de descarga de una versión nueva. Solo acepta páginas de GitHub Releases.
#[tauri::command]
fn open_release_url(url: String) -> Result<(), String> {
    if !vnote_db::fsutil::is_release_url(&url) { return Err("Dirección no permitida".into()); }
    open_in_browser(&url)
}

/// Abre en el navegador una dirección de Unsplash (obtener la clave, créditos de las fotos). Nada más.
#[tauri::command]
fn open_unsplash_url(url: String) -> Result<(), String> {
    if !vnote_db::fsutil::is_unsplash_url(&url) { return Err("Dirección no permitida".into()); }
    open_in_browser(&url)
}

#[tauri::command]
fn workspace_remove(dir: String) -> Result<(), String> { fsutil::remove_workspace_files(std::path::Path::new(&dir)) }

// ---- Llavero del sistema: el token de GitHub nunca se guarda en archivos ----

fn keychain_entry(service: &str, account: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(service, account).map_err(|e| e.to_string())
}

#[tauri::command]
fn keychain_set(service: String, account: String, secret: String) -> Result<(), String> {
    keychain_entry(&service, &account)?.set_password(&secret).map_err(|e| e.to_string())
}

#[tauri::command]
fn keychain_get(service: String, account: String) -> Result<Option<String>, String> {
    match keychain_entry(&service, &account)?.get_password() {
        Ok(p) => Ok(Some(p)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn keychain_delete(service: String, account: String) -> Result<(), String> {
    match keychain_entry(&service, &account)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}


// ---- Respaldo en carpeta local (acotado a la carpeta elegida) y retorno de OAuth por bucle local ----

fn b64() -> base64::engine::GeneralPurpose { base64::engine::general_purpose::STANDARD }

/// Única carpeta de respaldo autorizada: la que la persona eligió en el diálogo nativo (se recuerda en la configuración de la app).
#[derive(Default)]
struct BackupFolder(std::sync::Mutex<Option<String>>);

fn backup_folder_file(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_config_dir().map_err(|e| e.to_string())?.join("backup-folder.txt"))
}

fn check_root(state: &State<BackupFolder>, root: &str) -> Result<(), String> {
    if vnote_db::backup_fs::is_authorized_root(state.0.lock().unwrap().as_deref(), root) { Ok(()) } else { Err("Carpeta de respaldo no autorizada".into()) }
}

/// Diálogo nativo para elegir la carpeta de respaldo; solo esa carpeta queda autorizada para los comandos `folder_*`.
#[tauri::command]
async fn pick_backup_folder(app: tauri::AppHandle, state: State<'_, BackupFolder>) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let picked = tauri::async_runtime::spawn_blocking({ let app = app.clone(); move || app.dialog().file().blocking_pick_folder() }).await.map_err(|e| e.to_string())?;
    let Some(path) = picked else { return Ok(None) };
    let path = path.into_path().map_err(|e| e.to_string())?.to_string_lossy().to_string();
    let file = backup_folder_file(&app)?;
    vnote_db::fsutil::atomic_write(&file, &path)?;
    *state.0.lock().unwrap() = Some(path.clone());
    Ok(Some(path))
}

/// Al abrir la app: vuelve a autorizar la carpeta que la persona eligió antes (si `path` coincide con la guardada).
#[tauri::command]
fn restore_backup_folder(app: tauri::AppHandle, state: State<BackupFolder>, path: String) -> Result<bool, String> {
    let saved = vnote_db::fsutil::read_text(&backup_folder_file(&app)?)?;
    if saved.as_deref() == Some(path.as_str()) { *state.0.lock().unwrap() = Some(path); Ok(true) } else { Ok(false) }
}

#[tauri::command]
fn folder_read(state: State<BackupFolder>, root: String, rel: String) -> Result<Option<String>, String> {
    check_root(&state, &root)?;
    vnote_db::backup_fs::folder_read(std::path::Path::new(&root), &rel).map(|o| o.map(|b| b64().encode(b)))
}

#[tauri::command]
fn folder_write(state: State<BackupFolder>, root: String, rel: String, data: String) -> Result<(), String> {
    check_root(&state, &root)?;
    let bytes = b64().decode(data).map_err(|e| e.to_string())?;
    vnote_db::backup_fs::folder_write(std::path::Path::new(&root), &rel, &bytes)
}

#[tauri::command]
fn folder_remove(state: State<BackupFolder>, root: String, rel: String) -> Result<(), String> { check_root(&state, &root)?; vnote_db::backup_fs::folder_remove(std::path::Path::new(&root), &rel) }

#[tauri::command]
fn folder_list(state: State<BackupFolder>, root: String) -> Result<Vec<String>, String> { check_root(&state, &root)?; vnote_db::backup_fs::folder_list(std::path::Path::new(&root)) }

#[derive(Default)]
struct OAuthListener(std::sync::Mutex<Option<std::net::TcpListener>>);

/// Abre un puerto local efímero (solo 127.0.0.1) para recibir la redirección de OAuth y devuelve el puerto.
#[tauri::command]
fn oauth_listen(state: State<OAuthListener>) -> Result<u16, String> {
    let l = std::net::TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = l.local_addr().map_err(|e| e.to_string())?.port();
    *state.0.lock().unwrap() = Some(l);
    Ok(port)
}

/// Abre en el navegador la página de autorización (solo Google o Dropbox).
#[tauri::command]
fn open_oauth_url(url: String) -> Result<(), String> {
    if !vnote_db::backup_fs::is_oauth_url(&url) { return Err("Dirección no permitida".into()); }
    open_in_browser(&url)
}

/// Espera (máx. 3 minutos) la redirección, responde una página breve y devuelve la ruta con `code` y `state`.
#[tauri::command]
async fn oauth_wait(state: State<'_, OAuthListener>) -> Result<String, String> {
    let listener = state.0.lock().unwrap().take().ok_or("No hay una conexión en curso")?;
    tauri::async_runtime::spawn_blocking(move || {
        use std::io::{Read, Write};
        listener.set_nonblocking(true).map_err(|e| e.to_string())?;
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(180);
        loop {
            match listener.accept() {
                Ok((mut s, _)) => {
                    s.set_nonblocking(false).ok();
                    s.set_read_timeout(Some(std::time::Duration::from_secs(5))).ok();
                    let mut buf = [0u8; 4096];
                    let n = s.read(&mut buf).unwrap_or(0);
                    let req = String::from_utf8_lossy(&buf[..n]).to_string();
                    let target = vnote_db::backup_fs::redirect_target(&req);
                    let body = "<html><body style=\"font-family:sans-serif\"><p>Listo, ya puedes cerrar esta pestaña y volver a la aplicación.</p></body></html>";
                    let _ = write!(s, "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body);
                    if let Some(t) = target { return Ok(t); }
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    if std::time::Instant::now() > deadline { return Err("Tiempo de espera agotado".to_string()); }
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
                Err(e) => return Err(e.to_string()),
            }
        }
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
fn tick_count() -> u64 { ticker::EMITTED.load(std::sync::atomic::Ordering::SeqCst) }

static TRAY_OK: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

fn show_main(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// Ventana mínima de captura rápida (RF-13): se abre sobre las demás, aunque la ventana principal esté oculta en la bandeja.
fn show_capture(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("capture") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
        return;
    }
    let built = WebviewWindowBuilder::new(app, "capture", WebviewUrl::App("index.html?capture=1".into()))
        .title("Captura rápida")
        .inner_size(520.0, 380.0)
        .always_on_top(true)
        .center()
        .build();
    if let Ok(w) = built { let _ = w.set_focus(); }
}

/// En Wayland nativo el compositor da el foco a toda ventana nueva y la app no puede impedirlo; allí el aviso es solo la notificación del sistema,
/// que no toma foco. Con X11 (`GDK_BACKEND=x11`) la ventana respeta `focusable(false)`. `VNOTE_REMINDER_WINDOW=1` fuerza la ventana siempre.
fn reminder_window_allowed() -> bool {
    let set = |k: &str| std::env::var(k).map_or(false, |v| !v.is_empty());
    if set("VNOTE_REMINDER_WINDOW") { return true; }
    #[cfg(target_os = "linux")]
    {
        let x11 = std::env::var("GDK_BACKEND").map_or(false, |v| v.starts_with("x11"));
        if set("WAYLAND_DISPLAY") && !x11 { return false; }
    }
    true
}

/// Ventana pequeña de recordatorio (RF-11): aparece encima de las demás pero SIN robar el foco a la app que se esté usando.
#[tauri::command]
fn show_reminder(app: tauri::AppHandle, workspace_id: String, page_id: String, task_id: String, title: String, when: String) -> Result<(), String> {
    if !reminder_window_allowed() { return Ok(()); }
    if let Some(old) = app.get_webview_window("reminder") { let _ = old.close(); }
    let url = reminder::reminder_url(&workspace_id, &page_id, &task_id, &title, &when);
    WebviewWindowBuilder::new(&app, "reminder", WebviewUrl::App(url.into()))
        .title("Recordatorio")
        .inner_size(380.0, 150.0)
        .always_on_top(true)
        .focused(false)
        // GNOME/Wayland ignora `focused(false)` y da el foco a toda ventana nueva; sin foco posible, el recordatorio no se lo quita a la app en uso.
        .focusable(false)
        .skip_taskbar(true)
        .resizable(false)
        .build()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// «Abrir» en la ventana de recordatorio: muestra la ventana principal y le pide abrir la tarea.
#[tauri::command]
fn open_task(app: tauri::AppHandle, workspace_id: String, page_id: String) {
    show_main(&app);
    let _ = app.emit("vnote://open-task", serde_json::json!({ "workspaceId": workspace_id, "pageId": page_id }));
}

#[tauri::command]
fn open_capture(app: tauri::AppHandle) { show_capture(&app); }

/// Argumento interno que usa un atajo del sistema para pedir la captura a la instancia en ejecución (no es una interfaz pública).
const CAPTURE_ARG: &str = "--capture";

/// Registra el atajo global de captura. `VNOTE_FORCE_SHORTCUT_FAIL` simula un sistema que no lo permite (pruebas, CL-15).
#[tauri::command]
fn capture_shortcut_set(app: tauri::AppHandle, combo: Option<String>) -> Result<(), String> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
    let gs = app.global_shortcut();
    gs.unregister_all().map_err(|e| e.to_string())?;
    let Some(combo) = combo else { return Ok(()) };
    if std::env::var("VNOTE_FORCE_SHORTCUT_FAIL").map_or(false, |v| !v.is_empty()) {
        return Err("el sistema no permite registrar atajos globales".into());
    }
    let shortcut: Shortcut = combo.parse().map_err(|e: <Shortcut as std::str::FromStr>::Err| e.to_string())?;
    gs.on_shortcut(shortcut, |app, _s, event| {
        if event.state() == ShortcutState::Pressed { show_capture(app); }
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn exe_path() -> String { std::env::current_exe().map(|p| p.to_string_lossy().to_string()).unwrap_or_default() }

fn build_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
    let open = MenuItem::with_id(app, "open", "Abrir", true, None::<&str>)?;
    let capture = MenuItem::with_id(app, "capture", "Captura rápida", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &capture, &quit])?;
    let icon = app.default_window_icon().cloned().ok_or(tauri::Error::WindowNotFound)?;
    TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "capture" => show_capture(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_main(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

#[tauri::command]
fn window_visible(app: tauri::AppHandle) -> bool {
    app.get_webview_window("main").and_then(|w| w.is_visible().ok()).unwrap_or(false)
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Bandeja del sistema: cerrar la ventana la oculta (los respaldos programados siguen corriendo) y desde aquí se reabre o se sale.
            // Si la bandeja no está disponible (p. ej. algunos entornos Wayland), cerrar cierra de verdad para no dejar la app invisible.
            match build_tray(app.handle()) {
                Ok(()) => TRAY_OK.store(true, Ordering::SeqCst),
                Err(e) => eprintln!("bandeja no disponible: {e}"),
            }
            if std::env::args().any(|a| a == CAPTURE_ARG) { show_capture(app.handle()); }
            let handle = app.handle().clone();
            ticker::spawn(ticker::interval_from(std::env::var("VNOTE_TICK_MS").ok()), move |kind| {
                let _ = handle.emit(ticker::TICK_EVENT, ());
                if kind == ticker::Kind::Resume { let _ = handle.emit(ticker::RESUME_EVENT, ()); }
            });
            Ok(())
        })
        // Una sola instancia (CL-22): la segunda ejecución enfoca la ventana existente y termina.
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // `--capture` (desde un atajo del sistema) abre la captura rápida en la instancia que ya corre.
            if argv.iter().any(|a| a == CAPTURE_ARG) {
                show_capture(app);
            } else if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // La ventana de captura se cierra de verdad (se vuelve a crear en la siguiente captura).
                if window.label() == "main" && TRAY_OK.load(Ordering::SeqCst) && std::env::var("VNOTE_QUIT_ON_CLOSE").map_or(true, |v| v.is_empty()) {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .manage(Dbs::default())
        .manage(OAuthListener::default())
        .manage(BackupFolder::default())
        .invoke_handler(tauri::generate_handler![
            db_open, db_exec, db_query, db_begin, db_commit, db_rollback, db_close,
            asset_put, asset_get, asset_has, asset_delete, asset_list,
            app_dirs, config_read, config_write, path_exists, reveal_path, open_release_url, open_unsplash_url, export_save, show_reminder, open_task, workspace_remove,
            keychain_set, keychain_get, keychain_delete,
            pick_backup_folder, restore_backup_folder, folder_read, folder_write, folder_remove, folder_list, oauth_listen, oauth_wait, open_oauth_url,
            tick_count, window_visible, open_capture, capture_shortcut_set, exe_path, print_html
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar la aplicación");
}
