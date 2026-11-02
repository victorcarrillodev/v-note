// T-091, T-092, T-093 (pruebas primero): base SQLite nativa del espacio de trabajo.
use serde_json::{json, Value};
use vnote_db::Database;

fn mem() -> Database {
    Database::open(":memory:").unwrap()
}

#[test]
fn abre_en_archivo_con_wal_sincronizacion_completa_y_claves_foraneas() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("espacio.db");
    let db = Database::open(path.to_str().unwrap()).unwrap();
    let rows = db.query("PRAGMA journal_mode", &[]).unwrap();
    assert_eq!(rows[0]["journal_mode"], json!("wal"));
    assert_eq!(db.query("PRAGMA synchronous", &[]).unwrap()[0]["synchronous"], json!(2));
    assert_eq!(db.query("PRAGMA foreign_keys", &[]).unwrap()[0]["foreign_keys"], json!(1));
    assert!(path.exists());
}

#[test]
fn crea_las_carpetas_intermedias_si_faltan() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("a/b/c/espacio.db");
    Database::open(path.to_str().unwrap()).unwrap();
    assert!(path.exists());
}

#[test]
fn la_ruta_imposible_devuelve_error_en_vez_de_caerse() {
    assert!(Database::open("/proc/no-se-puede/espacio.db").is_err());
}

#[test]
fn ejecuta_y_consulta_con_parametros_de_todos_los_tipos() {
    let db = mem();
    db.execute_batch("CREATE TABLE t(i INTEGER, r REAL, s TEXT, b BLOB, n TEXT)").unwrap();
    db.exec("INSERT INTO t VALUES (?, ?, ?, ?, ?)", &[json!(42), json!(1.5), json!("hola ñ"), json!({"$blob": "AQID"}), Value::Null]).unwrap();
    let rows = db.query("SELECT * FROM t", &[]).unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0]["i"], json!(42));
    assert_eq!(rows[0]["r"], json!(1.5));
    assert_eq!(rows[0]["s"], json!("hola ñ"));
    assert_eq!(rows[0]["b"], json!({"$blob": "AQID"}));
    assert_eq!(rows[0]["n"], Value::Null);
}

#[test]
fn los_parametros_no_se_interpretan_como_sql() {
    let db = mem();
    db.execute_batch("CREATE TABLE t(v TEXT)").unwrap();
    db.exec("INSERT INTO t VALUES (?)", &[json!("x'); DROP TABLE t; --")]).unwrap();
    assert_eq!(db.query("SELECT count(*) AS n FROM t", &[]).unwrap()[0]["n"], json!(1));
}

#[test]
fn una_sentencia_invalida_devuelve_error() {
    let db = mem();
    assert!(db.exec("INSERT INTO no_existe VALUES (1)", &[]).is_err());
    assert!(db.query("SELEC 1", &[]).is_err());
}

#[test]
fn el_texto_completo_fts5_esta_disponible() {
    let db = mem();
    db.execute_batch("CREATE VIRTUAL TABLE p USING fts5(title, body)").unwrap();
    db.exec("INSERT INTO p VALUES (?, ?)", &[json!("Receta"), json!("tortillas de maiz")]).unwrap();
    let rows = db.query("SELECT title FROM p WHERE p MATCH ?", &[json!("tortillas")]).unwrap();
    assert_eq!(rows[0]["title"], json!("Receta"));
}

#[test]
fn transaccion_confirmada_persiste_y_revertida_no() {
    let db = mem();
    db.execute_batch("CREATE TABLE t(v TEXT)").unwrap();
    db.begin().unwrap();
    db.exec("INSERT INTO t VALUES ('a')", &[]).unwrap();
    db.commit().unwrap();
    db.begin().unwrap();
    db.exec("INSERT INTO t VALUES ('b')", &[]).unwrap();
    db.rollback().unwrap();
    assert_eq!(db.query("SELECT v FROM t", &[]).unwrap(), vec![json!({"v": "a"})]);
}

#[test]
fn no_se_puede_abrir_una_transaccion_dentro_de_otra_ni_confirmar_sin_abrir() {
    let db = mem();
    db.begin().unwrap();
    assert!(db.begin().is_err());
    db.rollback().unwrap();
    assert!(db.commit().is_err());
}

#[test]
fn los_datos_confirmados_sobreviven_al_reabrir_el_archivo() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("e.db");
    {
        let db = Database::open(path.to_str().unwrap()).unwrap();
        db.execute_batch("CREATE TABLE t(v TEXT)").unwrap();
        db.begin().unwrap();
        db.exec("INSERT INTO t VALUES ('persistente')", &[]).unwrap();
        db.commit().unwrap();
    }
    let db = Database::open(path.to_str().unwrap()).unwrap();
    assert_eq!(db.query("SELECT v FROM t", &[]).unwrap()[0]["v"], json!("persistente"));
}

#[test]
fn una_transaccion_sin_confirmar_se_pierde_al_cerrar_pero_no_corrompe() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("e.db");
    {
        let db = Database::open(path.to_str().unwrap()).unwrap();
        db.execute_batch("CREATE TABLE t(v TEXT)").unwrap();
        db.exec("INSERT INTO t VALUES ('firme')", &[]).unwrap();
        db.begin().unwrap();
        db.exec("INSERT INTO t VALUES ('a medias')", &[]).unwrap();
        // se "corta" sin commit
    }
    let db = Database::open(path.to_str().unwrap()).unwrap();
    assert_eq!(db.query("SELECT v FROM t", &[]).unwrap(), vec![json!({"v": "firme"})]);
    assert_eq!(db.query("PRAGMA integrity_check", &[]).unwrap()[0]["integrity_check"], json!("ok"));
}
