// T-105 (pruebas primero): utilidades de archivos del espacio de trabajo (configuración atómica y borrado acotado).
use std::path::PathBuf;
use vnote_db::fsutil::{atomic_write, read_text, remove_workspace_files, standard_data_dir, is_release_url, write_new_unique, DataDirEnv, Os};

#[test]
fn escribe_de_forma_atomica_y_lee_de_vuelta() {
    let t = tempfile::tempdir().unwrap();
    let f = t.path().join("sub/config.json");
    atomic_write(&f, "{\"a\":1}").unwrap();
    assert_eq!(read_text(&f).unwrap(), Some("{\"a\":1}".to_string()));
    atomic_write(&f, "{\"a\":2}").unwrap();
    assert_eq!(read_text(&f).unwrap(), Some("{\"a\":2}".to_string()));
}

#[test]
fn no_deja_temporales_tras_escribir() {
    let t = tempfile::tempdir().unwrap();
    let f = t.path().join("c.json");
    atomic_write(&f, "x").unwrap();
    let n: Vec<_> = std::fs::read_dir(t.path()).unwrap().map(|e| e.unwrap().file_name().to_string_lossy().to_string()).collect();
    assert_eq!(n, vec!["c.json".to_string()]);
}

#[test]
fn leer_un_archivo_inexistente_devuelve_none() {
    let t = tempfile::tempdir().unwrap();
    assert_eq!(read_text(&t.path().join("nada.json")).unwrap(), None);
}

#[test]
fn borrar_un_espacio_solo_toca_sus_archivos_conocidos() {
    let t = tempfile::tempdir().unwrap();
    let d = t.path().join("espacio");
    std::fs::create_dir_all(d.join("assets")).unwrap();
    for f in ["space.db", "space.db-wal", "space.db-shm"] { std::fs::write(d.join(f), "x").unwrap(); }
    std::fs::write(d.join("assets").join("a".repeat(64)), "bytes").unwrap();
    std::fs::write(d.join("mis-notas-personales.txt"), "no tocar").unwrap(); // algo que la persona guardó ahí
    remove_workspace_files(&d).unwrap();
    assert!(!d.join("space.db").exists());
    assert!(!d.join("space.db-wal").exists());
    assert!(!d.join("assets").exists());
    assert!(d.join("mis-notas-personales.txt").exists(), "no debe borrar archivos ajenos");
    assert!(d.exists(), "la carpeta sigue porque no está vacía");
}

#[test]
fn borrar_un_espacio_elimina_la_carpeta_si_queda_vacia() {
    let t = tempfile::tempdir().unwrap();
    let d = t.path().join("espacio");
    std::fs::create_dir_all(&d).unwrap();
    std::fs::write(d.join("space.db"), "x").unwrap();
    remove_workspace_files(&d).unwrap();
    assert!(!d.exists());
}

#[test]
fn borrar_una_carpeta_inexistente_no_falla() {
    let t = tempfile::tempdir().unwrap();
    remove_workspace_files(&t.path().join("no-existe")).unwrap();
}

#[test]
fn la_carpeta_de_adjuntos_solo_se_borra_si_contiene_unicamente_hashes() {
    let t = tempfile::tempdir().unwrap();
    let d = t.path().join("espacio");
    std::fs::create_dir_all(d.join("assets")).unwrap();
    std::fs::write(d.join("assets").join("a".repeat(64)), "x").unwrap();
    std::fs::write(d.join("assets").join("ajeno.txt"), "no tocar").unwrap();
    remove_workspace_files(&d).unwrap();
    assert!(!d.join("assets").join("a".repeat(64)).exists());
    assert!(d.join("assets").join("ajeno.txt").exists());
}

// T-155 (prueba primero): carpeta de datos por defecto estándar de cada sistema (RF-25).
const ID: &str = "dev.vnote.app";
fn env(home: &str) -> DataDirEnv {
    DataDirEnv { home: Some(PathBuf::from(home)), xdg_data_home: None, appdata: None }
}

#[test]
fn linux_usa_local_share_dentro_del_home() {
    assert_eq!(standard_data_dir(Os::Linux, &env("/home/ana"), ID), Some(PathBuf::from("/home/ana/.local/share/dev.vnote.app")));
}

