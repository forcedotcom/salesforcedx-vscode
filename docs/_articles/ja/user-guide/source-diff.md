---
title: ソースの差分
lang: ja
---

ソースの差分コマンドを使用すると、デフォルトの組織に対してメタデータ型の差分をとることができます。この機能を使用することで、ローカルのプロジェクトと自身の組織内のメタデータとの間の変更をより簡単に視覚化することができます。

> 注意: ソースの差分機能は現在ベータ版です。バグを発見したかフィードバックがある場合は、[GitHub に issue をオープン](./ja/bugs-and-feedback)してください。

## 設定

ソースの差分機能はベータ版のため、Salesforce CLI プラグインをインストールする必要があります。ターミナルから、`sfdx plugins:install @salesforce/sfdx-diff` を実行してください。
インストールの完了後、`sfdx plugins` を実行するとインストールされたプラグインの一覧に `@salesforce/sfdx-diff` が表示されます。

## 使用

バージョン `46.11.0` より、開いているメタデータファイルを右クリックしたときに、新しいメニューオプション `SFDX: Diff File Against Org (SFDX: 組織のファイルとの差分を表示)` が表示されるようになりました。

![ソースの差分コマンド](./images/source_diff.png)

ソースの差分機能は現在以下のメタデータをサポートしています。:

- Apex クラス
- Apex トリガ
- Aura アプリケーション
- Aura コンポーネント
- Aura イベント
- Aura インタフェース
- Aura トークン
- Lightning Web コンポーネント
- Visualforce ページ
- Visualforce コンポーネント
