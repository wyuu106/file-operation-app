mod commands;
mod database;
mod models;
mod repositories;
mod services;

use models::StoredPlan;
use repositories::db;
use rusqlite::Connection;
use std::fs;
use std::sync::Mutex;
use tauri::Manager;

struct AppState {
    db: Mutex<Connection>,
    plan: Mutex<Option<StoredPlan>>,
    operation: Mutex<()>,
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
            database::init(&conn)?;
            db::reconcile(&conn)?;
            app.manage(AppState {
                db: Mutex::new(conn),
                plan: Mutex::new(None),
                operation: Mutex::new(()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_files,
            commands::get_templates,
            commands::create_template,
            commands::update_template,
            commands::delete_template,
            commands::preview_rename,
            commands::validate_preview,
            commands::execute_rename,
            commands::undo_last_rename,
            commands::get_status,
            commands::get_recovery_items,
            commands::get_history,
        ])
        .run(tauri::generate_context!())
        .expect("failed to start app");
}
