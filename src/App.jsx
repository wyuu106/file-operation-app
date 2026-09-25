import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import * as api from "./api";
import { userMessage } from "./errors";
import FileSelection from "./FileSelection";
import RenamePreview from "./RenamePreview";
import TemplateEditor from "./TemplateEditor";

const collator = new Intl.Collator("ja", {
  numeric: true,
  sensitivity: "base",
});

const recoveryLabels = {
  moved: "変更後の名前で存在",
  unmoved: "変更前の名前で存在",
  uncertain: "状態を確認できない",
  needs_review: "確認が必要",
};

export default function App() {
  const [folder, setFolder] = useState("");
  const [files, setFiles] = useState(
    /** @type {api.FileInfo[]} */ ([]),
  );
  const [selected, setSelected] = useState(
    /** @type {string[]} */ ([]),
  );
  const [templates, setTemplates] = useState(
    /** @type {api.Template[]} */ ([]),
  );
  const [templateId, setTemplateId] = useState(
    /** @type {number|null} */ (null),
  );
  const [editing, setEditing] = useState(
    /** @type {api.Template|null|undefined} */
    (undefined),
  );
  const [preview, setPreview] = useState(
    /** @type {api.Preview|null} */ (null),
  );
  const [targets, setTargets] = useState(
    /** @type {string[]} */ ([]),
  );
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [report, setReport] = useState(
    /** @type {api.Report|null} */ (null),
  );
  const [canUndo, setCanUndo] = useState(false);
  const [reviewCount, setReviewCount] =
    useState(0);
  const [recoveryItems, setRecoveryItems] =
    useState(
      /** @type {api.RecoveryItem[]} */ ([]),
    );

  async function refreshStatus() {
    const [undo, review] = await api.getStatus();
    setCanUndo(undo);
    setReviewCount(review);
    setRecoveryItems(
      review ? await api.getRecoveryItems() : [],
    );
  }

  async function refreshTemplates() {
    const list = await api.getTemplates();
    setTemplates(list);
    setTemplateId((current) =>
      list.some((item) => item.id === current)
        ? current
        : (list[0]?.id ?? null),
    );
  }

  useEffect(() => {
    Promise.all([
      refreshTemplates(),
      refreshStatus(),
    ]).catch((caught) => {
      setError(userMessage(caught));
    });
  }, []);

  useEffect(() => {
    if (!preview) {
      return;
    }
    let active = true;
    setChecking(true);
    const timer = setTimeout(() => {
      api
        .validatePreview(preview.id, targets)
        .then((result) => {
          if (active) {
            setPreview(result);
            setChecking(false);
          }
        })
        .catch((caught) => {
          if (active) {
            setError(userMessage(caught));
            setChecking(false);
          }
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [targets, preview?.id]);

  async function chooseFolder() {
    setError("");
    try {
      const path = await open({
        directory: true,
        multiple: false,
      });
      if (!path || Array.isArray(path)) {
        return;
      }
      setBusy(true);
      const entries = await api.getFiles(path);
      setFolder(path);
      setFiles(entries);
      setSelected([]);
      setPreview(null);
      setReport(null);
      setNotice("");
    } catch (caught) {
      setError(userMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  /** @param {string} name */
  function toggle(name) {
    setSelected((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name],
    );
    setPreview(null);
  }

  function selectAll() {
    const names = files.map((file) => file.name);
    names.sort(
      (a, b) =>
        collator.compare(a, b) ||
        a.localeCompare(b),
    );
    setSelected(names);
    setPreview(null);
  }

  function clearSelection() {
    setSelected([]);
    setPreview(null);
  }

  /**
   * @param {string} name
   * @param {api.Segment[]} segments
   */
  async function saveTemplate(name, segments) {
    setError("");
    try {
      const saved = editing
        ? await api.updateTemplate(
            editing.id,
            name,
            segments,
          )
        : await api.createTemplate(
            name,
            segments,
          );
      await refreshTemplates();
      setTemplateId(saved.id);
      setEditing(undefined);
      setPreview(null);
      setNotice("テンプレートを保存したよ");
    } catch (caught) {
      setError(userMessage(caught));
    }
  }

  /** @param {api.Template} template */
  async function removeTemplate(template) {
    if (
      !window.confirm(
        `「${template.name}」を削除する？`,
      )
    ) {
      return;
    }
    setError("");
    try {
      await api.deleteTemplate(template.id);
      await refreshTemplates();
      setPreview(null);
      setNotice("テンプレートを削除したよ");
    } catch (caught) {
      setError(userMessage(caught));
    }
  }

  async function makePreview() {
    if (
      !folder ||
      !templateId ||
      !selected.length
    ) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api.previewRename(
        folder,
        selected,
        templateId,
      );
      setTargets(
        result.items.map((item) => item.newName),
      );
      setPreview(result);
      setReport(null);
    } catch (caught) {
      setError(userMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  /**
   * @param {number} index
   * @param {string} value
   */
  function setTarget(index, value) {
    setPreview((current) =>
      current
        ? { ...current, valid: false }
        : current,
    );
    setTargets((current) => {
      const copy = [...current];
      copy[index] = value;
      return copy;
    });
  }

  async function execute() {
    if (!preview || checking || !preview.valid) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api.executeRename(
        preview.id,
        targets,
      );
      setReport(result);
      setPreview(null);
      setFiles(await api.getFiles(folder));
      setSelected([]);
      await refreshStatus();
      setNotice(
        result.failed
          ? "処理の一部を確認してね"
          : `${result.succeeded}件の名前を変更したよ`,
      );
    } catch (caught) {
      setError(userMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    setBusy(true);
    setError("");
    try {
      const result = await api.undoLastRename();
      setReport(result);
      if (folder) {
        setFiles(await api.getFiles(folder));
      }
      await refreshStatus();
      setNotice(
        result.failed
          ? "取り消せなかったファイルがあるよ"
          : `${result.succeeded}件を元の名前に戻したよ`,
      );
    } catch (caught) {
      setError(userMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">▤</div>
          <div>
            <p className="eyebrow">FILE DESK</p>
            <h1>ファイル名整理</h1>
          </div>
        </div>
        <button
          className="ghost"
          disabled={!canUndo || busy}
          onClick={undo}
        >
          ↶ 直前の変更を取り消す
        </button>
      </header>

      <main>
        <section className="hero">
          <p className="eyebrow">
            かんたん、一括整理
          </p>
          <h2>
            いつものファイル名変更を、
            まとめて終わらせよう。
          </h2>
          <p>
            フォルダを選んで、名前を確認。
            あとは一度に変更できるよ。
          </p>
        </section>

        {reviewCount > 0 && (
          <div className="banner warning">
            前回の処理に未確認の履歴が
            {reviewCount}件あるよ。
            対象フォルダの状態を確認してね。
            <details>
              <summary>
                対象ファイルを見る
              </summary>
              {recoveryItems.map(
                (item, index) => (
                  <p key={index}>
                    {item.originalPath} →
                    {item.renamedPath}（
                    {recoveryLabels[
                      /** @type {keyof typeof recoveryLabels} */
                      (item.status)
                    ] ?? "確認が必要"}
                    ）
                  </p>
                ),
              )}
            </details>
          </div>
        )}
        {error && (
          <div
            className="banner error"
            role="alert"
          >
            {error}
          </div>
        )}
        {notice && (
          <div
            className="banner success"
            role="status"
          >
            {notice}
          </div>
        )}

        <div className="workflow">
          <span className="step active">
            1 フォルダ
          </span>
          <span className="step">
            2 テンプレート
          </span>
          <span className="step">
            3 プレビュー
          </span>
          <span className="step">4 完了</span>
        </div>

        <section className="panel folder-panel">
          <div>
            <p className="eyebrow">FOLDER</p>
            <h2>対象フォルダ</h2>
            <p className="muted path-label">
              {folder || "まだ選択されていないよ"}
            </p>
          </div>
          <button
            className="secondary"
            disabled={busy}
            onClick={chooseFolder}
          >
            フォルダを選ぶ
          </button>
        </section>

        <div className="main-grid">
          {folder && !preview && (
            <FileSelection
              files={files}
              selected={selected}
              onToggle={toggle}
              onSelectAll={selectAll}
              onClear={clearSelection}
            />
          )}

          <section className="panel template-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">
                  TEMPLATES
                </p>
                <h2>名前のルール</h2>
              </div>
              <button
                className="text-button"
                onClick={() => setEditing(null)}
              >
                ＋ 新しく作る
              </button>
            </div>
            {templates.length ? (
              <div className="template-list">
                {templates.map((template) => (
                  <div
                    className="template-row"
                    key={template.id}
                  >
                    <label>
                      <input
                        type="radio"
                        name="template"
                        checked={
                          templateId ===
                          template.id
                        }
                        onChange={() => {
                          setTemplateId(
                            template.id,
                          );
                          setPreview(null);
                        }}
                      />
                      <span>{template.name}</span>
                    </label>
                    <div className="template-actions">
                      <button
                        onClick={() =>
                          setEditing(template)
                        }
                      >
                        編集
                      </button>
                      <button
                        onClick={() =>
                          removeTemplate(template)
                        }
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">
                テンプレートを作ると、
                次回から同じルールを使えるよ
              </div>
            )}
          </section>
        </div>

        {editing !== undefined && (
          <TemplateEditor
            template={editing}
            onSave={saveTemplate}
            onCancel={() => setEditing(undefined)}
          />
        )}

        {!preview && folder && (
          <div className="action-bar">
            <span className="muted">
              {selected.length}
              件のファイルを選択中
            </span>
            <button
              className="primary"
              disabled={
                busy ||
                !selected.length ||
                !templateId
              }
              onClick={makePreview}
            >
              変更後の名前を見る →
            </button>
          </div>
        )}

        {preview && (
          <RenamePreview
            preview={preview}
            targets={targets}
            checking={checking}
            onTarget={setTarget}
            onExecute={execute}
            onBack={() => setPreview(null)}
            busy={busy}
          />
        )}

        {report && (
          <section className="panel result-panel">
            <p className="eyebrow">RESULT</p>
            <h2>処理結果</h2>
            <p>
              成功 {report.succeeded}件 · 失敗{" "}
              {report.failed}件 ·
              元に戻したファイル
              {report.rolledBack}件
            </p>
            {report.items.map((item, index) => (
              <p
                className="result-issue"
                key={`${item.name}-${index}`}
              >
                {item.name}：{item.message}
              </p>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
