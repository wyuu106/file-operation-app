use crate::db;
use crate::model::{
    FileInfo, Fingerprint, ItemResult,
    OperationReport, PlanItem, Preview, Segment,
    Source, StoredPlan,
};
use crate::platform;
use chrono::Local;
use rusqlite::Connection;
use std::collections::HashSet;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use uuid::Uuid;

pub fn now() -> String {
    Local::now().to_rfc3339()
}

fn rename_message(
    error: &io::Error,
) -> &'static str {
    match error.kind() {
        io::ErrorKind::AlreadyExists => {
            "同じ名前のファイルがあるよ"
        }
        io::ErrorKind::PermissionDenied => {
            "ファイルやフォルダの権限を確認してね"
        }
        io::ErrorKind::NotFound => {
            "ファイルが見つからなかったよ"
        }
        _ => "ファイル名を変更できなかったよ",
    }
}

pub fn folder(
    path: &str,
) -> Result<PathBuf, String> {
    let canonical = Path::new(path)
        .canonicalize()
        .map_err(|_| "FOLDER_UNAVAILABLE")?;
    if !canonical.is_dir() {
        return Err("FOLDER_UNAVAILABLE".into());
    }
    Ok(canonical)
}

pub fn files(
    path: &str,
) -> Result<Vec<FileInfo>, String> {
    let folder = folder(path)?;
    let entries = fs::read_dir(folder)
        .map_err(|_| "FOLDER_UNAVAILABLE")?;
    let mut result = Vec::new();
    for entry in entries {
        let entry =
            entry.map_err(|_| "READ_FAILED")?;
        let metadata =
            fs::symlink_metadata(entry.path())
                .map_err(|_| "READ_FAILED")?;
        if !metadata.file_type().is_file() {
            continue;
        }
        if let Some(name) =
            entry.file_name().to_str()
        {
            if name.starts_with('.')
                || name.eq_ignore_ascii_case(
                    "desktop.ini",
                )
                || name.eq_ignore_ascii_case(
                    "Thumbs.db",
                )
            {
                continue;
            }
            result.push(FileInfo {
                name: name.to_owned(),
                size: metadata.len(),
            });
        }
    }
    result.sort_by(|a, b| {
        a.name
            .to_lowercase()
            .cmp(&b.name.to_lowercase())
            .then(a.name.cmp(&b.name))
    });
    Ok(result)
}

pub fn parse_segments(
    pattern: &str,
) -> Result<Vec<Segment>, String> {
    let segments: Vec<Segment> =
        serde_json::from_str(pattern)
            .map_err(|_| "BAD_TEMPLATE")?;
    if segments.is_empty() || segments.len() > 16
    {
        return Err("BAD_TEMPLATE".into());
    }
    for segment in &segments {
        match segment.kind.as_str() {
            "date" | "original" | "number" => {}
            "literal"
                if !segment
                    .value
                    .trim()
                    .is_empty()
                    && segment.value.len()
                        <= 100 => {}
            _ => {
                return Err("BAD_TEMPLATE".into())
            }
        }
    }
    Ok(segments)
}

fn fingerprint(
    path: &Path,
) -> Result<Fingerprint, String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|_| "SOURCE_CHANGED")?;
    if !metadata.file_type().is_file() {
        return Err("SOURCE_CHANGED".into());
    }
    let modified = metadata
        .modified()
        .ok()
        .and_then(|value| {
            value.duration_since(UNIX_EPOCH).ok()
        })
        .map(|value| value.as_nanos());
    #[cfg(target_os = "macos")]
    let file_id = {
        use std::os::unix::fs::MetadataExt;
        Some(format!(
            "{}:{}",
            metadata.dev(),
            metadata.ino(),
        ))
    };
    #[cfg(not(target_os = "macos"))]
    let file_id = None;
    Ok(Fingerprint {
        size: metadata.len(),
        modified,
        file_id,
    })
}

fn selected_name(name: &str) -> bool {
    !name.is_empty()
        && !name.contains('/')
        && !name.contains('\\')
        && name != "."
        && name != ".."
        && Path::new(name).components().count()
            == 1
}

fn stem(name: &str) -> String {
    Path::new(name)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(name)
        .to_owned()
}

fn extension(name: &str) -> Option<String> {
    Path::new(name)
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_owned)
}

