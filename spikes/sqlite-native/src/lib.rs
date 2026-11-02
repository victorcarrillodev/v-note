use rusqlite::{Connection, Result};

pub fn open_memory() -> Result<Connection> {
    Connection::open_in_memory()
}

pub fn open_file(path: &str) -> Result<Connection> {
    let db = Connection::open(path)?;
    db.pragma_update(None, "journal_mode", "WAL")?;
    db.pragma_update(None, "synchronous", "FULL")?;
    Ok(db)
}

/// Inserta valores dentro de una transacción; confirma o revierte según `commit`.
pub fn insert_in_tx(db: &Connection, values: &[&str], commit: bool) -> Result<()> {
    db.execute_batch("BEGIN")?;
    for v in values {
        db.execute("INSERT INTO t(v) VALUES (?1)", [v])?;
    }
    db.execute_batch(if commit { "COMMIT" } else { "ROLLBACK" })
}

pub fn count(db: &Connection, table: &str) -> i64 {
    db.query_row(&format!("SELECT count(*) FROM {table}"), [], |r| r.get(0)).unwrap()
}

pub fn search(db: &Connection, q: &str) -> Result<Vec<String>> {
    let mut st = db.prepare("SELECT title FROM page_text WHERE page_text MATCH ?1 ORDER BY rank")?;
    let rows = st.query_map([q], |r| r.get::<_, String>(0))?;
    rows.collect()
}

pub fn snippet(db: &Connection, q: &str) -> Result<String> {
    db.query_row(
        "SELECT snippet(page_text, 1, '<b>', '</b>', '…', 8) FROM page_text WHERE page_text MATCH ?1",
        [q],
        |r| r.get(0),
    )
}

pub fn bulk_insert(db: &Connection, n: i64) -> Result<()> {
    db.execute_batch("BEGIN")?;
    {
        let mut a = db.prepare("INSERT INTO rows(id, status, n, title) VALUES (?1, ?2, ?3, ?4)")?;
        let mut b = db.prepare("INSERT INTO rows_fts(rowid, title) VALUES (?1, ?2)")?;
        for i in 0..n {
            let status = if i % 3 == 0 { "hecho" } else { "pendiente" };
            let title = if i % 500 == 0 { format!("tortillas numero {i}") } else { format!("tarea numero {i} sobre cosas") };
            a.execute(rusqlite::params![i, status, i, title])?;
            b.execute(rusqlite::params![i, title])?;
        }
    }
    db.execute_batch("COMMIT")
}
