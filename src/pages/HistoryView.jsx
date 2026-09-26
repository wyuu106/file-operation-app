import { shownTime } from "../dateFormat";

/** @type {Record<string, string>} */
const resultLabels = {
  completed: "正常完了",
  undone: "正常完了",
  rolled_back: "失敗（変更は元に戻した）",
  needs_review: "要確認",
};

/** @type {Record<string, string>} */
const itemLabels = {
  moved: "変更済み",
  undone: "取り消し済み",
  rolled_back: "元に戻した",
  needs_review: "要確認",
  unmoved: "変更前の名前で存在",
  uncertain: "状態を確認してね",
};

/**
 * @param {{history:import('../api').HistoryOperation[]}}
 * props
 */
export default function HistoryView({ history }) {
  return (
    <section className="panel history-panel">
      <p className="eyebrow">HISTORY</p>
      <h2>変更履歴</h2>
      <p className="muted small">
        過去の変更内容を確認できるよ。
      </p>
      {history.length === 0 ? (
        <div className="empty">
          まだ変更履歴はないよ
        </div>
      ) : (
        <div className="history-list">
          <div className="history-heading">
            <span>実行日時</span>
            <span>対象フォルダ</span>
            <span>件数</span>
            <span>処理結果</span>
            <span>Undo</span>
          </div>
          {history.map((operation) => (
            <details
              className="history-entry"
              key={operation.id}
            >
              <summary>
                <strong>
                  {shownTime(
                    operation.executedAt,
                  )}
                </strong>
                <span className="history-folder">
                  {operation.folder}
                </span>
                <span>
                  {operation.changedCount}件
                </span>
                <span>
                  {resultLabels[
                    operation.status
                  ] ?? "要確認"}
                </span>
                <span>
                  {operation.status === "undone"
                    ? "取り消し済み"
                    : operation.status ===
                        "completed"
                      ? "未取り消し"
                      : "—"}
                </span>
              </summary>
              <div className="history-details">
                {operation.items.map(
                  (item, index) => (
                    <div
                      className="history-item"
                      key={index}
                    >
                      <span>
                        {item.originalName}
                      </span>
                      <span aria-hidden="true">
                        →
                      </span>
                      <span>
                        {item.renamedName}
                      </span>
                      <small>
                        {itemLabels[
                          item.status
                        ] ?? "未処理"}
                      </small>
                    </div>
                  ),
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
