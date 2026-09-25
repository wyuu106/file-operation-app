use crate::model::{
    Fingerprint, HistoryItem, HistoryOperation,
    RecoveryItem, RenameTemplate, StoredPlan,
    UndoItem,
};
use rusqlite::{params, Connection};
use std::path::PathBuf;

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

pub fn templates(
    conn: &Connection,
) -> rusqlite::Result<Vec<RenameTemplate>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, pattern, created_at,
                updated_at FROM rename_templates
         ORDER BY updated_at DESC, id DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(RenameTemplate {
            id: row.get(0)?,
            name: row.get(1)?,
            pattern: row.get(2)?,
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
        })
    })?;
    rows.collect()
}

pub fn template(
    conn: &Connection,
    id: i64,
) -> rusqlite::Result<RenameTemplate> {
    conn.query_row(
        "SELECT id, name, pattern, created_at,
                updated_at FROM rename_templates
         WHERE id = ?1",
        [id],
        |row| {
            Ok(RenameTemplate {
                id: row.get(0)?,
                name: row.get(1)?,
                pattern: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        },
    )
}

pub fn create_template(
    conn: &Connection,
    name: &str,
    pattern: &str,
    now: &str,
) -> rusqlite::Result<RenameTemplate> {
    conn.execute(
        "INSERT INTO rename_templates
         (name, pattern, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?3)",
        params![name, pattern, now],
    )?;
    template(conn, conn.last_insert_rowid())
}

pub fn update_template(
    conn: &Connection,
    id: i64,
    name: &str,
    pattern: &str,
    now: &str,
) -> rusqlite::Result<Option<RenameTemplate>> {
    let changed = conn.execute(
        "UPDATE rename_templates
         SET name = ?1, pattern = ?2,
             updated_at = ?3 WHERE id = ?4",
        params![name, pattern, now, id],
    )?;
    if changed == 0 {
        return Ok(None);
    }
    template(conn, id).map(Some)
}

pub fn delete_template(
    conn: &Connection,
    id: i64,
) -> rusqlite::Result<bool> {
    let changed = conn.execute(
        "DELETE FROM rename_templates WHERE id = ?1",
        [id],
    )?;
    Ok(changed > 0)
}

pub fn start_operation(
    conn: &mut Connection,
    plan: &StoredPlan,
    targets: &[String],
    now: &str,
) -> rusqlite::Result<(i64, Vec<i64>)> {
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO rename_operations
         (status, executed_at)
         VALUES ('in_progress', ?1)",
        [now],
    )?;
    let operation_id = tx.last_insert_rowid();
    let mut ids = Vec::new();
    for (source, target) in
        plan.sources.iter().zip(targets.iter())
    {
        let fingerprint = serde_json::to_string(
            &source.fingerprint
        ).map_err(|error| {
            rusqlite::Error::ToSqlConversionFailure(
                Box::new(error)
            )
        })?;
        let target_path =
            plan.folder.join(target);
        tx.execute(
            "INSERT INTO rename_operation_items
             (operation_id, original_path,
              renamed_path, fingerprint, status)
             VALUES (?1, ?2, ?3, ?4, 'pending')",
            params![
                operation_id,
                source.path.to_string_lossy(),
                target_path.to_string_lossy(),
                fingerprint,
            ],
        )?;
        ids.push(tx.last_insert_rowid());
    }
    tx.commit()?;
    Ok((operation_id, ids))
}

pub fn set_item_status(
    conn: &Connection,
    id: i64,
    status: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE rename_operation_items
         SET status = ?1 WHERE id = ?2",
        params![status, id],
    )?;
    Ok(())
}

pub fn set_operation_status(
    conn: &Connection,
    id: i64,
    status: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE rename_operations
         SET status = ?1 WHERE id = ?2",
        params![status, id],
    )?;
    Ok(())
}

pub fn last_completed(
    conn: &Connection,
) -> rusqlite::Result<Option<i64>> {
    let result = conn.query_row(
        "SELECT id FROM rename_operations
         WHERE status = 'completed'
           AND undone_at IS NULL
         ORDER BY id DESC LIMIT 1",
        [],
        |row| row.get(0),
    );
    match result {
        Ok(id) => Ok(Some(id)),
        Err(
            rusqlite::Error::QueryReturnedNoRows,
        ) => Ok(None),
        Err(error) => Err(error),
    }
}

