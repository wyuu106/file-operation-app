const messages = {
  FOLDER_UNAVAILABLE:
    "フォルダを開けなかったよ。場所や権限を確認してね。",
  READ_FAILED:
    "ファイル一覧を読み込めなかったよ。",
  SOURCE_CHANGED:
    "対象ファイルが変更されたよ。フォルダを開き直してね。",
  BAD_TEMPLATE:
    "テンプレートの内容を確認してね。",
  BAD_TEMPLATE_NAME:
    "テンプレート名を入力してね。",
  TEMPLATE_MISSING:
    "テンプレートが見つからなかったよ。",
  NO_SELECTION: "変更するファイルを選んでね。",
  BAD_SELECTION: "ファイルの選択をやり直してね。",
  PLAN_EXPIRED: "プレビューを作り直してね。",
  PLAN_INVALID: "プレビューの問題を解消してね。",
  NO_UNDO: "取り消せる操作がないよ。",
  DB_ERROR:
    "履歴を保存できなかったよ。もう一度試してね。",
  BUSY: "処理中だよ。少し待ってね。",
};

/** @param {unknown} error */
export function userMessage(error) {
  const code = String(error);
  return (
    messages[
      /** @type {keyof typeof messages} */
      (code)
    ] ??
    "処理に失敗したよ。ファイルの状態を確認してね。"
  );
}
