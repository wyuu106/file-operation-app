use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    pub name: String,
    pub size: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameTemplate {
    pub id: i64,
    pub name: String,
    pub pattern: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Deserialize)]
pub struct Segment {
    pub kind: String,
    #[serde(default)]
    pub value: String,
}

#[derive(Clone, Deserialize)]
pub struct RenameInput {
    #[serde(default)]
    pub company: String,
    #[serde(default)]
    pub name: String,
}

#[derive(
    Clone, Serialize, Deserialize, PartialEq,
)]
#[serde(rename_all = "camelCase")]
pub struct Fingerprint {
    pub size: u64,
    pub modified: Option<u128>,
    #[serde(default)]
    pub file_id: Option<String>,
}

#[derive(Clone)]
pub struct Source {
    pub name: String,
    pub path: PathBuf,
    pub fingerprint: Fingerprint,
}

#[derive(Clone)]
pub struct StoredPlan {
    pub id: String,
    pub folder: PathBuf,
    pub sources: Vec<Source>,
    pub generated: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanItem {
    pub original_name: String,
    pub new_name: String,
    pub extension: String,
    pub issues: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Preview {
    pub id: String,
    pub items: Vec<PlanItem>,
    pub valid: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemResult {
    pub name: String,
    pub message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationReport {
    pub succeeded: usize,
    pub failed: usize,
    pub rolled_back: usize,
    pub items: Vec<ItemResult>,
}

#[derive(Clone)]
pub struct UndoItem {
    pub id: i64,
    pub original_path: PathBuf,
    pub renamed_path: PathBuf,
    pub fingerprint: Fingerprint,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryItem {
    pub original_path: String,
    pub renamed_path: String,
    pub status: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryItem {
    pub original_name: String,
    pub renamed_name: String,
    pub status: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryOperation {
    pub id: i64,
    pub executed_at: String,
    pub folder: String,
    pub changed_count: usize,
    pub status: String,
    pub undone_at: Option<String>,
    pub items: Vec<HistoryItem>,
}
