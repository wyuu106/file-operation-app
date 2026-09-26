/**
 * @param {{preview:import('../api').Preview,
 * targets:string[],checking:boolean,
 * onTarget:(index:number,value:string)=>void,
 * onExecute:()=>void,onBack:()=>void,
 * busy:boolean}} props
 */
export default function RenamePreview({
  preview,
  targets,
  checking,
  onTarget,
  onExecute,
  onBack,
  busy,
}) {
  return (
    <section className="panel preview-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">PREVIEW</p>
          <h2>変更後の名前を確認</h2>
        </div>
        <button
          className="text-button"
          onClick={onBack}
          disabled={busy}
        >
          選択に戻る
        </button>
      </div>
      <p className="muted">
        必要な行だけ直接直せるよ。
        実行するまではファイルは変わらない。
      </p>
      <div className="preview-list">
        {preview.items.map((item, index) => (
          <div
            className="preview-row"
            key={item.originalName}
          >
            <div className="preview-number">
              {String(index + 1).padStart(2, "0")}
            </div>
            <div className="preview-name">
              <small>変更前</small>
              <span>{item.originalName}</span>
            </div>
            <div className="preview-arrow">→</div>
            <div className="preview-input">
              <label htmlFor={`target-${index}`}>
                変更後
              </label>
              <input
                id={`target-${index}`}
                value={targets[index] ?? ""}
                onChange={(event) =>
                  onTarget(
                    index,
                    event.target.value,
                  )
                }
                aria-invalid={
                  item.issues.length > 0
                }
              />
              {item.issues.map((issue) => (
                <span
                  className="field-error"
                  key={issue}
                >
                  {issue}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="preview-footer">
        <span className="muted">
          {checking
            ? "名前を確認中…"
            : preview.valid
              ? `${preview.items.length}件を変更できるよ`
              : "問題のある名前を直してね"}
        </span>
        <button
          className="primary danger"
          onClick={onExecute}
          disabled={
            busy || checking || !preview.valid
          }
        >
          {busy ? "変更中…" : "この内容で変更"}
        </button>
      </div>
    </section>
  );
}
