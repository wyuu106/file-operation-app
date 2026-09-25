---
name: frontend-dev
description: Reactを使用したUIの新規実装・変更を行う場合に使用する。
---

# フロントエンド開発

## フレームワーク

JavaScript React を使用する。

## 責務

Reactは以下を担当する。

- 画面表示
- ユーザー入力
- テンプレート管理UI
- ファイル一覧
- リネームプレビュー
- 実行結果表示

ファイルシステムをReactから直接操作しない。

Rust側のTauri Commandを利用する。

## UX

対象ユーザーは非エンジニアのバックオフィス担当者。

専門用語をUIに表示しない。

例:

Bad:
Execute Rename Command

Good:
ファイル名を変更

Bad:
File System Path

Good:
対象フォルダ

重要な操作では処理結果を明確に表示する。

## Components

巨大なコンポーネントを作らない。

画面固有UIと再利用可能UIを適切に分離する。

## エラー処理

Rust側から返されたエラーをそのまま表示しない。

ユーザーが理解できるメッセージへ変換する。
