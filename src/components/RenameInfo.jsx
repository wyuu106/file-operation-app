/**
 * @param {{inputs:import('../api').RenameInput[],
 * fields:import('../api').InputField[],
 * onChange:(index:number,key:'company'|'name',
 * occurrence:number,value:string)=>void,
 * onAdd:()=>void,
 * onRemove:(index:number)=>void}} props
 */
export default function RenameInfo({
  inputs,
  fields,
  onChange,
  onAdd,
  onRemove,
}) {
  return (
    <section className="panel info-panel">
      <p className="eyebrow">STEP 2</p>
      <h2>ファイルごとの入力情報</h2>
      <p className="muted">
        この番号は、あとで選ぶファイルの
        選択順に対応します。（最大10件）
      </p>
      <div className="info-list">
        {inputs.map((input, index) => (
          <div className="info-row" key={index}>
            <strong className="order-pill">
              {index + 1}
            </strong>
            {fields.map((field) => (
              <label
                key={`${field.kind}-${field.index}`}
              >
                {field.label}
                <input
                  value={field.kind === "company"
                    ? input.companies[
                        field.index
                      ] ?? ""
                    : input.names[
                        field.index
                      ] ?? ""}
                  onChange={(event) =>
                    onChange(
                      index,
                      field.kind,
                      field.index,
                      event.target.value,
                    )
                  }
                  placeholder={field.kind ===
                    "company"
                    ? "例：A社"
                    : "例：太郎"}
                />
              </label>
            ))}
            <button
              className="ghost"
              aria-label={`${index + 1}件目を削除`}
              onClick={() => onRemove(index)}
            >
              削除
            </button>
          </div>
        ))}
      </div>
      <button
        className="secondary"
        disabled={inputs.length >= 10}
        onClick={onAdd}
      >
        ＋ 追加
      </button>
    </section>
  );
}
