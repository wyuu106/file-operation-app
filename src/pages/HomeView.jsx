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
 * fields:import('../api').InputField[],
 * undoTarget:import('../api').HistoryOperation|undefined,
 * busy:boolean,onChooseFolder:()=>void,
 * onUndo:()=>void,onToggle:(name:string)=>void,
 * onClear:()=>void,
 * onTemplate:(id:number)=>void,
 * onInputChange:(index:number,key:'company'|'name',
 * occurrence:number,value:string)=>void,
 * onAddInput:()=>void,
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
  fields,
  undoTarget,
  busy,
  onChooseFolder,
  onUndo,
  onToggle,
  onClear,
  onTemplate,
  onInputChange,
  onAddInput,
  onRemoveInput,
  onPreview,
}) {
  return (
    <>
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
            テンプレート画面でファイル名のテンプレートを作成してください
          </div>
        )}
      </section>
      {fields.length > 0 && (
        <RenameInfo
          inputs={inputs}
          fields={fields}
          onChange={onInputChange}
          onAdd={onAddInput}
          onRemove={onRemoveInput}
        />
      )}
      <section className="panel folder-panel">
        <div>
          <p className="eyebrow">
            {fields.length
              ? "STEP 3"
              : "STEP 2"}
          </p>
          <h2>対象フォルダ</h2>
          <p className="muted path-label">
            {folder || "フォルダが選択されていません"}
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
          onClear={onClear}
        />
      )}
      {folder &&
        fields.length > 0 &&
        selected.length > 0 && (
          <section className="panel mapping-panel">
            <h2>ファイル名の対応</h2>
            {selected.map((name, index) => (
              <p key={name}>
                {index + 1}. {fields.map(
                  (field) => {
                    const value = field.kind ===
                      "company"
                      ? shownCompany(
                          inputs[index]
                            ?.companies[
                              field.index
                            ],
                        )
                      : formattedName(
                          inputs[index]
                            ?.names[
                              field.index
                            ],
                        );
                    return `${field.label}: ${
                      value || "未入力"
                    }`;
                  },
                ).join(" / ")}
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
              取り消せる変更がありません
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