fn generated_name(
    source: &str,
    segments: &[Segment],
    date: &str,
    index: usize,
) -> String {
    let parts: Vec<String> = segments
        .iter()
        .map(|segment| {
            match segment.kind.as_str() {
                "date" => date.to_owned(),
                "original" => stem(source),
                "number" => {
                    format!("{:03}", index)
                }
                "literal" => {
                    segment.value.clone()
                }
                _ => String::new(),
            }
        })
        .collect();
    let base = parts.join("_");
    match extension(source) {
        Some(ext) => format!("{}.{}", base, ext),
        None => base,
    }
}

pub fn create_plan(
    path: &str,
    selected: &[String],
    pattern: &str,
) -> Result<StoredPlan, String> {
    let folder = folder(path)?;
    let segments = parse_segments(pattern)?;
    if selected.is_empty() {
        return Err("NO_SELECTION".into());
    }
    let mut seen = HashSet::new();
    let mut sources = Vec::new();
    let mut generated = Vec::new();
    let date = Local::now()
        .format("%Y-%m-%d")
        .to_string();
    for (index, name) in
        selected.iter().enumerate()
    {
        if !selected_name(name)
            || !seen.insert(name.clone())
        {
            return Err("BAD_SELECTION".into());
        }
        let path = folder.join(name);
        sources.push(Source {
            name: name.clone(),
            fingerprint: fingerprint(&path)?,
            path,
        });
        generated.push(generated_name(
            name,
            &segments,
            &date,
            index + 1,
        ));
    }
    Ok(StoredPlan {
        id: Uuid::new_v4().to_string(),
        folder,
        sources,
        generated,
    })
}

fn target_error(
    name: &str,
) -> Option<&'static str> {
    if !selected_name(name)
        || name.trim().is_empty()
    {
        return Some("ファイル名を入力してね");
    }
    if name
        .chars()
        .any(|c| c == '\0' || c.is_control())
    {
        return Some(
            "使えない文字が含まれているよ",
        );
    }
    #[cfg(target_os = "macos")]
    if name.len() > 255 {
        return Some("ファイル名が長すぎるよ");
    }
    #[cfg(target_os = "windows")]
    {
        if name.encode_utf16().count() > 255 {
            return Some(
                "ファイル名が長すぎるよ",
            );
        }
        if name
            .chars()
            .any(|c| "<>:\"/\\|?*".contains(c))
            || name.ends_with([' ', '.'])
        {
            return Some(
                "Windowsで使えない名前だよ",
            );
        }
        let base = name
            .split('.')
            .next()
            .unwrap_or("")
            .to_ascii_uppercase();
        let reserved = [
            "CON", "PRN", "AUX", "NUL", "COM1",
            "COM2", "COM3", "COM4", "COM5",
            "COM6", "COM7", "COM8", "COM9",
            "LPT1", "LPT2", "LPT3", "LPT4",
            "LPT5", "LPT6", "LPT7", "LPT8",
            "LPT9",
        ];
        if reserved.contains(&base.as_str()) {
            return Some(
                "Windowsで使えない名前だよ",
            );
        }
    }
    None
}

pub fn preview(
    plan: &StoredPlan,
    targets: &[String],
) -> Preview {
    let mut items = Vec::new();
    let all_sources: HashSet<String> = plan
        .sources
        .iter()
        .map(|source| source.name.to_lowercase())
        .collect();
    let mut seen = HashSet::new();
    for (index, source) in
        plan.sources.iter().enumerate()
    {
        let target = targets
            .get(index)
            .cloned()
            .unwrap_or_default();
        let mut issues = Vec::new();
        if let Some(error) = target_error(&target)
        {
            issues.push(error.to_owned());
        } else {
            let key = target.to_lowercase();
            if !seen.insert(key.clone()) {
                issues.push(
                    "変更後の名前が重複しているよ".into()
                );
            }
            if key == source.name.to_lowercase() {
                issues.push(
                    "変更前と同じ名前だよ".into(),
                );
            } else if all_sources.contains(&key) {
                issues.push(
                    "別の対象ファイル名と重なるよ".into()
                );
            }
            if plan.folder.join(&target).exists()
            {
                issues.push(
                    "同じ名前のファイルがあるよ"
                        .into(),
                );
            }
        }
        if fingerprint(&source.path).ok()
            != Some(source.fingerprint.clone())
        {
            issues.push(
                "元のファイルが変更されたよ"
                    .into(),
            );
        }
        items.push(PlanItem {
            original_name: source.name.clone(),
            new_name: target,
            issues,
        });
    }
    let valid = targets.len()
        == plan.sources.len()
        && items
            .iter()
            .all(|item| item.issues.is_empty());
    Preview {
        id: plan.id.clone(),
        items,
        valid,
    }
}

