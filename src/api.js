import { invoke } from "@tauri-apps/api/core";

/**
 * @typedef {{name:string,size:number}} FileInfo
 * @typedef {{id:number,name:string,pattern:string,
 * createdAt:string,updatedAt:string}} Template
 * @typedef {{kind:string,value:string}} Segment
 * @typedef {{company:string,name:string}} RenameInput
 * @typedef {{originalName:string,newName:string,
 * extension:string,issues:string[]}} PlanItem
 * @typedef {{id:string,items:PlanItem[],
 * valid:boolean}} Preview
 * @typedef {{name:string,message:string}} ItemResult
 * @typedef {{succeeded:number,failed:number,
 * rolledBack:number,items:ItemResult[]}} Report
 * @typedef {{originalPath:string,renamedPath:string,
 * status:string}} RecoveryItem
 * @typedef {{originalName:string,
 * renamedName:string,status:string}} HistoryItem
 * @typedef {{id:number,executedAt:string,
 * folder:string,changedCount:number,
 * status:string,undoneAt:string|null,
 * items:HistoryItem[]}} HistoryOperation
 */

/**
 * @param {string} path
 * @returns {Promise<FileInfo[]>}
 */
export function getFiles(path) {
  return invoke("get_files", { path });
}

/** @returns {Promise<Template[]>} */
export function getTemplates() {
  return invoke("get_templates");
}

/**
 * @param {string} name
 * @param {Segment[]} segments
 * @returns {Promise<Template>}
 */
export function createTemplate(name, segments) {
  return invoke("create_template", {
    name,
    pattern: JSON.stringify(segments),
  });
}

/**
 * @param {number} id
 * @param {string} name
 * @param {Segment[]} segments
 * @returns {Promise<Template>}
 */
export function updateTemplate(
  id,
  name,
  segments,
) {
  return invoke("update_template", {
    id,
    name,
    pattern: JSON.stringify(segments),
  });
}

/**
 * @param {number} id
 * @returns {Promise<void>}
 */
export function deleteTemplate(id) {
  return invoke("delete_template", { id });
}

/**
 * @param {string} path
 * @param {string[]} selected
 * @param {number} templateId
 * @param {RenameInput[]} inputs
 * @returns {Promise<Preview>}
 */
export function previewRename(
  path,
  selected,
  templateId,
  inputs,
) {
  return invoke("preview_rename", {
    path,
    selected,
    templateId,
    inputs,
  });
}

/**
 * @param {string} planId
 * @param {string[]} targets
 * @returns {Promise<Preview>}
 */
export function validatePreview(planId, targets) {
  return invoke("validate_preview", {
    planId,
    targets,
  });
}

/**
 * @param {string} planId
 * @param {string[]} targets
 * @returns {Promise<Report>}
 */
export function executeRename(planId, targets) {
  return invoke("execute_rename", {
    planId,
    targets,
  });
}

/** @returns {Promise<Report>} */
export function undoLastRename() {
  return invoke("undo_last_rename");
}

/** @returns {Promise<[boolean, number]>} */
export function getStatus() {
  return invoke("get_status");
}

/** @returns {Promise<RecoveryItem[]>} */
export function getRecoveryItems() {
  return invoke("get_recovery_items");
}

/** @returns {Promise<HistoryOperation[]>} */
export function getHistory() {
  return invoke("get_history");
}
