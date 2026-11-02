// T-010/T-011/T-012 (pruebas primero): transacciones, texto completo (FTS5) y rendimiento con 50 000 filas.
use spike_sqlite_native::*;
use std::time::Instant;

#[test]
fn una_transaccion_confirmada_persiste_y_una_revertida_no() {
    let db = open_memory().unwrap();
    db.execute_batch("CREATE TABLE t(id INTEGER PRIMARY KEY, v TEXT)").unwrap();
    insert_in_tx(&db, &["a", "b"], true).unwrap();
    insert_in_tx(&db, &["c"], false).unwrap();
    assert_eq!(count(&db, "t"), 2);
}

#[test]
fn fts5_esta_disponible_y_busca_texto() {
    let db = open_memory().unwrap();
    db.execute_batch("CREATE VIRTUAL TABLE page_text USING fts5(title, body)").unwrap();
    db.execute("INSERT INTO page_text(title, body) VALUES ('Receta', 'tortillas de maiz y frijoles')", []).unwrap();
    db.execute("INSERT INTO page_text(title, body) VALUES ('Otro', 'nada que ver')", []).unwrap();
    let hits = search(&db, "tortillas").unwrap();
    assert_eq!(hits, vec!["Receta".to_string()]);
    let snippet = snippet(&db, "frijoles").unwrap();
    assert!(snippet.contains("<b>frijoles</b>"));
}

#[test]
fn modo_wal_y_sincronizacion_completa_en_archivo() {
    let dir = std::env::temp_dir().join(format!("vnote-spike-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let db = open_file(dir.join("w.db").to_str().unwrap()).unwrap();
    let mode: String = db.query_row("PRAGMA journal_mode", [], |r| r.get(0)).unwrap();
    let sync: i64 = db.query_row("PRAGMA synchronous", [], |r| r.get(0)).unwrap();
    assert_eq!(mode.to_lowercase(), "wal");
    assert_eq!(sync, 2); // FULL
    std::fs::remove_dir_all(dir).ok();
}

#[test]
fn benchmark_50000_filas() {
    let db = open_memory().unwrap();
    db.execute_batch(
        "CREATE TABLE rows(id INTEGER PRIMARY KEY, status TEXT, n INTEGER, title TEXT);
         CREATE VIRTUAL TABLE rows_fts USING fts5(title);",
    ).unwrap();
    let t = Instant::now();
    bulk_insert(&db, 50_000).unwrap();
    let insert_ms = t.elapsed().as_millis();
    let t = Instant::now();
    let filtered: i64 = db.query_row("SELECT count(*) FROM rows WHERE status='hecho' AND n > 25000", [], |r| r.get(0)).unwrap();
    let filter_ms = t.elapsed().as_millis();
    let t = Instant::now();
    let found: i64 = db.query_row("SELECT count(*) FROM rows_fts WHERE rows_fts MATCH 'tortillas'", [], |r| r.get(0)).unwrap();
    let fts_ms = t.elapsed().as_millis();
    println!("BENCH insert={insert_ms}ms filtro={filter_ms}ms fts={fts_ms}ms (filtradas={filtered}, fts={found})");
    assert!(filtered > 0 && found > 0);
    assert!(insert_ms < 5000, "inserción lenta: {insert_ms} ms");
    assert!(filter_ms < 200, "filtro lento: {filter_ms} ms");
    assert!(fts_ms < 200, "texto completo lento: {fts_ms} ms");
}
