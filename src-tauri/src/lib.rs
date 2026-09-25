mod db;
mod model;
mod operations;
mod platform;

use model::{
    FileInfo, HistoryOperation, OperationReport,
    Preview, RecoveryItem, RenameTemplate,
    StoredPlan,
};
use rusqlite::Connection;
use std::fs;
use std::sync::Mutex;
use tauri::Manager;

struct AppState {
    db: Mutex<Connection>,
    plan: Mutex<Option<StoredPlan>>,
    operation: Mutex<()>,
}

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
fn get_files(
    path: String,
) -> Result<Vec<FileInfo>, String> {
    operations::files(&path)
}

#[tauri::command]
fn get_templates(
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
fn create_template(
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
fn update_template(
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
fn delete_template(
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
fn preview_rename(
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
fn validate_preview(
    state: tauri::State<AppState>,
    plan_id: String,
    targets: Vec<String>,
) -> Result<Preview, String> {
    let plan = stored_plan(&state, &plan_id)?;
    Ok(operations::preview(&plan, &targets))
}

#[tauri::command]
fn execute_rename(
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
fn undo_last_rename(
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
fn get_status(
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
fn get_recovery_items(
    state: tauri::State<AppState>,
) -> Result<Vec<RecoveryItem>, String> {
    let conn = database(&state)?;
    db::recovery_items(&conn)
        .map_err(|_| "DB_ERROR".into())
}

#[tauri::command]
fn get_history(
    state: tauri::State<AppState>,
) -> Result<Vec<HistoryOperation>, String> {
    let conn = database(&state)?;
    db::history(&conn)
        .map_err(|_| "DB_ERROR".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_local_data_dir()?;
            fs::create_dir_all(&data_dir)?;
            let conn = Connection::open(
                data_dir.join("rename.sqlite3"),
            )?;
            db::init(&conn)?;
            db::reconcile(&conn)?;
            app.manage(AppState {
                db: Mutex::new(conn),
                plan: Mutex::new(None),
                operation: Mutex::new(()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_files,
            get_templates,
            create_template,
            update_template,
            delete_template,
            preview_rename,
            validate_preview,
            execute_rename,
            undo_last_rename,
            get_status,
            get_recovery_items,
            get_history,
        ])
        .run(tauri::generate_context!())
        .expect("failed to start app");
}
