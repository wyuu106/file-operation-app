/**
 * @param {{files:import('../api').FileInfo[],
 * selected:string[],onToggle:(name:string)=>void,
 * onSelectAll:()=>void,
 * onClear:()=>void}} props
 */
export default function FileSelection({
  files,
  selected,
  onToggle,
  onSelectAll,
  onClear,
}) {
  return (
    <section className="panel file-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">FILES</p>
          <h2>変更するファイル</h2>
        </div>
        <span className="count-pill">
          {selected.length}件選択中
        </span>
      </div>
      <div className="file-toolbar">
        <button
          onClick={onSelectAll}
          disabled={!files.length}
        >
          すべて選択
        </button>
        <button
          onClick={onClear}
          disabled={!selected.length}
        >
          選択を解除
        </button>
        <span>
          一括選択はファイル名の順に番号が付くよ
        </span>
      </div>
      {files.length ? (
        <div className="file-list">
          {files.map((file) => {
            const index = selected.indexOf(
              file.name,
            );
            return (
              <label
                className="file-row"
                key={file.name}
              >
                <input
                  type="checkbox"
                  checked={index >= 0}
                  onChange={() =>
                    onToggle(file.name)
                  }
                />
                <span className="file-icon">
                  ▤
                </span>
                <span
                  className="file-name"
                  title={file.name}
                >
                  {file.name}
                </span>
                {index >= 0 && (
                  <span className="order-pill">
                    {index + 1}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          このフォルダにファイルはないよ
        </div>
      )}
    </section>
  );
}
