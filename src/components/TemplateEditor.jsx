import { useEffect, useState } from "react";
import {
  defaultSegments,
  exampleName,
  labels,
  readPattern,
} from "./template";

/**
 * @param {{template:import('../api').Template|null,
 * onSave:(name:string,
 * segments:import('../api').Segment[])=>Promise<void>,
 * onCancel:()=>void}} props
 */
export default function TemplateEditor({
  template,
  onSave,
  onCancel,
}) {
  const [name, setName] = useState("");
  const [segments, setSegments] = useState(
    defaultSegments,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(template?.name ?? "");
    setSegments(
      template
        ? readPattern(template.pattern)
        : defaultSegments,
    );
  }, [template]);

  /**
   * @param {number} index
   * @param {number} next
   */
  function move(index, next) {
    if (next < 0 || next >= segments.length) {
      return;
    }
    const copy = [...segments];
    [copy[index], copy[next]] = [
      copy[next],
      copy[index],
    ];
    setSegments(copy);
  }

  /** @param {number} index */
  function remove(index) {
    setSegments(
      segments.filter((_, i) => i !== index),
    );
  }

  /** @param {string} kind */
  function add(kind) {
    setSegments([
      ...segments,
      {
        kind,
        value: kind === "literal" ? "" : "",
      },
    ]);
  }

  /** @param {number} index */
  /**
   * @param {number} index
   * @param {string} value
   */
  function setLiteral(index, value) {
    const copy = [...segments];
    copy[index] = { ...copy[index], value };
    setSegments(copy);
  }

  async function save() {
    if (
      !name.trim() ||
      !segments.length ||
      segments.some(
        (segment) =>
          segment.kind === "literal" &&
          !segment.value.trim(),
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await onSave(name.trim(), segments);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel editor">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">TEMPLATE</p>
          <h2>
            {template
              ? "テンプレートを編集"
              : "テンプレートを作成"}
          </h2>
        </div>
        <button
          className="text-button"
          onClick={onCancel}
        >
          閉じる
        </button>
      </div>

      <label
        className="field-label"
        htmlFor="template-name"
      >
        テンプレート名
      </label>
      <input
        id="template-name"
        value={name}
        onChange={(event) =>
          setName(event.target.value)
        }
        placeholder="例：月次請求書"
      />

      <div className="field-heading">
        <span className="field-label">
          名前に入れる要素
        </span>
        <span className="muted small">
          上から順につながるよ
        </span>
      </div>
      <div className="segment-list">
        {segments.map((segment, index) => (
          <div
            className="segment"
            key={`${segment.kind}-${index}`}
          >
            <span className="segment-index">
              {index + 1}
            </span>
            <span className="segment-label">
              {labels[
                /** @type {keyof typeof labels} */
                (segment.kind)
              ] ?? segment.kind}
            </span>
            {segment.kind === "literal" && (
              <input
                aria-label="固定文字"
                value={segment.value}
                onChange={(event) =>
                  setLiteral(
                    index,
                    event.target.value,
                  )
                }
                placeholder="文字を入力"
              />
            )}
            <div className="segment-actions">
              <button
                aria-label="上へ"
                disabled={index === 0}
                onClick={() =>
                  move(index, index - 1)
                }
              >
                ↑
              </button>
              <button
                aria-label="下へ"
                disabled={
                  index === segments.length - 1
                }
                onClick={() =>
                  move(index, index + 1)
                }
              >
                ↓
              </button>
              <button
                aria-label="削除"
                onClick={() => remove(index)}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="add-row">
        {Object.entries(labels).map(
          ([kind, label]) => (
            <button
              key={kind}
              className="chip"
              onClick={() => add(kind)}
            >
              ＋ {label}
            </button>
          ),
        )}
      </div>
      <div className="example-box">
        <span>できあがりの例</span>
        <strong>{exampleName(segments)}</strong>
        <small>
          拡張子は元のファイルから引き継ぐよ
        </small>
      </div>
      <div className="editor-footer">
        <button
          className="primary"
          disabled={
            saving ||
            !name.trim() ||
            !segments.length
          }
          onClick={save}
        >
          {saving ? "保存中…" : "保存する"}
        </button>
      </div>
    </section>
  );
}
