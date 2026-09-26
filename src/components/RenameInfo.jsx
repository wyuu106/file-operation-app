/**
 * @param {{inputs:import('../api').RenameInput[],
 * useCompany:boolean,useName:boolean,
 * onChange:(index:number,key:'company'|'name',
 * value:string)=>void,onAdd:()=>void,
 * onRemove:(index:number)=>void}} props
 */
export default function RenameInfo({
  inputs,
  useCompany,
  useName,
  onChange,
  onAdd,
  onRemove,
}) {
  return (
    <section className="panel info-panel">
      <p className="eyebrow">INFORMATION</p>
      <h2>ファイルごとの入力情報</h2>
      <p className="muted">
        この番号と、あとで選ぶファイルの
        番号が対応するよ。最大10件まで。
      </p>
      <div className="info-list">
        {inputs.map((input, index) => (
          <div className="info-row" key={index}>
            <strong className="order-pill">
              {index + 1}
            </strong>
            {useCompany && (
              <label>
                会社名
                <input
                  value={input.company}
                  onChange={(event) =>
                    onChange(
                      index,
                      "company",
                      event.target.value,
                    )
                  }
                  placeholder="例：A社"
                />
              </label>
            )}
            {useName && (
              <label>
                名前
                <input
                  value={input.name}
                  onChange={(event) =>
                    onChange(
                      index,
                      "name",
                      event.target.value,
                    )
                  }
                  placeholder="例：太郎"
                />
              </label>
            )}
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
