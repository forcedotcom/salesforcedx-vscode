---
title: 概要
lang: ja
---

VS Code の Aura コンポーネント拡張機能では、エディタに組み込まれたコードナビゲーションや言語機能を活用して、Aura コンポーネントを効率的に構築することができます。

以下の機能を利用できます。

- [コード補完](./ja/aura/writing#code-completion)
- [カーソルを置くとコンポーネントドキュメントを表示](./ja/aura/writing#view-component-documentation-on-hover)
- [リンティング](./ja/aura/writing#linting)
- [コードナビゲーション](./ja/aura/writing#code-navigation)
- [アウトラインビュー](./ja/aura/writing#outline-view)

## コード補完

Aura コンポーネント拡張機能は、VS Code の [HTML](https://code.visualstudio.com/docs/languages/html) と [JavaScript](https://code.visualstudio.com/docs/languages/javascript) の言語機能をベースに、シンタックスハイライト、ブラケットマッチング、IntelliSense による言語固有のコード補完などを実現しています。この拡張機能は、以下の Aura コンポーネントリソースのコード補完を提供します。

### タグ

![Aura のタグ補完](./images/V2_aura_tag_completion.png)

- **注意:** ワークスペースに Lightning Web コンポーネントがある場合は、それらのコンポーネントも補完候補のリストに表示されます。適切な Aura 構文とともに、Lightning Web コンポーネントの候補が表示されます。

### 属性

![Aura の属性補完](./images/V2_aura_attribute_completion.png)

## カーソルを置くとコンポーネントドキュメントを表示

コンポーネントの名前または属性にカーソルを置くと、エディタにコンポーネントのドキュメントと、コンポーネントライブラリへのリンクが表示されます。Aura コンポーネントや、Aura コンポーネント内にネストされている Lightning Web コンポーネントの参照ドキュメントを確認できます。

以下は、`lightning:card` コンポーネントの参照ドキュメントです。
![Aura コンポーネントの参照](./images/V2_comp_reference_aura.png)

## リンティング

編集中のコードが不正な形式であったり、疑わしい場合にエラーを表示します。VS Code は、Salesforce の ESLint ルールを適用します。ESLint を有効にするには、コマンドラインからインストールします。手順については、[Aura Components ESLint Plugin](https://github.com/salesforce/eslint-plugin-aura) のリポジトリを参照してください。

> **注意:** リンターは、CSS スタイル属性の中にテンプレートコーを含めるとエラーをスローします。例えば、次のコードサンプルはエラーをスローします。`<div style="{# 'background-image:url(' + v.url+ ')'}"> ... </div>` リンターはテンプレートコードを CSS として検証します。これは Aura の LSP の既知の不具合であり、このエラーは無視することができます。

## コードナビゲーション

VS Code には、現在作業中のコードを見失うことなく、コード内の定義をプレビューしたり、ジャンプしたりするためのショートカットが用意されています。詳細は、『VS Code ドキュメント』の [「Code Navigation」](https://code.visualstudio.com/docs/editor/editingevolved) セクションを参照してください。

定義をプレビューするには、Ctrl キー \(Windows、Linux\) または Cmd キー \(macOS\) を押したまま、定義を表示する項目にカーソルを置きます。次の例は、 `c` 名前空間のコンポーネントのソースをプレビュー表示しています。

これは、Aura の pubsub コンポーネント内で参照されている、 `AuraPubSub` Lightning Web コンポーネントの定義のプレビューです。

![c 名前空間コンポーネントのソース表示](./images/vscode_aura_goto.png)

定義を表示するには、項目を右クリックして [Peek Definition \(定義をここに表示\)] を選択するか、Alt+F12 キーを押します。

定義の場所に移動するには、項目を右クリックして [Go to Definition \(定義へ移動\)] を選択するか、F12 キーを押します。

## アウトラインビュー

[Outline \(アウトライン\)] ビューでは、コンポーネントのアウトライン \(HTML のタグ、JavaScript のプロパティなど\) を確認できます。Windows または Linux は Ctrl+Shift+O キー、Mac は Cmd+Shift+O キーで起動します。

![Aura バンドルにある .js ファイルの記号のリスト](./images/V2_outline_view.png)
