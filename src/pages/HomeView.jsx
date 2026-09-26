import FileSelection from "../components/FileSelection";
import { shownTime } from "../dateFormat";

/**
 * @param {{folder:string,
 * files:import('../api').FileInfo[],
 * selected:string[],
 * templates:import('../api').Template[],
 * templateId:number|null,
 * undoTarget:import('../api').HistoryOperation|undefined,
 * busy:boolean,onChooseFolder:()=>void,
 * onUndo:()=>void,onToggle:(name:string)=>void,
 * onSelectAll:()=>void,onClear:()=>void,
 * onTemplate:(id:number)=>void,
 * onPreview:()=>void}} props
 */
export default function HomeView({
  folder,
  files,
  selected,
  templates,
  templateId,
  undoTarget,
  busy,
  onChooseFolder,
  onUndo,
  onToggle,
  onSelectAll,
  onClear,
  onTemplate,
  onPreview,
}) {
  return (
    <>
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
          onClick={onChooseFolder}
        >
          フォルダを選ぶ
        </button>
      </section>
      <section className="panel undo-panel">
        <div>
          <p className="eyebrow">UNDO</p>
          <h2>直前の変更</h2>
          {undoTarget ? (
            <>
              <p>
                {shownTime(undoTarget.executedAt)}
                ・{undoTarget.changedCount}件
              </p>
              <p className="muted path-label">
                {undoTarget.folder}
              </p>
            </>
          ) : (
            <p className="muted">
              取り消せる変更はないよ
            </p>
          )}
        </div>
        <button
          className="ghost"
          disabled={!undoTarget || busy}
          onClick={onUndo}
        >
          変更を元に戻す
        </button>
      </section>
      <div className="main-grid">
        {folder && (
          <FileSelection
            files={files}
            selected={selected}
            onToggle={onToggle}
            onSelectAll={onSelectAll}
            onClear={onClear}
          />
        )}
        <section className="panel template-panel">
          <p className="eyebrow">TEMPLATES</p>
          <h2>名前のルール</h2>
          {templates.length ? (
            <div className="template-list">
              {templates.map((template) => (
                <label
                  className="template-row"
                  key={template.id}
                >
                  <input
                    type="radio"
                    name="template"
                    checked={
                      templateId === template.id
                    }
                    onChange={() =>
                      onTemplate(template.id)
                    }
                  />
                  <span>{template.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="empty">
              テンプレート画面で
              名前のルールを作ってね
            </div>
          )}
        </section>
      </div>
      {folder && (
        <div className="action-bar">
          <span className="muted">
            {selected.length}件を選択中
          </span>
          <button
            className="primary"
            disabled={
              busy ||
              !selected.length ||
              !templateId
            }
            onClick={onPreview}
          >
            変更後の名前を見る →
          </button>
        </div>
      )}
    </>
  );
}
