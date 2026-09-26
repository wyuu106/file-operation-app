import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import * as api from "./api";
import { userMessage } from "./errors";
import RenamePreview from "./pages/RenamePreview";
import HistoryView from "./pages/HistoryView";
import HomeView from "./pages/HomeView";
import TemplatesView from "./pages/TemplatesView";
import {
  formattedName,
  readPattern,
} from "./components/template";

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
  const [screen, setScreen] = useState(
    /** @type {'home'|'templates'|'history'} */
    ("home"),
  );
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
  const [inputs, setInputs] = useState(
    /** @type {api.RenameInput[]} */
    ([{ company: "", name: "" }]),
  );
  const [countMismatch, setCountMismatch] =
    useState(false);
  const [editing, setEditing] = useState(
    /** @type {api.Template|null|undefined} */
    (undefined),
  );
  const [templateToDelete, setTemplateToDelete] =
    useState(
      /** @type {api.Template|null} */ (null),
    );
  const [preview, setPreview] = useState(
    /** @type {api.Preview|null} */ (null),
  );
  const [targets, setTargets] = useState(
    /** @type {string[]} */ ([]),
  );
  const [checking, setChecking] = useState(false);
  const [confirmLeaving, setConfirmLeaving] =
    useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [report, setReport] = useState(
    /** @type {api.Report|null} */ (null),
  );
  const [history, setHistory] = useState(
    /** @type {api.HistoryOperation[]} */ ([]),
  );
  const [reviewCount, setReviewCount] =
    useState(0);
  const [recoveryItems, setRecoveryItems] =
    useState(
      /** @type {api.RecoveryItem[]} */ ([]),
    );

  async function refreshStatus() {
    const [, review] = await api.getStatus();
    setReviewCount(review);
    setRecoveryItems(
      review ? await api.getRecoveryItems() : [],
    );
  }

  async function refreshHistory() {
    setHistory(await api.getHistory());
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

  const activeTemplate = templates.find(
    (item) => item.id === templateId,
  );
  const segments = activeTemplate
    ? readPattern(activeTemplate.pattern)
    : [];
  const useCompany = segments.some(
    (item) => item.kind === "company",
  );
  const useName = segments.some(
    (item) => item.kind === "name",
  );

  /** @param {number} id */
  function chooseTemplate(id) {
    setTemplateId(id);
    setInputs([{ company: "", name: "" }]);
    setPreview(null);
  }

  /** @param {number} index
   * @param {'company'|'name'} key
   * @param {string} value */
  function changeInput(index, key, value) {
    setInputs((current) =>
      current.map((input, at) =>
        at === index
          ? { ...input, [key]: value }
          : input,
      ),
    );
  }

  useEffect(() => {
    Promise.all([
      refreshTemplates(),
      refreshStatus(),
      refreshHistory(),
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
      setConfirmLeaving(false);
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
      setInputs([{ company: "", name: "" }]);
      setEditing(undefined);
      setPreview(null);
      setConfirmLeaving(false);
      setNotice("テンプレートを保存したよ");
    } catch (caught) {
      setError(userMessage(caught));
    }
  }

  /** @param {api.Template} template */
  async function removeTemplate(template) {
    setError("");
    try {
      await api.deleteTemplate(template.id);
      await refreshTemplates();
      setPreview(null);
      setTemplateToDelete(null);
      setNotice("テンプレートを削除したよ");
    } catch (caught) {
      setError(userMessage(caught));
    }
  }

  async function makePreview() {
    if (!folder || !templateId) {
      return;
    }
    if (
      (useCompany || useName) &&
      inputs.length !== selected.length
    ) {
      setCountMismatch(true);
      return;
    }
    if (!selected.length) {
      setError(userMessage("NO_SELECTION"));
      return;
    }
    if (
      (useCompany || useName) &&
      inputs.some(
        (input) =>
          (useCompany &&
            !input.company.trim()) ||
          (useName &&
            !formattedName(input.name)),
      )
    ) {
      setError(userMessage("BAD_INPUT"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api.previewRename(
        folder,
        selected,
        templateId,
        useCompany || useName ? inputs : [],
      );
      setTargets(
        result.items.map((item) => item.newName),
      );
      setPreview(result);
      setScreen("home");
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
      await refreshHistory();
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
      await refreshHistory();
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

  const undoTarget = history.find(
    (item) => item.status === "completed",
  );

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
      </header>

      <main>
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

        {!preview && screen === "home" && (
          <HomeView
            folder={folder}
            files={files}
            selected={selected}
            templates={templates}
            templateId={templateId}
            inputs={inputs}
            useCompany={useCompany}
            useName={useName}
            undoTarget={undoTarget}
            busy={busy}
            onChooseFolder={chooseFolder}
            onUndo={undo}
            onToggle={toggle}
            onSelectAll={selectAll}
            onClear={clearSelection}
            onTemplate={chooseTemplate}
            onInputChange={changeInput}
            onAddInput={() =>
              setInputs((current) =>
                current.length < 10
                  ? [
                      ...current,
                      { company: "", name: "" },
                    ]
                  : current,
              )
            }
            onRemoveInput={(index) =>
              setInputs((current) =>
                current.filter((_, at) =>
                  at !== index,
                ),
              )
            }
            onPreview={makePreview}
          />
        )}

        {!preview && screen === "templates" && (
          <TemplatesView
            templates={templates}
            editing={editing}
            onEdit={setEditing}
            onDelete={setTemplateToDelete}
            onSave={saveTemplate}
          />
        )}

        {!preview && screen === "history" && (
          <HistoryView history={history} />
        )}

        {preview && (
          <RenamePreview
            preview={preview}
            targets={targets}
            checking={checking}
            onTarget={setTarget}
            onExecute={execute}
            onBack={() => setConfirmLeaving(true)}
            busy={busy}
          />
        )}

        {preview && confirmLeaving && (
          <div className="dialog-backdrop">
            <section
              className="confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="leave-title"
            >
              <h2 id="leave-title">
                プレビューを破棄
              </h2>
              <p>
                現在のプレビューは破棄されますが、
                画面を移動しますか？
              </p>
              <div className="dialog-actions">
                <button
                  className="ghost"
                  autoFocus
                  onClick={() =>
                    setConfirmLeaving(false)
                  }
                >
                  キャンセル
                </button>
                <button
                  className="primary"
                  onClick={() => {
                    setPreview(null);
                    setConfirmLeaving(false);
                  }}
                >
                  破棄して戻る
                </button>
              </div>
            </section>
          </div>
        )}

        {countMismatch && (
          <div className="dialog-backdrop">
            <section
              className="confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="count-title"
            >
              <h2 id="count-title">
                件数が一致しないよ
              </h2>
              <p>
                入力した情報と選択した
                ファイルの数が一致しません。
              </p>
              <p>入力情報：{inputs.length}件</p>
              <p>
                選択ファイル：{selected.length}件
              </p>
              <p>
                同じ数になるように設定してね。
              </p>
              <div className="dialog-actions">
                <button
                  className="primary"
                  autoFocus
                  onClick={() =>
                    setCountMismatch(false)
                  }
                >
                  閉じる
                </button>
              </div>
            </section>
          </div>
        )}

        {templateToDelete && (
          <div className="dialog-backdrop">
            <section
              className="confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-title"
            >
              <h2 id="delete-title">
                テンプレートを削除
              </h2>
              <p>
                「{templateToDelete.name}」を
                削除する？
              </p>
              <div className="dialog-actions">
                <button
                  className="ghost"
                  autoFocus
                  onClick={() =>
                    setTemplateToDelete(null)
                  }
                >
                  キャンセル
                </button>
                <button
                  className="primary danger"
                  onClick={() =>
                    removeTemplate(
                      templateToDelete,
                    )
                  }
                >
                  削除する
                </button>
              </div>
            </section>
          </div>
        )}

        {!preview &&
          screen === "home" &&
          report && (
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
      {!preview && (
        <nav
          className="bottom-nav"
          aria-label="画面の切り替え"
        >
          {[
            ["home", "ホーム"],
            ["templates", "テンプレート"],
            ["history", "変更履歴"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={
                screen === key ? "active" : ""
              }
              aria-current={
                screen === key
                  ? "page"
                  : undefined
              }
              onClick={() => {
                setScreen(
                  /** @type {typeof screen} */
                  (key),
                );
                setError("");
                setNotice("");
              }}
            >
              {label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
