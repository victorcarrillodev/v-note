import type { Migration } from "./migrate";

/** Migraciones del esquema del espacio de trabajo. Solo se AÑADEN al final; nunca se editan las ya publicadas. */
export const migrations: Migration[] = [
  {
    version: 1,
    name: "meta y pages",
    up: async (tx) => {
      await tx.exec("CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT)");
      await tx.exec(`CREATE TABLE pages(
        id TEXT PRIMARY KEY,
        parent_id TEXT REFERENCES pages(id),
        position TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        icon TEXT,
        cover TEXT,
        kind TEXT NOT NULL DEFAULT 'note' CHECK (kind IN ('note','board','database')),
        favorite INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER,
        deleted_root_id TEXT
      )`);
      await tx.exec("CREATE INDEX pages_parent ON pages(parent_id, position)");
    },
  },
  {
    version: 2,
    name: "page_docs",
    up: async (tx) => {
      await tx.exec(`CREATE TABLE page_docs(
        page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('snapshot','update')),
        data BLOB NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (page_id, seq)
      )`);
    },
  },
  {
    version: 3,
    name: "page_text (texto completo)",
    up: async (tx) => {
      await tx.exec("CREATE VIRTUAL TABLE page_text USING fts5(page_id UNINDEXED, title, body, tokenize = 'unicode61 remove_diacritics 2')");
    },
  },
  {
    version: 4,
    name: "page_visits",
    up: async (tx) => {
      await tx.exec(`CREATE TABLE page_visits(
        page_id TEXT PRIMARY KEY REFERENCES pages(id) ON DELETE CASCADE,
        visited_at INTEGER NOT NULL
      )`);
    },
  },
  {
    version: 5,
    name: "backup_runs",
    up: async (tx) => {
      await tx.exec(`CREATE TABLE backup_runs(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at INTEGER NOT NULL,
        finished_at INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('success','unchanged','failed','needs_decision','cancelled')),
        commit_sha TEXT,
        files_uploaded INTEGER,
        files_removed INTEGER,
        error_kind TEXT,
        error_message TEXT,
        skipped_json TEXT
      )`);
    },
  },
  {
    version: 6,
    name: "bases de datos",
    up: async (tx) => {
      await tx.exec(`CREATE TABLE databases(
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT '',
        page_id TEXT UNIQUE REFERENCES pages(id) ON DELETE CASCADE,
        host_page_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`);
      await tx.exec(`CREATE TABLE properties(
        id TEXT PRIMARY KEY,
        database_id TEXT NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('text','number','select','multi_select','date','checkbox','url','email','phone','files','status','created_time','last_edited_time','relation','rollup','formula')),
        position TEXT NOT NULL,
        config TEXT NOT NULL DEFAULT '{}',
        UNIQUE(database_id, name)
      )`);
      await tx.exec("CREATE INDEX properties_db ON properties(database_id, position)");
      await tx.exec(`CREATE TABLE db_rows(
        database_id TEXT NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
        page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        position TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY(database_id, page_id)
      )`);
      await tx.exec("CREATE INDEX db_rows_page ON db_rows(page_id)");
      await tx.exec(`CREATE TABLE cell_values(
        database_id TEXT NOT NULL,
        page_id TEXT NOT NULL,
        property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        value TEXT NOT NULL,
        PRIMARY KEY(database_id, page_id, property_id),
        FOREIGN KEY(database_id, page_id) REFERENCES db_rows(database_id, page_id) ON DELETE CASCADE
      )`);
      await tx.exec(`CREATE TABLE relation_links(
        property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        from_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        to_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        PRIMARY KEY(property_id, from_page_id, to_page_id)
      )`);
      await tx.exec("CREATE INDEX relation_links_to ON relation_links(property_id, to_page_id)");
      await tx.exec(`CREATE TABLE views(
        id TEXT PRIMARY KEY,
        database_id TEXT NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
        name TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL CHECK (type IN ('table','list','board','gallery','calendar','timeline')),
        position TEXT NOT NULL,
        config TEXT NOT NULL DEFAULT '{}'
      )`);
      await tx.exec("CREATE INDEX views_db ON views(database_id, position)");
    },
  },
  {
    version: 7,
    name: "tareas y recordatorios",
    up: async (tx) => {
      // Índice DERIVADO de casillas, tarjetas y filas con fecha: se puede reconstruir desde los documentos y las propiedades.
      await tx.exec(`CREATE TABLE tasks(
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL CHECK (source IN ('checkbox','card','row')),
        page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        block_id TEXT,
        database_id TEXT REFERENCES databases(id) ON DELETE CASCADE,
        title TEXT NOT NULL DEFAULT '',
        due TEXT,
        remind_at TEXT,
        recurrence TEXT,
        done INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      )`);
      await tx.exec("CREATE INDEX tasks_due ON tasks(due)");
      await tx.exec("CREATE INDEX tasks_remind ON tasks(remind_at)");
      await tx.exec("CREATE INDEX tasks_page ON tasks(page_id)");
      // Estado PROPIO (no derivable): vive aparte para que reconstruir `tasks` no lo pierda.
      await tx.exec(`CREATE TABLE reminder_state(
        task_id TEXT PRIMARY KEY,
        occurrence TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('fired','snoozed','dismissed')),
        snoozed_until TEXT,
        updated_at INTEGER NOT NULL
      )`);
    },
  },
  {
    version: 8,
    name: "enlaces entre páginas",
    up: async (tx) => {
      // Índice DERIVADO de las menciones de cada documento (se reconstruye desde ellos). El destino no es clave foránea:
      // si se elimina para siempre, el enlace queda roto pero el origen conserva su mención.
      await tx.exec(`CREATE TABLE links(
        from_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        to_page_id TEXT NOT NULL,
        PRIMARY KEY(from_page_id, to_page_id)
      )`);
      await tx.exec("CREATE INDEX links_to ON links(to_page_id)");
    },
  },
  {
    version: 9,
    name: "borrador de captura rápida",
    up: async (tx) => {
      // Un único borrador por espacio de trabajo (RF-13): se actualiza en cada edición y se borra al confirmar o descartar.
      await tx.exec(`CREATE TABLE quick_capture_draft(
        id INTEGER PRIMARY KEY CHECK (id = 1),
        text TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`);
    },
  },
  {
    version: 10,
    name: "informes de importación",
    up: async (tx) => {
      // El informe de cada importación (RF-23, CL-27) se guarda con su página contenedora; se borra con ella.
      await tx.exec(`CREATE TABLE import_reports(
        id TEXT PRIMARY KEY,
        container_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        source TEXT NOT NULL CHECK (source IN ('markdown','obsidian','notion')),
        created_at INTEGER NOT NULL,
        imported INTEGER NOT NULL,
        approximated INTEGER NOT NULL,
        omitted INTEGER NOT NULL,
        broken_links INTEGER NOT NULL,
        details TEXT NOT NULL
      )`);
      await tx.exec("CREATE UNIQUE INDEX import_reports_container ON import_reports(container_page_id)");
    },
  },
  {
    version: 11,
    name: "ancho completo de página",
    up: async (tx) => {
      // Spec 002 (RF-10.3): la página puede ocupar todo el ancho. Por defecto falso; las páginas existentes quedan en ancho normal.
      await tx.exec("ALTER TABLE pages ADD COLUMN full_width INTEGER NOT NULL DEFAULT 0");
    },
  },
  {
    version: 12,
    name: "hora de inicio y duración de tareas",
    up: async (tx) => {
      // Spec 002 (RF-7.2, RF-8.1): columnas opcionales del índice DERIVADO de tareas. Nulas = tarea de «todo el día», como hasta ahora.
      await tx.exec("ALTER TABLE tasks ADD COLUMN start_time TEXT");
      await tx.exec("ALTER TABLE tasks ADD COLUMN duration_min INTEGER");
    },
  },
  {
    version: 13,
    name: "etiquetas de página",
    up: async (tx) => {
      // Spec 002 (RF-5.9): catálogo de etiquetas del espacio (nombre y color de la paleta) y su asignación a páginas.
      await tx.exec(`CREATE TABLE tags(
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`);
      await tx.exec("CREATE UNIQUE INDEX tags_name ON tags(lower(name))");
      await tx.exec(`CREATE TABLE page_tags(
        page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (page_id, tag_id)
      )`);
      await tx.exec("CREATE INDEX page_tags_tag ON page_tags(tag_id)");
    },
  },
  {
    version: 14,
    name: "estilo de página",
    up: async (tx) => {
      // Spec 005 (plan §4.2): estilo de la página (JSON normalizado), descripción, bloqueo y crédito de la portada.
      await tx.exec("ALTER TABLE pages ADD COLUMN style TEXT");
      await tx.exec("ALTER TABLE pages ADD COLUMN description TEXT");
      await tx.exec("ALTER TABLE pages ADD COLUMN locked INTEGER NOT NULL DEFAULT 0");
      await tx.exec("ALTER TABLE pages ADD COLUMN cover_credit TEXT");
      // DP-6: el ancho completo de la spec 002 pasa al estilo; desde aquí full_width deja de leerse y escribirse.
      await tx.exec(`UPDATE pages SET style = '{"spacing":{"width":"full"}}' WHERE full_width = 1`);
    },
  },
  {
    version: 15,
    name: "texto y notas de adjuntos",
    up: async (tx) => {
      // backlog B-9 y B-11: texto extraído de PDF (derivado) y notas por zona sobre PDF e imágenes.
      await tx.exec("CREATE TABLE asset_text(hash TEXT PRIMARY KEY, text TEXT NOT NULL)");
      await tx.exec(`CREATE TABLE asset_notes(
        id TEXT PRIMARY KEY,
        hash TEXT NOT NULL,
        page INTEGER NOT NULL,
        x REAL NOT NULL, y REAL NOT NULL, w REAL NOT NULL, h REAL NOT NULL,
        text TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`);
      await tx.exec("CREATE INDEX asset_notes_hash ON asset_notes(hash)");
    },
  },
];
