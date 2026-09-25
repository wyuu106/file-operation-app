# ファイル名整理

バックオフィス向けのローカル一括リネームアプリ。
React、Tauri、Rust、SQLiteを使う。

## 開発

macOSではXcode Command Line ToolsとRust、
Node.jsが必要。WindowsではRustとNode.js、
Tauriが必要とするビルドツールを用意する。

```sh
npm install
npm run check
npm run tauri dev
```

アプリからフォルダを選び、対象ファイルと
テンプレートを指定する。プレビューで名前を
確認してから実行する。
隠しファイルとOSの管理ファイルは一覧から
除外する。

## 確認

```sh
npm run check
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml \
  --all-targets -- -D warnings
```

ファイル操作テストは一時フォルダを使う。
データベースはOSのアプリ用データ領域に保存する。