pub fn history(
    conn: &Connection,
) -> rusqlite::Result<Vec<HistoryOperation>> {
    let mut operations = conn.prepare(
        "SELECT id, executed_at, status, undone_at
         FROM rename_operations
         ORDER BY id DESC",
    )?;
    let rows =
        operations.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
            ))
        })?;
    let mut result = Vec::new();
    for row in rows {
        let (id, executed_at, status, undone_at) =
            row?;
        let mut statement = conn.prepare(
            "SELECT original_path, renamed_path,
                    status
             FROM rename_operation_items
             WHERE operation_id = ?1
             ORDER BY id",
        )?;
        let details =
            statement.query_map([id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })?;
        let mut folder = String::new();
        let mut changed_count = 0;
        let mut items = Vec::new();
        for detail in details {
            let (original, renamed, item_status) =
                detail?;
            let original_path =
                PathBuf::from(&original);
            let renamed_path =
                PathBuf::from(&renamed);
            if folder.is_empty() {
                folder = original_path
                    .parent()
                    .unwrap_or(&original_path)
                    .to_string_lossy()
                    .into_owned();
            }
            if matches!(
                item_status.as_str(),
                "moved"
                    | "undone"
                    | "needs_review"
            ) {
                changed_count += 1;
            }
            items.push(HistoryItem {
                original_name: original_path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .into_owned(),
                renamed_name: renamed_path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .into_owned(),
                status: item_status,
            });
        }
        result.push(HistoryOperation {
            id,
            executed_at,
            folder,
            changed_count,
            status,
            undone_at,
            items,
        });
    }
    Ok(result)
}

pub fn undo_items(
    conn: &Connection,
    operation_id: i64,
) -> rusqlite::Result<Vec<UndoItem>> {
    let mut stmt = conn.prepare(
        "SELECT id, original_path, renamed_path,
                fingerprint
         FROM rename_operation_items
         WHERE operation_id = ?1 ORDER BY id DESC"
    )?;
    let rows = stmt.query_map([operation_id], |row| {
        let encoded: String = row.get(3)?;
        let fingerprint: Fingerprint =
            serde_json::from_str(&encoded).map_err(|e| {
                rusqlite::Error::FromSqlConversionFailure(
                    3,
                    rusqlite::types::Type::Text,
                    Box::new(e),
                )
            })?;
        Ok(UndoItem {
            id: row.get(0)?,
            original_path: PathBuf::from(
                row.get::<_, String>(1)?
            ),
            renamed_path: PathBuf::from(
                row.get::<_, String>(2)?
            ),
            fingerprint,
        })
    })?;
    rows.collect()
}

pub fn mark_undone(
    conn: &Connection,
    operation_id: i64,
    now: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE rename_operations
         SET status = 'undone', undone_at = ?1
         WHERE id = ?2",
        params![now, operation_id],
    )?;
    Ok(())
}

pub fn reconcile(
    conn: &Connection,
) -> rusqlite::Result<usize> {
    let mut stmt = conn.prepare(
        "SELECT id, original_path, renamed_path
         FROM rename_operation_items
         WHERE operation_id IN (
           SELECT id FROM rename_operations
           WHERE status IN (
             'in_progress', 'undo_in_progress'
           )
         )",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
        ))
    })?;
    for row in rows {
        let (id, original, renamed) = row?;
        let original_exists =
            PathBuf::from(original).exists();
        let renamed_exists =
            PathBuf::from(renamed).exists();
        let status = match (
            original_exists,
            renamed_exists,
        ) {
            (true, false) => "unmoved",
            (false, true) => "moved",
            _ => "uncertain",
        };
        set_item_status(conn, id, status)?;
    }
    conn.execute(
        "UPDATE rename_operations
         SET status = 'needs_review'
         WHERE status IN (
           'in_progress', 'undo_in_progress'
         )",
        [],
    )?;
    conn.query_row(
        "SELECT COUNT(*) FROM rename_operations
         WHERE status = 'needs_review'",
        [],
        |row| row.get(0),
    )
}

pub fn recovery_items(
    conn: &Connection,
) -> rusqlite::Result<Vec<RecoveryItem>> {
    let mut stmt = conn.prepare(
        "SELECT original_path, renamed_path, status
         FROM rename_operation_items
         WHERE operation_id IN (
           SELECT id FROM rename_operations
           WHERE status = 'needs_review'
         ) ORDER BY operation_id DESC, id"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(RecoveryItem {
            original_path: row.get(0)?,
            renamed_path: row.get(1)?,
            status: row.get(2)?,
        })
    })?;
    rows.collect()
}
