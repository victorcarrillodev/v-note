//! Base SQLite nativa de un espacio de trabajo (plan D-2, D-3, D-5).
//! Valores en JSON: enteros y reales como números, texto como cadenas, nulos como `null` y binarios como `{"$blob": "<base64>"}`.

pub mod assets;
pub mod backup_fs;
pub mod fsutil;
pub use assets::AssetDir;

use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use rusqlite::{params_from_iter, types::Value as Sql, types::ValueRef, Connection};
use serde_json::{json, Map, Value};
use std::sync::Mutex;

pub struct Database {
    conn: Mutex<Connection>,
}

fn to_sql(v: &Value) -> Result<Sql, String> {
    Ok(match v {
        Value::Null => Sql::Null,
        Value::Bool(b) => Sql::Integer(*b as i64),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Sql::Integer(i)
            } else {
                Sql::Real(n.as_f64().ok_or("número fuera de rango")?)
            }
        }
        Value::String(s) => Sql::Text(s.clone()),
        Value::Object(o) => match o.get("$blob").and_then(|b| b.as_str()) {
            Some(b64) => Sql::Blob(B64.decode(b64).map_err(|e| e.to_string())?),
            None => return Err("parámetro no soportado".into()),
        },
        Value::Array(_) => return Err("parámetro no soportado".into()),
    })
}

fn from_ref(v: ValueRef) -> Value {
    match v {
        ValueRef::Null => Value::Null,
        ValueRef::Integer(i) => json!(i),
        ValueRef::Real(r) => json!(r),
        ValueRef::Text(t) => json!(String::from_utf8_lossy(t)),
        ValueRef::Blob(b) => json!({ "$blob": B64.encode(b) }),
    }
}

impl Database {
    /// Abre (o crea) la base. En archivo usa WAL y sincronización completa; siempre activa las claves foráneas.
    pub fn open(path: &str) -> Result<Self, String> {
        let in_memory = path == ":memory:";
        if !in_memory {
            if let Some(parent) = std::path::Path::new(path).parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
        }
        let conn = if in_memory { Connection::open_in_memory() } else { Connection::open(path) }.map_err(|e| e.to_string())?;
        if !in_memory {
            conn.pragma_update(None, "journal_mode", "WAL").map_err(|e| e.to_string())?;
            conn.pragma_update(None, "synchronous", "FULL").map_err(|e| e.to_string())?;
        }
        conn.pragma_update(None, "foreign_keys", "ON").map_err(|e| e.to_string())?;
        Ok(Self { conn: Mutex::new(conn) })
    }

    pub fn execute_batch(&self, sql: &str) -> Result<(), String> {
        self.conn.lock().unwrap().execute_batch(sql).map_err(|e| e.to_string())
    }

    pub fn exec(&self, sql: &str, params: &[Value]) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        let bound: Vec<Sql> = params.iter().map(to_sql).collect::<Result<_, _>>()?;
        if bound.is_empty() {
            conn.execute_batch(sql).map_err(|e| e.to_string())
        } else {
            conn.execute(sql, params_from_iter(bound)).map(|_| ()).map_err(|e| e.to_string())
        }
    }

    pub fn query(&self, sql: &str, params: &[Value]) -> Result<Vec<Value>, String> {
        let conn = self.conn.lock().unwrap();
        let bound: Vec<Sql> = params.iter().map(to_sql).collect::<Result<_, _>>()?;
        let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
        let names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
        let mut rows = stmt.query(params_from_iter(bound)).map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        while let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let mut obj = Map::new();
            for (i, name) in names.iter().enumerate() {
                obj.insert(name.clone(), from_ref(row.get_ref(i).map_err(|e| e.to_string())?));
            }
            out.push(Value::Object(obj));
        }
        Ok(out)
    }

    pub fn begin(&self) -> Result<(), String> {
        self.conn.lock().unwrap().execute_batch("BEGIN").map_err(|e| e.to_string())
    }
    pub fn commit(&self) -> Result<(), String> {
        self.conn.lock().unwrap().execute_batch("COMMIT").map_err(|e| e.to_string())
    }
    pub fn rollback(&self) -> Result<(), String> {
        self.conn.lock().unwrap().execute_batch("ROLLBACK").map_err(|e| e.to_string())
    }
}
