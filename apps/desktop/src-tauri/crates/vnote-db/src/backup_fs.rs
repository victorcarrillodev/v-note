//! Respaldo en carpeta local y retorno de OAuth: acceso a archivos acotado a una carpeta y utilidades del bucle local.
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

/// Une `root` con una ruta relativa SOLO si es segura: sin vacíos, `.`/`..`, barras invertidas, unidad ni ruta absoluta.
fn safe_join(root: &Path, rel: &str) -> Result<PathBuf, String> {
    let bad = rel.is_empty()
        || rel.starts_with('/')
        || rel.contains(['\\', '\0', ':'])
        || rel.split('/').any(|p| p.is_empty() || p == "." || p == "..");
    if bad { return Err("Ruta de respaldo no válida".into()); }
    Ok(rel.split('/').fold(root.to_path_buf(), |acc, p| acc.join(p)))
}

/// Escribe de forma atómica (temporal en la misma carpeta + renombrar): actualiza in-place y no deja basura.
pub fn folder_write(root: &Path, rel: &str, bytes: &[u8]) -> Result<(), String> {
    let path = safe_join(root, rel)?;
    if let Some(parent) = path.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
    let tmp = path.with_extension(format!("{}.vnote-tmp", path.extension().and_then(|e| e.to_str()).unwrap_or("")));
    {
        let mut f = fs::File::create(&tmp).map_err(|e| e.to_string())?;
        f.write_all(bytes).map_err(|e| e.to_string())?;
        f.sync_all().map_err(|e| e.to_string())?;
    }
    fs::rename(&tmp, &path).map_err(|e| { let _ = fs::remove_file(&tmp); e.to_string() })
}

pub fn folder_read(root: &Path, rel: &str) -> Result<Option<Vec<u8>>, String> {
    let path = safe_join(root, rel)?;
    match fs::read(&path) {
        Ok(b) => Ok(Some(b)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn folder_remove(root: &Path, rel: &str) -> Result<(), String> {
    let path = safe_join(root, rel)?;
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

/// Todas las rutas de archivos bajo `root` (relativas, con `/`), recursivo. Una carpeta inexistente es una lista vacía.
pub fn folder_list(root: &Path) -> Result<Vec<String>, String> {
    fn walk(dir: &Path, prefix: &str, out: &mut Vec<String>) -> Result<(), String> {
        let entries = match fs::read_dir(dir) {
            Ok(e) => e,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
            Err(e) => return Err(e.to_string()),
        };
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let name = entry.file_name().to_string_lossy().to_string();
            let rel = if prefix.is_empty() { name.clone() } else { format!("{prefix}/{name}") };
            let ty = entry.file_type().map_err(|e| e.to_string())?;
            if ty.is_dir() { walk(&entry.path(), &rel, out)?; }
            else if ty.is_file() && !name.ends_with(".vnote-tmp") { out.push(rel); }
        }
        Ok(())
    }
    let mut out = Vec::new();
    walk(root, "", &mut out)?;
    Ok(out)
}

/// ¿Es una página de autorización OAuth permitida (Google o Dropbox, https, sin espacios)? Es lo único que se abre para conectar.
pub fn is_oauth_url(url: &str) -> bool {
    let allowed = ["https://accounts.google.com/o/oauth2/", "https://www.dropbox.com/oauth2/authorize"];
    allowed.iter().any(|p| url.starts_with(p)) && !url.chars().any(|c| c.is_whitespace() || c.is_control())
}

/// Ruta y consulta de la petición de retorno (`GET /cb?code=... HTTP/1.1`); cualquier otra cosa (p. ej. `/favicon.ico`) se ignora.
pub fn redirect_target(request: &str) -> Option<String> {
    let line = request.lines().next()?;
    let mut parts = line.split_whitespace();
    if parts.next()? != "GET" { return None; }
    let target = parts.next()?;
    let path = target.split('?').next().unwrap_or("");
    (path == "/cb").then(|| target.to_string())
}

/// ¿El retorno trae exactamente el `state` de la solicitud en curso?
pub fn has_state(target: &str, expected: &str) -> bool {
    if expected.is_empty() { return false; }
    let query = target.split_once('?').map_or("", |(_, q)| q);
    query.split('&').any(|pair| pair.strip_prefix("state=") == Some(expected))
}

/// ¿`root` es exactamente la carpeta que la persona autorizó con el diálogo nativo? Compara rutas canónicas: `..`, enlaces o `/` no pasan.
pub fn is_authorized_root(allowed: Option<&str>, root: &str) -> bool {
    let Some(allowed) = allowed else { return false };
    if allowed.is_empty() || root.is_empty() { return false; }
    match (fs::canonicalize(allowed), fs::canonicalize(root)) {
        (Ok(a), Ok(r)) => a == r,
        _ => false,
    }
}
