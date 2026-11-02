//! Utilidades de archivos: escritura atómica y borrado ACOTADO de un espacio de trabajo.

use crate::assets::is_valid_hash;
use std::{fs, io::Write, path::{Path, PathBuf}};

/// Escribe `text` en `path` de forma atómica (archivo temporal + renombrado), creando carpetas si faltan.
pub fn atomic_write(path: &Path, text: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension(format!("tmp{}", std::process::id()));
    {
        let mut f = fs::File::create(&tmp).map_err(|e| e.to_string())?;
        f.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
        f.sync_all().map_err(|e| e.to_string())?;
    }
    fs::rename(&tmp, path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        e.to_string()
    })
}

pub fn read_text(path: &Path) -> Result<Option<String>, String> {
    match fs::read_to_string(path) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Borra SOLO lo que la aplicación creó en la carpeta de un espacio (base, sus archivos auxiliares y adjuntos por hash).
/// Nunca borra archivos ajenos: la carpeta puede haberla elegido la persona y contener otras cosas.
pub fn remove_workspace_files(dir: &Path) -> Result<(), String> {
    if !dir.exists() {
        return Ok(());
    }
    for name in ["space.db", "space.db-wal", "space.db-shm"] {
        let f = dir.join(name);
        if f.exists() {
            fs::remove_file(&f).map_err(|e| e.to_string())?;
        }
    }
    let assets = dir.join("assets");
    if assets.is_dir() {
        for entry in fs::read_dir(&assets).map_err(|e| e.to_string())?.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                if is_valid_hash(name) {
                    fs::remove_file(entry.path()).map_err(|e| e.to_string())?;
                }
            }
        }
        let _ = fs::remove_dir(&assets); // solo si quedó vacía
    }
    let _ = fs::remove_dir(dir); // solo si quedó vacía
    Ok(())
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Os { Linux, MacOs, Windows }

/// Variables de entorno que intervienen en la ruta estándar (se pasan como dato para poder probarlo en cualquier sistema).
#[derive(Clone, Debug, Default)]
pub struct DataDirEnv {
    pub home: Option<PathBuf>,
    pub xdg_data_home: Option<PathBuf>,
    pub appdata: Option<PathBuf>,
}

/// Carpeta de datos estándar de cada sistema para la aplicación (RF-25): la misma que usa Tauri por defecto,
/// de modo que quien ya tiene datos en ella no los pierde.
/// Linux: `$XDG_DATA_HOME` (si es absoluta) o `~/.local/share`; macOS: `~/Library/Application Support`; Windows: `%APPDATA%`.
pub fn standard_data_dir(os: Os, env: &DataDirEnv, identifier: &str) -> Option<PathBuf> {
    let base = match os {
        Os::Linux => match &env.xdg_data_home {
            Some(x) if x.is_absolute() => x.clone(),
            _ => env.home.as_ref()?.join(".local/share"),
        },
        Os::MacOs => env.home.as_ref()?.join("Library/Application Support"),
        Os::Windows => match &env.appdata {
            Some(a) => a.clone(),
            None => env.home.as_ref()?.join("AppData/Roaming"),
        },
    };
    Some(base.join(identifier))
}

/// ¿Es una página de descarga de GitHub Releases (`https://github.com/<dueño>/<repo>/releases/...`)? Es lo único que la app abre en el navegador.
pub fn is_release_url(url: &str) -> bool {
    let Some(rest) = url.strip_prefix("https://github.com/") else { return false };
    let ok = |s: &str| !s.is_empty() && s.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '.' | '-'));
    let mut parts = rest.splitn(4, '/');
    let (Some(owner), Some(repo), Some(kind), Some(tail)) = (parts.next(), parts.next(), parts.next(), parts.next()) else { return false };
    ok(owner) && ok(repo) && kind == "releases" && !tail.is_empty() && !tail.chars().any(|c| c.is_whitespace() || c.is_control())
}

/// Guarda `content` como `file_name` (solo `.html`, sin rutas) dentro de `dir`, creándola si hace falta.
/// Nunca sobrescribe: si el nombre existe usa «nombre (2).html», «nombre (3).html»… y crea el archivo de forma exclusiva.
pub fn write_new_unique(dir: &Path, file_name: &str, content: &str) -> Result<PathBuf, String> {
    let bad = file_name.is_empty()
        || file_name.contains(['/', '\\', ':', '\0'])
        || file_name == "."
        || file_name == ".."
        || !file_name.to_ascii_lowercase().ends_with(".html")
        || file_name.len() <= ".html".len();
    if bad { return Err("Nombre de archivo no válido".into()); }
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let stem = &file_name[..file_name.len() - ".html".len()];
    for n in 1..=9999u32 {
        let name = if n == 1 { file_name.to_string() } else { format!("{stem} ({n}).html") };
        let path = dir.join(name);
        match fs::OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(mut f) => { f.write_all(content.as_bytes()).map_err(|e| e.to_string())?; return Ok(path); }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(e.to_string()),
        }
    }
    Err("Demasiados archivos con ese nombre".into())
}
