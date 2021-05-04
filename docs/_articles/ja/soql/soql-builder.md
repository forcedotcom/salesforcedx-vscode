---
title: SOQL ビルダー (ベータ)
lang: ja
---

SOQL ビルダーは、SOQL クエリを構築する際の当て推量をなくす VS Code 拡張機能です。SOQL クエリビルダーを使えば、誰でも視覚的にクエリを構築、実行し、その結果を調べることができます。ビジュアルエディタでクリックしてクエリを作成し、テキストエディタでクエリを保存して拡張することができます。クエリの結果をすぐに見ることができ、その結果を `.csv` や `.json` ファイルに保存することができます。

> 注意: SOQL ビルダーは現在ベータです。バグを発見したかフィードバックがある場合は、[GitHub に issue をオープン](./ja/bugs-and-feedback)してください。より詳細な情報は、[ロードマップ](https://github.com/forcedotcom/salesforcedx-vscode/wiki/Roadmap) を参照してください。

ベータ版の間は、以下を含むシンプルなクエリステートメントを構築することができます。

- 単一の sObject に対する FROM 句
- 選択された sObject から項目を選択するための SELECT 句、または結果の集計を行う COUNT()
- データのフィルタするための WHERE 句
- ASC、DESC、NULLS FIRST、NULLS LAST をサポートする ORDER BY 句
- LIMIT 句

  SOQL の構文についてより深く知り、テキストエディタでより複雑なクエリを構築するには、[『SOQL および SOSL リファレンス』](https://developer.salesforce.com/docs/atlas.ja-jp.soql_sosl.meta/soql_sosl/sforce_api_calls_soql.htm) を参照してください。

**ベータ版の制限**

- サポートされない構文であるエラーメッセージが表示されますが、SOQL ビルダー内で複雑なクエリを実行することはできます。
- WHERE 句は非常に複雑なこともあります。SOQL ビルダーはシンプルな WHERE 句をサポートします。AND または OR を使用して条件を組み合わせることができますが、両方を使用することはできません。

## SOQL ビルダー拡張機能のインストール

[Salesforce 開発者向けツール](https://developer.salesforce.com/tools/vscode/en/getting-started/install)をコンピュータにインストールし設定します。

- Visual Studio Code
- Salesforce CLI
- Salesforce Extension Pack 拡張機能
- Java Platform, Standard Edition Development Kit

次に、[Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-soql) から SOQL ビルダー拡張機能をインストールします。

## SOQL ビルダーの起動

SOQL ビルダーは Salesforce DX プロジェクト上で起動します。どのように SOQL ビルダーを起動するかは、既に `.soql` ファイルがあるか、これから作成するのかによって異なります。

### 前提

- VS Code で Salesforce DX プロジェクトを開いていること
- クエリしたいオブジェクトのある組織に接続していること

### 既存の SOQL ファイルを SOQL ビルダーで開く

DX プロジェクトには、サンプルの `accounts.soql` ファイルが `<project-folder>/scripts/soql` ディレクトリにありますが、任意のフォルダに `.soql` ファイルを作成し保存することができます。

1. (必要に応じて) `.soql` ファイルを作成します。
2. `.soql` ファイルをクリックします.
3. **[Switch Between SOQL Builder and Text Editor \(SOQL ビルダーとテキストエディタの切り替え\)]** アイコンをクリックします.

![SOQL ビルダーとテキストエディタの切り替えをクリックして、.soql ファイルを SOQL ビルダーで開く](./images/soql-builder-open.gif)

`.soql` ファイルを VS Code のメニューから SOQL ビルダーで開くこともできます。ファイル名をクリックして、**Open With** > **SOQL Builder** を選択します.

### SOQL ビルダーの起動とクエリの作成

1. コマンドパレットから、**[SFDX: Create Query in SOQL Builder \(SFDX: SOQL ビルダーでクエリの作成\)]** を実行します。
1. **[File \(ファイル\)]** > **[Save \(保存\)]** からクエリを保存します。ファイルの拡張子は `.soql` としてください。

## クエリの構築

クエリを構築している間、SOQL ビルダがクエリのシンタックスを表示すると同時に `.soql` ファイルを更新していることを確認できます。SOQL ステートメントの構築が完了したら、**[Run Query \(クエリの実行\)]** をクリックして結果を確認します。

ドロップダウンリストからオブジェクトと項目を選択するか、リストの結果を絞り込むために入力することができます。オブジェクトや項目は一度だけ選択することができます。オブジェクトや項目は一度だけ選択することができます。値が既に選択されている場合、ドロップダウンメニューや検索結果には表示されません。

![クエリの構築](./images/soql-builder-build-a-query.gif)

### LIKE 演算子を使用したフィルタ

検索結果をフィルタリングする際に、LIKE 演算子やワイルドカードを使って部分的なテキスト文字列にマッチさせることで、検索結果をさらに絞り込み、ターゲットを絞ることができます。次のクエリは、`mc` で始まる姓だけを返します。

```
SELECT AccountId, FirstName, LastName
FROM Contact
WHERE LastName LIKE 'mc%'
```

LIKE を使用して独自のフィルタを構築することもできますし、以下のあらかじめ用意されたオプションを選択することもできます。

- starts with
- ends with
- contains

### COUNT の結果を表示する

COUNT() は集計関数なので、他に選択された項目はすべて削除されます。COUNT を選択するつもりがなかった場合は、メインメニューから操作を取り消すことができます。フィルタ (WHERE 句) を追加することで、結果をさらに絞り込むことができます。クエリを実行すると、返される行の数はレコードの総数に対応します。次の例では、COUNT は 3 です。

![レコードの総数はCOUNT](./images/soql-builder-count.png)

<!-- **Tip:** If using the text editor to build your query, you can validate your syntax by turning on the SOQL Editor Remote Checks setting. ekapner update, 2/2/2021: this setting not ready for GA-->

**ベータ版の制限**

- SOQL ビルダーは現在、シンプルなクエリをインタラクティブに作成することをサポートしています。近いうちにさらに機能を追加する予定です。ただし、より複雑な `.soql` ファイルを開いて SOQL ビルダー内でクエリを実行することはできますが、テキストエディタを使って更新する必要があります。
- 項目を選択する際、一度に 1 つしか選択 (クリック) できません。
- [Run Query \(クエリの実行\)] をクリックする度に、[SOQL Query Results \(SOQL クエリの結果\)] タブが表示されます。結果を特定のクエリステートメントと関連付ける方法はありません。SOQL ビルダーのエディタには、最新の更新情報が反映されます。

**次**

- `.soql` (テキスト) ファイルを保存して、更新が失われることを避ける。
- クエリ結果の出力を `.csv` または `.json` ファイルとして保存する。

## SOQL ビルダーとテキストエディタの両方でクエリを表示する

ビューを分割して、SOQL ビルダーとテキストエディタの両方でクエリを確認します。

1. タブを右クリックし、任意の分割オプションを選択します。
1. 新しいタブを右クリックし、**Reopen Editor With** を選択後、**Text Editor** を選択します。

![画面を分割しSOQL ビルダーとテキストエディタの両方を確認する](./images/soql-builder-split-panels.gif)

## クエリ結果を保存する

保存アイコンをクリックして、クエリの結果を `.csv` または `.json` ファイルとして任意の場所に保存します。これらのファイルが自分の組織にデプロイされたり、ソースコントロールに追加されたりするのを防ぐために、保存したファイルのパスを `.gitignore` ファイルに含めることを忘れないでください。

## SOQL ビルダーとテキストエディタを切り替える

SOQL 文を表示しながら、SOQL ビルダーとテキストエディタを簡単に切り替えることができます。

![SOQL ビルダーとテキストエディタの切り替えアイコンをクリックしてビューを切り替える](./images/soql-toggle.png)

## 既知の問題

### デフォルトの組織への認証が期限切れとなった場合に SOQL ビルダーを使用できない

**内容:** デフォルトの組織の認証トークンが期限切れになるか、デフォルトのスクラッチ組織が期限切れになった場合、SOQL ビルダーが使用できない。

**回避策:** デフォルトの組織を認証し、SOQL ビルダーを開き直します。うまくいかない場合は、VS Code を再起動します。
