// Respaldo en carpeta local y redirección OAuth: rutas seguras, listado recursivo y petición de retorno.
use vnote_db::backup_fs::{folder_list, folder_read, folder_remove, folder_write, is_oauth_url, redirect_target};

#[test]
fn escribe_lee_lista_y_borra_dentro_de_la_carpeta() {
    let t = tempfile::tempdir().unwrap();
    let root = t.path();
    folder_write(root, "app/workspaces.json", b"{}").unwrap();
    folder_write(root, "workspaces/1/a.md", b"hola").unwrap();
    assert_eq!(folder_read(root, "workspaces/1/a.md").unwrap(), Some(b"hola".to_vec()));
    assert_eq!(folder_read(root, "no/existe").unwrap(), None);
    let mut l = folder_list(root).unwrap();
    l.sort();
    assert_eq!(l, vec!["app/workspaces.json".to_string(), "workspaces/1/a.md".to_string()]);
    folder_remove(root, "workspaces/1/a.md").unwrap();
    assert_eq!(folder_read(root, "workspaces/1/a.md").unwrap(), None);
    folder_remove(root, "workspaces/1/a.md").unwrap(); // borrar lo inexistente no falla
}

#[test]
fn actualiza_in_place_sin_dejar_temporales() {
    let t = tempfile::tempdir().unwrap();
    folder_write(t.path(), "a.txt", b"v1").unwrap();
    folder_write(t.path(), "a.txt", b"v2").unwrap();
    assert_eq!(folder_list(t.path()).unwrap(), vec!["a.txt".to_string()]);
    assert_eq!(folder_read(t.path(), "a.txt").unwrap(), Some(b"v2".to_vec()));
}

#[test]
fn rechaza_rutas_que_salen_de_la_carpeta() {
    let t = tempfile::tempdir().unwrap();
    for bad in ["../x", "a/../../x", "/etc/passwd", "a\\..\\x", "", "C:/x", "a/./b"] {
        assert!(folder_write(t.path(), bad, b"x").is_err(), "{bad}");
        assert!(folder_read(t.path(), bad).is_err(), "{bad}");
        assert!(folder_remove(t.path(), bad).is_err(), "{bad}");
    }
}

#[test]
fn solo_abre_en_el_navegador_las_paginas_de_autorizacion() {
    assert!(is_oauth_url("https://accounts.google.com/o/oauth2/v2/auth?client_id=x"));
    assert!(is_oauth_url("https://www.dropbox.com/oauth2/authorize?client_id=x"));
    assert!(!is_oauth_url("http://accounts.google.com/o/oauth2/v2/auth"));
    assert!(!is_oauth_url("https://accounts.google.com.evil.com/o/oauth2/v2/auth"));
    assert!(!is_oauth_url("https://evil.com/?https://accounts.google.com/o/oauth2/v2/auth"));
    assert!(!is_oauth_url("https://www.dropbox.com/oauth2/authorize x"));
}

#[test]
fn extrae_la_ruta_de_retorno_de_la_primera_linea_de_la_peticion() {
    assert_eq!(redirect_target("GET /cb?code=abc&state=s HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n"), Some("/cb?code=abc&state=s".to_string()));
    assert_eq!(redirect_target("POST /cb HTTP/1.1\r\n\r\n"), None);
    assert_eq!(redirect_target("basura"), None);
    // solo la ruta de retorno /cb: un favicon o un sondeo local no consumen el único intento
    assert_eq!(redirect_target("GET /favicon.ico HTTP/1.1\r\n\r\n"), None);
    assert_eq!(redirect_target("GET / HTTP/1.1\r\n\r\n"), None);
    assert_eq!(redirect_target("GET /cbx?code=1 HTTP/1.1\r\n\r\n"), None);
    assert_eq!(redirect_target("GET /cb HTTP/1.1\r\n\r\n"), Some("/cb".to_string()));
}

#[test]
fn solo_se_acepta_la_carpeta_autorizada() {
    use vnote_db::backup_fs::is_authorized_root;
    let t = tempfile::tempdir().unwrap();
    let dir = t.path().join("Respaldo");
    std::fs::create_dir_all(&dir).unwrap();
    let p = dir.to_string_lossy().to_string();
    assert!(is_authorized_root(Some(&p), &p));
    assert!(is_authorized_root(Some(&p), &format!("{p}/")));
    assert!(!is_authorized_root(None, &p));
    assert!(!is_authorized_root(Some(&p), t.path().to_str().unwrap()));
    assert!(!is_authorized_root(Some(&p), &format!("{p}/../..")));
    assert!(!is_authorized_root(Some(&p), "/"));
    assert!(!is_authorized_root(Some(""), ""));
}
