---
title: SOQL クエリの記述
lang: ja
---

SOQL クエリのスニペットを使用して、SOQL クエリのコード補完の提案を確認することができます。

Salesforce Object Query Language (SOQL) の使用方法については、[SOQL および SOSL リファレンス](https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/sforce_api_calls_soql.htm) を参照してください。

> 注意: SOQL 言語サーバは現在ベータです。バグを発見したかフィードバックがある場合は、[GitHub に issue をオープン](./ja/bugs-and-feedback)してください。より詳細な情報は、[ロードマップ](https://github.com/forcedotcom/salesforcedx-vscode/wiki/Roadmap) を参照してください。

## SOQL 言語サーバを用いて開発する

SOQL 言語サーバを用いて開発するには、拡張子が `.soql` のファイルを作成します。 `soql` ファイルは、`sfdx-project.json` に登録されているディレクトリの外側に配置することを推奨します。これは組織にデプロイするファイルではないためです。`.soql` ファイルの目的は、Apex コードに組み込む前に、SOQL クエリをビルドしてテストする方法を提供することです。

## コード補完の提案を参照する

SOQL 言語サーバがコード補完の提案を行うためには、SObject 定義を更新する必要があります。コマンドパレットから、`SFDX: SObject の定義を更新` を実行します。

- コード補完の提案を表示するには、`.soql` ファイルで作業しているときに ctrl + space を押します。
- 提案の間を移動するには、矢印キーを使用します。
- 提案から自動補完するには、Enter キーを押します。

![基本的な SOQL クエリのコード補完を示すアニメーション](./images/soql-completion.gif)
