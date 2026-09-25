---
name: database-dev
description: SQLiteを使用したテンプレート・リネーム履歴の保存処理を実装・変更する場合に使用する。
---

# データベース設計

SQLiteはローカルデータ保存に使用する。

MVPでは主に以下を保存する。

- rename_templates
- rename_operations
- rename_operation_items

---

## rename_templates

### 役割

ユーザーが作成したファイル名変更のテンプレートを保存する。

同じ命名ルールを繰り返し利用できるようにするためのテーブル。

### カラム

最低限、以下のカラムを持つ。

- id
- name
- pattern
- created_at
- updated_at

---

## rename_operations

### 役割

一括リネームを1回実行したことを記録する。

いつリネームを実行したか、Undo済みかどうかなど、
一括処理単位の履歴を管理するためのテーブル。

### カラム

最低限、以下のカラムを持つ。

- id
- executed_at
- undone_at

---

## rename_operation_items

### 役割

一括リネームで変更された個々のファイルの情報を記録する。

変更前と変更後のファイルパスを保存し、
実行結果の確認やUndoに利用するためのテーブル。

### カラム

最低限、以下のカラムを持つ。

- id
- operation_id
- original_path
- renamed_path

`operation_id`によって`rename_operations`と関連付ける。

1つの`rename_operations`に対して、
複数の`rename_operation_items`が存在する。

---

# Relationships

テーブル間の関係は以下とする。

rename_operations
      │
      │ 1
      │
      │ N
      ↓
rename_operation_items

`rename_operations`は一括リネーム処理全体を表し、
`rename_operation_items`はその処理で変更された各ファイルを表す。

---

# 規約

ユーザーのファイル内容をDBへ保存しない。

DBにはテンプレートやファイルパスなど、
アプリケーションの動作に必要な情報のみ保存する。

テンプレート削除によって過去の変更履歴が
削除されない設計にする。

DBアクセス処理をReactへ持たせない。

SQLiteへのアクセスはRust側で行う。

外部データベースやクラウドデータベースは使用しない。
