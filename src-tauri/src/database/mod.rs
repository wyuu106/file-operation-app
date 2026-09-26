use rusqlite::Connection;

pub fn init(
    conn: &Connection,
) -> rusqlite::Result<()> {
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
         CREATE TABLE IF NOT EXISTS rename_templates (
           id INTEGER PRIMARY KEY,
           name TEXT NOT NULL,
           pattern TEXT NOT NULL,
           created_at TEXT NOT NULL,
           updated_at TEXT NOT NULL
         );
         CREATE TABLE IF NOT EXISTS rename_operations (
           id INTEGER PRIMARY KEY,
           status TEXT NOT NULL,
           executed_at TEXT NOT NULL,
           undone_at TEXT
         );
         CREATE TABLE IF NOT EXISTS
         rename_operation_items (
           id INTEGER PRIMARY KEY,
           operation_id INTEGER NOT NULL,
           original_path TEXT NOT NULL,
           renamed_path TEXT NOT NULL,
           fingerprint TEXT NOT NULL,
           status TEXT NOT NULL,
           FOREIGN KEY (operation_id)
             REFERENCES rename_operations(id)
         );"
    )
}
