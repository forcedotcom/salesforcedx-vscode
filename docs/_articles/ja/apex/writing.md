---
title: Apex コードの記述
lang: ja
---

VS Code の Apex 拡張機能を使用して、コード補完、定義へ移動、Apex クラスやトリガのアウトライン表示、リファクタリング、コードの構文エラーの検出などのコード編集機能にアクセスできます。

## コード補完

Apex 拡張機能は、Apex クラスやトリガで作業しているときに、状況に応じた候補を提供します。コードを入力すると、自動補完機能により、メソッドや変数などのメンバーがリストアップされます。また、自動補完リストには、候補のドキュメントも表示されます。以下のキーを使用します。

- Ctrl+space でコード補完の候補を表示します。
- 矢印キーで候補の間を移動します。
- Enter キーで候補の中から選択します。

![PropertyController のコード補完を示すアニメーション](./images/apex_completion_with_doc.gif)

候補の事前選択方法を変更したい場合は、[IntelliSense - Suggestion selection](https://code.visualstudio.com/docs/editor/intellisense#_customizing-intellisense) を参照してください。

## コードスニペット

コードスニペットは、クラスやインターフェースの定義の雛形クラスに、あるいはループや条件文などの様々なステートメントに利用できます。Apex のクラスやトリガで作業しているときに、使用可能な Apex コードスニペットを表示するには、コマンドパレットから **[Insert Snippet \(スニペットの挿入\)]** を実行します。また、これらのコードスニペットをコード補完の候補として表示することもできます。

Out of the box snippets for Salesforce development are available in these repositories:

- [Apex Code Snippets](https://github.com/forcedotcom/salesforcedx-vscode/blob/develop/packages/salesforcedx-vscode-apex/snippets/apex.json)
- [HTML Code Snippets for LWC development](https://github.com/forcedotcom/salesforcedx-vscode/blob/develop/packages/salesforcedx-vscode-lwc/snippets/lwc-html.json)
- [JavaScript Code Snippets for LWC development](https://github.com/forcedotcom/salesforcedx-vscode/blob/develop/packages/salesforcedx-vscode-lwc/snippets/lwc-js.json)

独自のコードスニペットを定義したい場合は、[Visual Studio Code のスニペット](https://code.visualstudio.com/docs/editor/userdefinedsnippets)をお読みください。

## sObject のコードスマートネス

補完を正しく表示するコードスマートネス機能を有効にするには、コマンドパレットから **[SFDX: Refresh SObject Definitions \(SFDX: SObject の定義を更新\)]** を実行します。

次の定義をプレビューや表示したり、定義に移動することができます。

- ユーザ定義の Apex
  - クラス \(拡張クラスの定義に基づく\)
  - コンストラクタ
  - インターフェース \(拡張クラスの定義に基づく\)
  - メソッド
  - プロパティ
  - 変数 \(ローカル変数とクラス変数\)
- 標準オブジェクト
  - 項目 \(標準項目とカスタム項目\)
  - オブジェクト定義
- カスタムオブジェクト
  - 項目
  - オブジェクト定義

sObject の定義を更新すると、VS Code がデフォルトの組織を使用して偽の Apex クラスを生成します。これらの偽のクラスは、現在のユーザがアクセスできる標準およびカスタムオブジェクトを表します。偽のクラスは参照専用として使用することが想定されているため、それらを編集しないことを推奨します。もし偽のクラスが編集されると、自動補完の候補に影響を及ぼす可能性があります。

sObject の定義を更新するたびに、偽のクラスが削除され再生成されます。sObjects を修正するには、オブジェクトの `.object-meta.xml` と `.field-meta.xml` ファイルを更新するか、デフォルトの組織で宣言的に変更するかのどちらかになります。sObjects を修正した後は、必ずローカルプロジェクトとデフォルトの組織を同期させてください。

Salesforce CLI インテグレーション拡張機能 \(Salesforce Extension Pack に付属\) を初めて起動するときに、`salesforcedx-vscode-apex.enable-sobject-refresh-on-startup` の設定が有効化されている場合は、プロジェクトに偽のクラスが無ければバックグラウンドで **[SFDX: Refresh SObject Definitions \(SFDX: SObject の定義を更新\)]** が実行されます。標準またはカスタムオブジェクトやその項目を追加あるいは編集したら、必ず **[SFDX: Refresh SObject Definitions \(SFDX: SObject の定義を更新\)]** を再度実行します。

## 定義に移動

Apex 拡張機能では、クラスやメソッドなどのユーザ定義 Apex、標準オブジェクトやカスタムオブジェクトに対して [定義に移動 (Go to Definition)] がサポートされています。

- 定義をプレビューするには、Ctrl キー \(Windows、Linux\) または Cmd キー \(macOS\) を押したまま、定義を表示する項目にカーソルを置きます。
- 定義を表示するには、項目を右クリックして **[Peek Definition \(定義をここに表示\)]** を選択するか、Alt+F12 キーを押します。
- 定義の場所に移動するには、項目を右クリックして **[Go to Definition \(定義へ移動\)]** を選択するか、F12 キーを押します。

![定義のプレビューや表示と定義への移動](./images/apex_go_to_definition.gif)

## すべての参照の検索

クラス、クラス変数、列挙、インターフェース、メソッド、プロパティのような、ユーザ定義の Apex への参照はすべて検索できます。参照を検索するには、項目を選択して、Shift + F12 キーを押します。または、項目を右クリックして **[Find All References \(すべての参照の検索\)]** を選択します。参照の結果はエディタウィンドウの左ペインに表示されます。

## アウトラインの表示

Apex アウトラインビューには、エディタに開いている Apex クラスまたはトリガの構造が表示されます。

- ファイルの記号をリストするには、Ctrl + Shift + O キー \(Windows、Linux\) または Cmd + Shift + O キー \(macOS\) を押します。
- 記号の 1 つに移動するには、リストでその記号を選択します。

![アウトラインビュー。Apex クラスの記号が表示されています。](./images/apex_outline.png)

サイドバーのエクスプローラでは、プロジェクトでの作業を支援するアウトラインビューも提供されています。

## 構文エラー

セミコロンや括弧の欠落などの構文エラーは、エディタ上で赤い波線で表示されます。また、[Problems \(問題\)] パネルには、構文エラーの一覧が表示されます。構文エラーが発生したソースファイルに移動するには、エラーをダブルクリックします。

![Apex クラス内のセミコロンの欠落を示す問題ビュー](./images/apex_problems.png)

## クイックフィックス

ソースで宣言されていないメソッドを参照するときは、クイックフィックスウィジェットを使って、自動的にメソッドを宣言します。

### 宣言されていないメソッドの宣言

クイックフィックスは、以下の方法で呼び出すことができます。

- 宣言されていないメソッドの名前をクリックすると、エディタウィンドウの左側に電球が表示されます。その電球をクリックしてから、**Create method 'yourMethod' in 'yourClass'** をクリックすると、クイックフィックスが実行されます。

![電球から、存在しないメソッドを宣言するクイックフィックスを呼び出す様子を示す GIF](./images/declare-missing-methods-1.gif)

- メソッド名の上にカーソルを置き、ポップアップウィンドウで **[Quick Fix \(クイック フィックス\)]** をクリックします。そして、**Create method 'yourMethod' in 'yourClass'** をクリックして、クイックフィックスを行います。

![ウィンドウのポップアップから、存在しないメソッドを宣言するクイックフィックスを呼び出す様子を示す GIF](./images/declare-missing-methods-2.gif)

> 注意: クイックフィックスウィジェットのキーボードショートカットは、macOS では Cmd + .で、Windows と Linux では Ctrl + . です。

## 匿名 Apex

VS Code で[匿名 Apex](https://developer.salesforce.com/docs/atlas.ja-jp.apexcode.meta/apexcode/apex_anonymous_block.htm)を実行するには 2 つの方法があります。1 つは、任意の Apex コードを選択して、`SFDX: Execute Anonymous Apex with Currently Selected Text (SFDX: 現在選択されているテキストで匿名 Apex コードを実行)` というコマンドを実行するだけです。または、ファイルのコンテキスト全体を実行したい場合は、`SFDX: Execute Anonymous Apex with Editor Contents (SFDX: エディタの内容で匿名 Apex コードを実行)` というコマンドを実行します。いずれの場合も、実行されたコードの結果は出力ペインに表示されます。

![SFDX: 現在選択されているテキストで匿名 Apex コードを実行](./images/apex_execute_selected.png)

特定のタスクを実行するために、Apex コードをプロジェクト内に保持することはよくあります。デフォルトでは、新しいプロジェクトには、サンプルの `hello.apex` ファイルを含む `scripts/apex` フォルダがあります。このフォルダを使用して、`.apex` のファイル拡張子を使用した匿名 Apex ファイルを作成することをお勧めします。
