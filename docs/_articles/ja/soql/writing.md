---
title: SOQL クエリの記述
lang: ja
---

SOQL クエリのスニペットを使用して、SOQL クエリのコード補完の候補を確認することができます。

Salesforce Object Query Language (SOQL) の使用方法については、[『SOQL および SOSL リファレンス』](https://developer.salesforce.com/docs/atlas.ja-jp.soql_sosl.meta/soql_sosl/sforce_api_calls_soql.htm) を参照してください。

> 注意: SOQL 言語サーバは現在ベータです。バグを発見したかフィードバックがある場合は、[GitHub に issue をオープン](./ja/bugs-and-feedback)してください。より詳細な情報は、[ロードマップ](https://github.com/forcedotcom/salesforcedx-vscode/wiki/Roadmap) を参照してください。

## SOQL ファイル

VS Code は Apex ファイルおよびスタンドアロンの `.soql` ファイルの両方で SOQL の記述をサポートしています。`soql` ファイルは、`sfdx-project.json` に登録されているディレクトリの外側に配置することを推奨します。これは組織にデプロイするファイルではないためです。`.soql` ファイルの目的は、Apex コードに組み込む前に、SOQL クエリをビルドしてテストする方法を提供することです。デフォルトでは、新しいプロジェクトの `scripts/soql` フォルダにサンプルの `accounts.soql` ファイルが含まれます。このフォルダを SOQL クエリを保存するためのフォルダとして使用することができます。

## コード補完の提案を参照する

VS Code は SOQL `.soql` ファイル (およびゆくゆくは Apex ファイル内) のコード補完をサポートしています。この機能を使用するには、SObject 定義を更新する必要があります。コマンドパレットから、`SFDX: Refresh SObject Definitions (SFDX: SObject の定義を更新)` を実行します。

- コード補完の提案を表示するには、`.soql` ファイルで作業しているときに ctrl+space を押します。
- 候補の間を移動するには、矢印キーを使用します。
- 候補から自動補完するには、Enter キーを押します。

![基本的な SOQL クエリのコード補完を示すアニメーション](./images/soql-completion.gif)

## SOQL テキストの実行

SOQL を実行するには、テキストを選択し、`SFDX: Execute SOQL Query with Currently Selected Text (SFDX: 現在選択されたテキストで SOQL を実行)` コマンドを実行します。クエリを REST API または Tooling API のどちらを使用して実行するかを選択することができます。

![SFDX: 現在選択されたテキストで SOQL を実行](./images/soql_text.png)

クエリが実行された後、結果は出力ペインに表示されます。

![SFDX: 現在選択されたテキストで SOQL を実行](./images/soql_results.png)

## SOQL のインライン実行

ファイルに保存することなくクエリを記述し実行するには、`SFDX: Execute SOQL Query... (SFDX: SOQL クエリを実行...)` コマンドを使用し、コマンドバーに SOQL を直接入力します。結果は出力ペインに表示されます。

![SFDX: SOQL クエリを実行...](./images/soql_command.png)