#[test]
fn linux_respeta_xdg_data_home_si_esta_definida_y_es_absoluta() {
    let mut e = env("/home/ana");
    e.xdg_data_home = Some(PathBuf::from("/datos/xdg"));
    assert_eq!(standard_data_dir(Os::Linux, &e, ID), Some(PathBuf::from("/datos/xdg/dev.vnote.app")));
    e.xdg_data_home = Some(PathBuf::from("relativa"));
    assert_eq!(standard_data_dir(Os::Linux, &e, ID), Some(PathBuf::from("/home/ana/.local/share/dev.vnote.app")));
}

#[test]
fn macos_usa_application_support() {
    assert_eq!(standard_data_dir(Os::MacOs, &env("/Users/ana"), ID), Some(PathBuf::from("/Users/ana/Library/Application Support/dev.vnote.app")));
}

#[test]
fn windows_usa_appdata_y_si_falta_cae_en_appdata_roaming_del_perfil() {
    let mut e = env("C:/Users/ana");
    e.appdata = Some(PathBuf::from("C:/Users/ana/AppData/Roaming"));
    assert_eq!(standard_data_dir(Os::Windows, &e, ID), Some(PathBuf::from("C:/Users/ana/AppData/Roaming/dev.vnote.app")));
    e.appdata = None;
    assert_eq!(standard_data_dir(Os::Windows, &e, ID), Some(PathBuf::from("C:/Users/ana/AppData/Roaming/dev.vnote.app")));
}

#[test]
fn sin_home_no_hay_ruta_en_vez_de_inventar_una() {
    let e = DataDirEnv { home: None, xdg_data_home: None, appdata: None };
    assert_eq!(standard_data_dir(Os::Linux, &e, ID), None);
    assert_eq!(standard_data_dir(Os::MacOs, &e, ID), None);
    assert_eq!(standard_data_dir(Os::Windows, &e, ID), None);
}

// T-166: solo se abren páginas de descarga de GitHub Releases (nunca una dirección arbitraria).
#[test]
fn solo_se_abren_paginas_de_releases_de_github() {
    assert!(is_release_url("https://github.com/yo/v-note/releases/tag/v0.2.0"));
    assert!(is_release_url("https://github.com/yo/v-note/releases/latest"));
    for bad in ["http://github.com/yo/v-note/releases/latest", "https://evil.com/yo/v-note/releases/latest", "https://github.com.evil.com/a/b/releases/x",
        "https://github.com/yo/v-note", "file:///etc/passwd", "javascript:alert(1)", "https://github.com/yo/v-note/releases/x y", "--help", ""] {
        assert!(!is_release_url(bad), "debería rechazar {bad}");
    }
}

// T-409: guardar una exportación en una carpeta sin sobrescribir nunca nada existente (constitución, art. 5).
#[test]
fn guarda_la_exportacion_con_su_nombre() {
    let t = tempfile::tempdir().unwrap();
    let p = write_new_unique(t.path(), "Informe.html", "<p>x</p>").unwrap();
    assert_eq!(p.file_name().unwrap(), "Informe.html");
    assert_eq!(std::fs::read_to_string(p).unwrap(), "<p>x</p>");
}

#[test]
fn si_el_nombre_existe_agrega_un_numero_y_no_pisa_el_original() {
    let t = tempfile::tempdir().unwrap();
    write_new_unique(t.path(), "Informe.html", "uno").unwrap();
    let b = write_new_unique(t.path(), "Informe.html", "dos").unwrap();
    let c = write_new_unique(t.path(), "Informe.html", "tres").unwrap();
    assert_eq!(b.file_name().unwrap(), "Informe (2).html");
    assert_eq!(c.file_name().unwrap(), "Informe (3).html");
    assert_eq!(std::fs::read_to_string(t.path().join("Informe.html")).unwrap(), "uno");
}

#[test]
fn crea_la_carpeta_si_no_existe() {
    let t = tempfile::tempdir().unwrap();
    let dir = t.path().join("Descargas/nueva");
    let p = write_new_unique(&dir, "a.html", "x").unwrap();
    assert!(p.exists());
}

#[test]
fn rechaza_nombres_con_ruta_o_que_no_son_html() {
    let t = tempfile::tempdir().unwrap();
    for bad in ["../x.html", "a/b.html", "a\\b.html", "x.exe", "x", ".html", "", "con\0nulo.html", "..", "CON:.html"] {
        assert!(write_new_unique(t.path(), bad, "x").is_err(), "debería rechazar {bad:?}");
    }
    assert_eq!(std::fs::read_dir(t.path()).unwrap().count(), 0);
}
