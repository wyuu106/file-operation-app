use crate::models::{
    FileInfo, HistoryOperation, OperationReport,
    Preview, RecoveryItem, RenameTemplate,
    StoredPlan,
};
use crate::repositories::db;
use crate::services::operations;
use crate::AppState;
use rusqlite::Connection;

fn database<'a>(
    state: &'a tauri::State<AppState>,
) -> Result<
    std::sync::MutexGuard<'a, Connection>,
    String,
> {
    state.db.lock().map_err(|_| "DB_ERROR".into())
}

fn stored_plan(
    state: &tauri::State<AppState>,
    id: &str,
) -> Result<StoredPlan, String> {
    let guard = state
        .plan
        .lock()
        .map_err(|_| "PLAN_EXPIRED")?;
    match guard.as_ref() {
        Some(plan) if plan.id == id => {
            Ok(plan.clone())
        }
        _ => Err("PLAN_EXPIRED".into()),
    }
}

#[tauri::command]
pub(crate) fn get_files(
    path: String,
) -> Result<Vec<FileInfo>, String> {
    operations::files(&path)
}

#[tauri::command]
pub(crate) fn get_templates(
    state: tauri::State<AppState>,
) -> Result<Vec<RenameTemplate>, String> {
    let conn = database(&state)?;
    db::templates(&conn)
        .map_err(|_| "DB_ERROR".into())
}

fn checked_template(
    name: &str,
    pattern: &str,
) -> Result<(), String> {
    if name.trim().is_empty()
        || name.trim().chars().count() > 80
    {
        return Err("BAD_TEMPLATE_NAME".into());
    }
    operations::parse_segments(pattern)?;
    Ok(())
}

#[tauri::command]
pub(crate) fn create_template(
    state: tauri::State<AppState>,
    name: String,
    pattern: String,
) -> Result<RenameTemplate, String> {
    checked_template(&name, &pattern)?;
    let conn = database(&state)?;
    db::create_template(
        &conn,
        name.trim(),
        &pattern,
        &operations::now(),
    )
    .map_err(|_| "DB_ERROR".into())
}

#[tauri::command]
pub(crate) fn update_template(
    state: tauri::State<AppState>,
    id: i64,
    name: String,
    pattern: String,
) -> Result<RenameTemplate, String> {
    checked_template(&name, &pattern)?;
    let conn = database(&state)?;
    db::update_template(
        &conn,
        id,
        name.trim(),
        &pattern,
        &operations::now(),
    )
    .map_err(|_| "DB_ERROR")?
    .ok_or("TEMPLATE_MISSING".into())
}

#[tauri::command]
pub(crate) fn delete_template(
    state: tauri::State<AppState>,
    id: i64,
) -> Result<(), String> {
    let conn = database(&state)?;
    let deleted = db::delete_template(&conn, id)
        .map_err(|_| "DB_ERROR")?;
    if !deleted {
        return Err("TEMPLATE_MISSING".into());
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn preview_rename(
    state: tauri::State<AppState>,
    path: String,
    selected: Vec<String>,
    template_id: i64,
) -> Result<Preview, String> {
    let template = {
        let conn = database(&state)?;
        db::template(&conn, template_id)
            .map_err(|_| "TEMPLATE_MISSING")?
    };
    let plan = operations::create_plan(
        &path,
        &selected,
        &template.pattern,
    )?;
    let result = operations::preview(
        &plan,
        &plan.generated,
    );
    let mut stored = state
        .plan
        .lock()
        .map_err(|_| "PLAN_EXPIRED")?;
    *stored = Some(plan);
    Ok(result)
}

#[tauri::command]
pub(crate) fn validate_preview(
    state: tauri::State<AppState>,
    plan_id: String,
    targets: Vec<String>,
) -> Result<Preview, String> {
    let plan = stored_plan(&state, &plan_id)?;
    Ok(operations::preview(&plan, &targets))
}

#[tauri::command]
pub(crate) fn execute_rename(
    state: tauri::State<AppState>,
    plan_id: String,
    targets: Vec<String>,
) -> Result<OperationReport, String> {
    let _operation = state
        .operation
        .lock()
        .map_err(|_| "BUSY")?;
    let plan = stored_plan(&state, &plan_id)?;
    let mut conn = database(&state)?;
    let result = operations::execute(
        &mut conn, &plan, &targets,
    )?;
    let mut stored = state
        .plan
        .lock()
        .map_err(|_| "PLAN_EXPIRED")?;
    *stored = None;
    Ok(result)
}

#[tauri::command]
pub(crate) fn undo_last_rename(
    state: tauri::State<AppState>,
) -> Result<OperationReport, String> {
    let _operation = state
        .operation
        .lock()
        .map_err(|_| "BUSY")?;
    let conn = database(&state)?;
    operations::undo(&conn)
}

#[tauri::command]
pub(crate) fn get_status(
    state: tauri::State<AppState>,
) -> Result<(bool, usize), String> {
    let conn = database(&state)?;
    let undo = db::last_completed(&conn)
        .map_err(|_| "DB_ERROR")?
        .is_some();
    let review: usize = conn.query_row(
        "SELECT COUNT(*) FROM rename_operations
         WHERE status = 'needs_review'",
        [],
        |row| row.get(0),
    ).map_err(|_| "DB_ERROR")?;
    Ok((undo, review))
}

#[tauri::command]
pub(crate) fn get_recovery_items(
    state: tauri::State<AppState>,
) -> Result<Vec<RecoveryItem>, String> {
    let conn = database(&state)?;
    db::recovery_items(&conn)
        .map_err(|_| "DB_ERROR".into())
}

#[tauri::command]
pub(crate) fn get_history(
    state: tauri::State<AppState>,
) -> Result<Vec<HistoryOperation>, String> {
    let conn = database(&state)?;
    db::history(&conn)
        .map_err(|_| "DB_ERROR".into())
}