pub fn execute(
    conn: &mut Connection,
    plan: &StoredPlan,
    targets: &[String],
) -> Result<OperationReport, String> {
    if !preview(plan, targets).valid {
        return Err("PLAN_INVALID".into());
    }
    let (operation_id, item_ids) =
        db::start_operation(
            conn,
            plan,
            targets,
            &now(),
        )
        .map_err(|_| "DB_ERROR")?;
    let mut moved = Vec::new();
    let mut failed = None;
    for (index, source) in
        plan.sources.iter().enumerate()
    {
        let target =
            plan.folder.join(&targets[index]);
        if fingerprint(&source.path).ok()
            != Some(source.fingerprint.clone())
        {
            failed = Some((
                index,
                "元のファイルが変更されたよ"
                    .to_owned(),
            ));
            break;
        }
        if let Err(error) =
            platform::rename_no_replace(
                &source.path,
                &target,
            )
        {
            failed = Some((
                index,
                rename_message(&error).to_owned(),
            ));
            break;
        }
        moved.push(index);
        if db::set_item_status(
            conn,
            item_ids[index],
            "moved",
        )
        .is_err()
        {
            failed = Some((
                index,
                "履歴を保存できなかったよ".into(),
            ));
            break;
        }
    }
    if let Some((index, message)) = failed {
        let mut items = vec![ItemResult {
            name: plan.sources[index]
                .name
                .clone(),
            message,
        }];
        let mut rolled_back = 0;
        for moved_index in moved.iter().rev() {
            let source =
                &plan.sources[*moved_index];
            let target = plan
                .folder
                .join(&targets[*moved_index]);
            let result = if fingerprint(&target)
                .ok()
                == Some(
                    source.fingerprint.clone(),
                ) {
                platform::rename_no_replace(
                    &target,
                    &source.path,
                )
            } else {
                Err(std::io::Error::other(
                    "file changed during rollback",
                ))
            };
            match result {
                Ok(()) => {
                    rolled_back += 1;
                    let _ = db::set_item_status(
                        conn,
                        item_ids[*moved_index],
                        "rolled_back",
                    );
                }
                Err(error) => {
                    items.push(ItemResult {
                        name: source.name.clone(),
                        message: rename_message(
                            &error,
                        )
                        .to_owned(),
                    });
                    let _ = db::set_item_status(
                        conn,
                        item_ids[*moved_index],
                        "needs_review",
                    );
                }
            }
        }
        let status = if moved.len() == rolled_back
        {
            "rolled_back"
        } else {
            "needs_review"
        };
        let _ = db::set_operation_status(
            conn,
            operation_id,
            status,
        );
        return Ok(OperationReport {
            succeeded: moved.len() - rolled_back,
            failed: 1,
            rolled_back,
            items,
        });
    }
    if db::set_operation_status(
        conn,
        operation_id,
        "completed",
    )
    .is_err()
    {
        return Ok(OperationReport {
            succeeded: moved.len(),
            failed: 1,
            rolled_back: 0,
            items: vec![ItemResult {
                name: "変更履歴".into(),
                message: "名前は変更されたけど、"
                    .to_owned()
                    + "履歴の確定に失敗したよ",
            }],
        });
    }
    Ok(OperationReport {
        succeeded: moved.len(),
        failed: 0,
        rolled_back: 0,
        items: Vec::new(),
    })
}

