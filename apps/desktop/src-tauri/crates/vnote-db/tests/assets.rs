// T-099 (pruebas primero): adjuntos en una carpeta, direccionados por el hash SHA-256 de su contenido.
use vnote_db::AssetDir;

const EMPTY_SHA: &str = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const ABC_SHA: &str = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

fn dir() -> (tempfile::TempDir, AssetDir) {
    let t = tempfile::tempdir().unwrap();
    let a = AssetDir::new(t.path().join("assets"));
    (t, a)
}

#[test]
fn guarda_y_lee_un_archivo_con_el_hash_correcto() {
    let (_t, a) = dir();
    let (hash, size) = a.put(b"abc").unwrap();
    assert_eq!(hash, ABC_SHA);
    assert_eq!(size, 3);
    assert_eq!(a.get(&hash).unwrap(), Some(b"abc".to_vec()));
}

#[test]
fn el_archivo_vacio_es_valido() {
    let (_t, a) = dir();
    let (hash, size) = a.put(b"").unwrap();
    assert_eq!((hash.as_str(), size), (EMPTY_SHA, 0));
    assert_eq!(a.get(EMPTY_SHA).unwrap(), Some(vec![]));
}

#[test]
fn el_mismo_contenido_no_se_duplica() {
    let (_t, a) = dir();
    a.put(b"x").unwrap();
    a.put(b"x").unwrap();
    assert_eq!(a.list().unwrap().len(), 1);
}

#[test]
fn contenidos_distintos_conviven() {
    let (_t, a) = dir();
    let (h1, _) = a.put(b"uno").unwrap();
    let (h2, _) = a.put(b"dos").unwrap();
    assert_ne!(h1, h2);
    assert_eq!(a.get(&h1).unwrap(), Some(b"uno".to_vec()));
    assert_eq!(a.get(&h2).unwrap(), Some(b"dos".to_vec()));
}

#[test]
fn no_existe_devuelve_none_y_borrar_es_idempotente() {
    let (_t, a) = dir();
    let h = "0".repeat(64);
    assert_eq!(a.get(&h).unwrap(), None);
    assert!(!a.has(&h).unwrap());
    a.delete(&h).unwrap();
}

#[test]
fn borrar_elimina_el_archivo() {
    let (_t, a) = dir();
    let (h, _) = a.put(b"y").unwrap();
    assert!(a.has(&h).unwrap());
    a.delete(&h).unwrap();
    assert!(!a.has(&h).unwrap());
}

#[test]
fn rechaza_hashes_invalidos_y_rutas_maliciosas() {
    let (_t, a) = dir();
    for bad in ["../etc/passwd", "a/b", "", "xyz", &"A".repeat(64), &format!("{}/..", "a".repeat(60))] {
        assert!(a.get(bad).is_err(), "debía rechazar {bad:?}");
        assert!(a.has(bad).is_err());
        assert!(a.delete(bad).is_err());
    }
}

#[test]
fn archivo_grande_se_conserva_integro() {
    let (_t, a) = dir();
    let big: Vec<u8> = (0..5 * 1024 * 1024).map(|i| (i % 251) as u8).collect();
    let (h, size) = a.put(&big).unwrap();
    assert_eq!(size, big.len() as u64);
    assert_eq!(a.get(&h).unwrap().unwrap(), big);
}

#[test]
fn escritura_atomica_no_deja_archivos_temporales() {
    let (t, a) = dir();
    a.put(b"limpio").unwrap();
    let names: Vec<String> = std::fs::read_dir(t.path().join("assets")).unwrap().map(|e| e.unwrap().file_name().to_string_lossy().into()).collect();
    assert!(names.iter().all(|n| !n.ends_with(".tmp")), "{names:?}");
}

#[test]
fn list_ignora_basura_que_no_es_un_hash() {
    let (t, a) = dir();
    let (h, _) = a.put(b"z").unwrap();
    std::fs::write(t.path().join("assets").join("notas.txt"), "x").unwrap();
    assert_eq!(a.list().unwrap(), vec![h]);
}
