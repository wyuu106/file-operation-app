import TemplateEditor from "./TemplateEditor";

/**
 * @param {{templates:import('./api').Template[],
 * editing:import('./api').Template|null|undefined,
 * onEdit:(value:import('./api').Template|null|undefined)=>void,
 * onDelete:(value:import('./api').Template)=>void,
 * onSave:(name:string,
 * segments:import('./api').Segment[])=>Promise<void>}}
 * props
 */
export default function TemplatesView({
  templates,
  editing,
  onEdit,
  onDelete,
  onSave,
}) {
  return (
    <>
      <section className="panel template-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">TEMPLATES</p>
            <h2>テンプレート</h2>
          </div>
          <button
            className="secondary"
            onClick={() => onEdit(null)}
          >
            ＋ 新しく作る
          </button>
        </div>
        {templates.length ? (
          <div className="template-list">
            {templates.map((template) => (
              <div
                className="template-row"
                key={template.id}
              >
                <span>{template.name}</span>
                <div className="template-actions">
                  <button
                    onClick={() =>
                      onEdit(template)
                    }
                  >
                    編集
                  </button>
                  <button
                    onClick={() =>
                      onDelete(template)
                    }
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">
            まだテンプレートはないよ
          </div>
        )}
      </section>
      {editing !== undefined && (
        <TemplateEditor
          template={editing}
          onSave={onSave}
          onCancel={() => onEdit(undefined)}
        />
      )}
    </>
  );
}
