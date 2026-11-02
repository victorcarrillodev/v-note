//! Adjuntos de un espacio de trabajo: archivos direccionados por el SHA-256 de su contenido (plan D-25).

use sha2::{Digest, Sha256};
use std::{fs, io::Write, path::PathBuf};

pub struct AssetDir {
    root: PathBuf,
}

/// Un hash válido son 64 hexadecimales en minúscula: nunca una ruta (evita escapar de la carpeta).
pub fn is_valid_hash(s: &str) -> bool {
    s.len() == 64 && s.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

fn check(hash: &str) -> Result<(), String> {
    if is_valid_hash(hash) { Ok(()) } else { Err("hash inválido".into()) }
}

impl AssetDir {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    fn path(&self, hash: &str) -> PathBuf {
        self.root.join(hash)
    }

    /// Guarda el contenido (escritura atómica: archivo temporal y renombrado). Devuelve (hash, tamaño).
    pub fn put(&self, data: &[u8]) -> Result<(String, u64), String> {
        let hash = hex::encode(Sha256::digest(data));
        fs::create_dir_all(&self.root).map_err(|e| e.to_string())?;
        let target = self.path(&hash);
        if !target.exists() {
            let tmp = self.root.join(format!("{hash}.{}.tmp", std::process::id()));
            {
                let mut f = fs::File::create(&tmp).map_err(|e| e.to_string())?;
                f.write_all(data).map_err(|e| e.to_string())?;
                f.sync_all().map_err(|e| e.to_string())?;
            }
            fs::rename(&tmp, &target).map_err(|e| {
                let _ = fs::remove_file(&tmp);
                e.to_string()
            })?;
        }
        Ok((hash, data.len() as u64))
    }

    pub fn get(&self, hash: &str) -> Result<Option<Vec<u8>>, String> {
        check(hash)?;
        match fs::read(self.path(hash)) {
            Ok(b) => Ok(Some(b)),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }

    pub fn has(&self, hash: &str) -> Result<bool, String> {
        check(hash)?;
        Ok(self.path(hash).is_file())
    }

    pub fn delete(&self, hash: &str) -> Result<(), String> {
        check(hash)?;
        match fs::remove_file(self.path(hash)) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    }

    pub fn list(&self) -> Result<Vec<String>, String> {
        let rd = match fs::read_dir(&self.root) {
            Ok(rd) => rd,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(vec![]),
            Err(e) => return Err(e.to_string()),
        };
        let mut out: Vec<String> = rd
            .filter_map(|e| e.ok())
            .filter_map(|e| e.file_name().into_string().ok())
            .filter(|n| is_valid_hash(n))
            .collect();
        out.sort();
        Ok(out)
    }
}
