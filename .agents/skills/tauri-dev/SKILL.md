---
name: tauri-dev
description: ReactとRustを接続するTauri Commandやデスクトップ機能を実装・変更する場合に使用する。
---

# Tauri

ReactとRust間の通信にはTauri Commandを使用する。

HTTP APIを作成しない。

基本構成:

React
↓
invoke()
↓
Tauri Command
↓
Rust

Commandは責務を明確にする。

例:

- get_files
- get_templates
- create_template
- update_template
- delete_template
- preview_rename
- execute_rename
- undo_last_rename

React側とRust側で型の意味が一致するようにする。

ファイル操作のビジネスロジックを
Command関数内へ大量に直接記述しない。

Commandは入力を受け取り、
適切なserviceへ処理を委譲する。