pub fn undo(
    conn: &Connection,
) -> Result<OperationReport, String> {
    let operation_id = db::last_completed(conn)
        .map_err(|_| "DB_ERROR")?
        .ok_or("NO_UNDO")?;
    let items =
        db::undo_items(conn, operation_id)
            .map_err(|_| "DB_ERROR")?;
    let mut issues = Vec::new();
    for item in &items {
        if item.original_path.exists() {
            issues.push(ItemResult {
                name: item
                    .original_path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .into_owned(),
                message:
                    "元の名前が使われているよ"
                        .into(),
            });
        }
        if fingerprint(&item.renamed_path).ok()
            != Some(item.fingerprint.clone())
        {
            issues.push(ItemResult {
                name: item
                    .renamed_path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .into_owned(),
                message:
                    "ファイルが移動・変更されたよ"
                        .into(),
            });
        }
    }
    if !issues.is_empty() {
        return Ok(OperationReport {
            succeeded: 0,
            failed: issues.len(),
            rolled_back: 0,
            items: issues,
        });
    }
    db::set_operation_status(
        conn,
        operation_id,
        "undo_in_progress",
    )
    .map_err(|_| "DB_ERROR")?;
    let mut restored = Vec::new();
    let mut failed = Vec::new();
    for item in &items {
        if let Err(error) =
            platform::rename_no_replace(
                &item.renamed_path,
                &item.original_path,
            )
        {
            failed.push(ItemResult {
                name: item
                    .renamed_path
                    .to_string_lossy()
                    .into_owned(),
                message: rename_message(&error)
                    .to_owned(),
            });
            break;
        }
        restored.push(item);
        let _ = db::set_item_status(
            conn, item.id, "undone",
        );
    }
    if !failed.is_empty() {
        let mut rolled_back = 0;
        for item in restored.iter().rev() {
            if fingerprint(&item.original_path)
                .ok()
                == Some(item.fingerprint.clone())
                && platform::rename_no_replace(
                    &item.original_path,
                    &item.renamed_path,
                )
                .is_ok()
            {
                rolled_back += 1;
                let _ = db::set_item_status(
                    conn, item.id, "moved",
                );
            } else {
                failed.push(ItemResult {
                    name: item
                        .original_path
                        .to_string_lossy()
                        .into_owned(),
                    message:
                        "取り消し中の変更を復旧"
                            .to_owned()
                            + "できなかったよ",
                });
            }
        }
        let status =
            if rolled_back == restored.len() {
                "completed"
            } else {
                "needs_review"
            };
        let _ = db::set_operation_status(
            conn,
            operation_id,
            status,
        );
        return Ok(OperationReport {
            succeeded: restored.len()
                - rolled_back,
            failed: 1,
            rolled_back,
            items: failed,
        });
    }
    if db::mark_undone(conn, operation_id, &now())
        .is_err()
    {
        return Ok(OperationReport {
            succeeded: restored.len(),
            failed: 1,
            rolled_back: 0,
            items: vec![ItemResult {
                name: "変更履歴".into(),
                message: "名前は戻ったけど、"
                    .to_owned()
                    + "履歴の確定に失敗したよ",
            }],
        });
    }
    Ok(OperationReport {
        succeeded: restored.len(),
        failed: 0,
        rolled_back: 0,
        items: Vec::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestFolder(PathBuf);

    impl TestFolder {
        fn new() -> Self {
            let path = std::env::temp_dir().join(
                format!(
                    "file-operation-test-{}",
                    Uuid::new_v4(),
                ),
            );
            fs::create_dir(&path)
                .expect("test folder");
            Self(path)
        }

        fn path(&self) -> String {
            self.0.to_string_lossy().into_owned()
        }

        fn file(&self, name: &str) -> PathBuf {
            self.0.join(name)
        }
    }

    impl Drop for TestFolder {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn pattern() -> &'static str {
        r#"[{"kind":"literal","value":"請求書"},
            {"kind":"number","value":""}]"#
    }

    #[test]
    fn preview_keeps_selection_order_and_files() {
        let test = TestFolder::new();
        fs::write(test.file("C.pdf"), b"C")
            .expect("C");
        fs::write(test.file("A.pdf"), b"A")
            .expect("A");
        let plan = create_plan(
            &test.path(),
            &["C.pdf".into(), "A.pdf".into()],
            pattern(),
        )
        .expect("plan");
        assert_eq!(
            plan.generated,
            ["請求書_001.pdf", "請求書_002.pdf"]
        );
        assert!(
            preview(&plan, &plan.generated,)
                .valid
        );
        assert!(test.file("C.pdf").exists());
        assert!(test.file("A.pdf").exists());
    }

    #[test]
    fn file_list_skips_system_metadata() {
        let test = TestFolder::new();
        fs::write(test.file("invoice.pdf"), b"x")
            .expect("invoice");
        fs::write(test.file(".DS_Store"), b"x")
            .expect("metadata");
        fs::write(test.file("desktop.ini"), b"x")
            .expect("metadata");
        let listed =
            files(&test.path()).expect("list");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].name, "invoice.pdf");
    }

    #[test]
    fn preview_rejects_duplicates_and_collision()
    {
        let test = TestFolder::new();
        fs::write(test.file("A.pdf"), b"A")
            .expect("A");
        fs::write(test.file("B.pdf"), b"B")
            .expect("B");
        fs::write(
            test.file("taken.pdf"),
            b"keep",
        )
        .expect("taken");
        let plan = create_plan(
            &test.path(),
            &["A.pdf".into(), "B.pdf".into()],
            pattern(),
        )
        .expect("plan");
        let targets = [
            "taken.pdf".into(),
            "taken.pdf".into(),
        ];
        assert!(!preview(&plan, &targets).valid);
        assert_eq!(
            fs::read(test.file("taken.pdf"))
                .expect("read"),
            b"keep",
        );
    }

    #[test]
    fn execute_and_undo_survive_reopen() {
        let test = TestFolder::new();
        fs::write(test.file("A.pdf"), b"data")
            .expect("A");
        let db_path =
            test.file("history.sqlite3");
        let mut conn = Connection::open(&db_path)
            .expect("db");
        db::init(&conn).expect("schema");
        let plan = create_plan(
            &test.path(),
            &["A.pdf".into()],
            pattern(),
        )
        .expect("plan");
        let renamed = plan.generated[0].clone();
        let report = execute(
            &mut conn,
            &plan,
            &plan.generated,
        )
        .expect("execute");
        assert_eq!(report.succeeded, 1);
        assert!(test.file(&renamed).exists());
        let history =
            db::history(&conn).expect("history");
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].changed_count, 1);
        assert_eq!(
            history[0].status,
            "completed"
        );
        assert_eq!(
            history[0].items[0].original_name,
            "A.pdf",
        );
        drop(conn);
        let conn = Connection::open(&db_path)
            .expect("reopen db");
        let result = undo(&conn).expect("undo");
        assert_eq!(result.succeeded, 1);
        assert!(test.file("A.pdf").exists());
        assert!(!test.file(&renamed).exists());
        let history =
            db::history(&conn).expect("history");
        assert_eq!(history[0].status, "undone");
        assert_eq!(history[0].changed_count, 1);
    }

    #[test]
    fn rename_never_overwrites_existing_file() {
        let test = TestFolder::new();
        fs::write(test.file("from.txt"), b"from")
            .expect("from");
        fs::write(test.file("to.txt"), b"keep")
            .expect("to");
        assert!(platform::rename_no_replace(
            &test.file("from.txt"),
            &test.file("to.txt"),
        )
        .is_err());
        assert_eq!(
            fs::read(test.file("to.txt"))
                .expect("read"),
            b"keep",
        );
    }

    #[test]
    fn changed_source_stops_execution() {
        let test = TestFolder::new();
        fs::write(test.file("A.pdf"), b"old")
            .expect("A");
        let mut conn =
            Connection::open_in_memory()
                .expect("db");
        db::init(&conn).expect("schema");
        let plan = create_plan(
            &test.path(),
            &["A.pdf".into()],
            pattern(),
        )
        .expect("plan");
        fs::write(
            test.file("A.pdf"),
            b"new data",
        )
        .expect("change");
        assert!(execute(
            &mut conn,
            &plan,
            &plan.generated,
        )
        .is_err());
        assert!(test.file("A.pdf").exists());
        assert!(!test
            .file(&plan.generated[0])
            .exists());
    }

    #[test]
    fn undo_collision_preserves_both_files() {
        let test = TestFolder::new();
        fs::write(test.file("A.pdf"), b"old")
            .expect("A");
        let mut conn =
            Connection::open_in_memory()
                .expect("db");
        db::init(&conn).expect("schema");
        let plan = create_plan(
            &test.path(),
            &["A.pdf".into()],
            pattern(),
        )
        .expect("plan");
        execute(
            &mut conn,
            &plan,
            &plan.generated,
        )
        .expect("execute");
        fs::write(test.file("A.pdf"), b"new")
            .expect("collision");
        let report = undo(&conn).expect("undo");
        assert_eq!(report.succeeded, 0);
        assert!(report.failed > 0);
        assert_eq!(
            fs::read(test.file("A.pdf"))
                .expect("original"),
            b"new",
        );
        assert_eq!(
            fs::read(
                test.file(&plan.generated[0])
            )
            .expect("renamed"),
            b"old",
        );
    }
}
