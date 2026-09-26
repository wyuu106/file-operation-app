import FileSelection from "../components/FileSelection";
import RenameInfo from "../components/RenameInfo";
import { shownTime } from "../dateFormat";
import { formattedName } from "../components/template";

/** @param {string|undefined} value */
function shownCompany(value) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return "";
  }
  const plain = trimmed.startsWith("【") &&
    trimmed.endsWith("】")
    ? trimmed.slice(1, -1).trim()
    : trimmed;
  return plain ? `【${plain}】` : "";
}

/**
 * @param {{folder:string,
 * files:import('../api').FileInfo[],
 * selected:string[],
 * templates:import('../api').Template[],
 * templateId:number|null,
 * inputs:import('../api').RenameInput[],
 * useCompany:boolean,useName:boolean,
 * undoTarget:import('../api').HistoryOperation|undefined,
 * busy:boolean,onChooseFolder:()=>void,
 * onUndo:()=>void,onToggle:(name:string)=>void,
 * onSelectAll:()=>void,onClear:()=>void,
 * onTemplate:(id:number)=>void,
 * onInputChange:(index:number,key:'company'|'name',
 * value:string)=>void,onAddInput:()=>void,
 * onRemoveInput:(index:number)=>void,
 * onPreview:()=>void}} props
 */
export default function HomeView({
  folder,
  files,
  selected,
  templates,
  templateId,
  inputs,
  useCompany,
  useName,
  undoTarget,
  busy,
  onChooseFolder,
  onUndo,
  onToggle,
  onSelectAll,
  onClear,
  onTemplate,
  onInputChange,
  onAddInput,
  onRemoveInput,
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
          名前のルールを選んで、情報と
          ファイルを設定。変更前に確認できるよ。
        </p>
      </section>
      <section className="panel template-panel">
        <p className="eyebrow">STEP 1</p>
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
      {(useCompany || useName) && (
        <RenameInfo
          inputs={inputs}
          useCompany={useCompany}
          useName={useName}
          onChange={onInputChange}
          onAdd={onAddInput}
          onRemove={onRemoveInput}
        />
      )}
      <section className="panel folder-panel">
        <div>
          <p className="eyebrow">
            {useCompany || useName
              ? "STEP 3"
              : "STEP 2"}
          </p>
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
      {folder && (
        <FileSelection
          files={files}
          selected={selected}
          onToggle={onToggle}
          onSelectAll={onSelectAll}
          onClear={onClear}
        />
      )}
      {folder &&
        (useCompany || useName) &&
        selected.length > 0 && (
          <section className="panel mapping-panel">
            <h2>番号の対応</h2>
            <p className="muted">
              同じ番号どうしを組み合わせるよ。
            </p>
            {selected.map((name, index) => (
              <p key={name}>
                {index + 1}. {[
                  useCompany
                    ? shownCompany(
                        inputs[index]?.company,
                      )
                    : null,
                  useName
                    ? formattedName(
                        inputs[index]?.name,
                      )
                    : null,
                ]
                  .filter(Boolean)
                  .join(" / ") || "未入力"}
                {" ↔ "}{name}
              </p>
            ))}
          </section>
        )}
      {folder && (
        <div className="action-bar">
          <span className="muted">
            {selected.length}件を選択中
          </span>
          <button
            className="primary"
            disabled={
              busy ||
              !templateId
            }
            onClick={onPreview}
          >
            変更後の名前を見る →
          </button>
        </div>
      )}
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
    </>
  );
}
