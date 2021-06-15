---
title: 概要
lang: ja
---

Lightning Web コンポーネント拡張機能では、エディタに内蔵されたコードナビゲーションや言語機能を活用し、Lightning Web コンポーネントを効率的に構築することができます。

以下の Lightning Web コンポーネント拡張機能を利用できます。

- [コード補完](./ja/lwc/writing#コード補完)
- [カーソルを置くとコンポーネントドキュメントを表示](./ja/lwc/writing#カーソルを置くとコンポーネントドキュメントを表示)
- [リンティング](./ja/lwc/writing#リンティング)
- [コードナビゲーション](./ja/lwc/writing#コードナビゲーション)

## コード補完

Lightning Web コンポーネント拡張機能は、VS Code の [HTML](https://code.visualstudio.com/docs/languages/html) と [JavaScript](https://code.visualstudio.com/docs/languages/javascript) の言語機能をベースに、シンタックスハイライト、ブラケットマッチング、IntelliSense による言語固有のコード補完などを実現しています。この拡張機能は、以下の Lightning Web コンポーネントリソースのコード補完を提供します。

### `@salesforce` スコープのモジュール

Lightning コンポーネントでは scoped modules を通して Salesforce の値にアクセスします。Lightning Web コンポーネント拡張機能は、以下の scoped modules に対するコード補完を提供します。

- `@salesforce/resourceUrl`
- `@salesforce/contentAssetUrl`
- `@salesforce/apex`
- `@salesforce/user`

`@salesforce` モジュールについての詳細は、『Lightning Web コンポーネント開発者ガイド』に記載されている、[「`@salesforce` モジュール」](https://developer.salesforce.com/docs/component-library/documentation/ja-jp/lwc/lwc.reference_salesforce_modules)を参照してください。

以下の例では、`import` 文の補完にあたり、可能性のある静的リソースの名前を候補として表示しています。

![静的リソースの補完](./images/vscode_lwc_staticresource_trailhead.png)

以下は、`@salesforce/schema` に対するコード補完の例です。

![Schema の補完](./images/vscode_lwc_schema.png)

以下は、Apex コントローラに対するコード補完の例です。

![Apex の補完](./images/vscode_lwc_apex.png)

### Lightning API

VS Code は、`lightning/uiObjectInfoApi` や `lightning/uiRecordApi` のような Lightning API リソースに対してもコード補完を提供します。詳細は、『Lightning Web コンポーネント開発者ガイド』に記載されている、[「`lightning/ui*Api` ワイヤアダプタと関数」](https://developer.salesforce.com/docs/component-library/documentation/ja-jp/lwc/lwc.reference_ui_api)を参照してください。

### Lightning Web コンポーネントの構文

VS Code は Lightning Web コンポーネントフレームワークが備えるリアクティブプロパティやワイヤサービスを補完します。詳細は、『Lightning Web コンポーネント開発者ガイド』に記載されている、[「リアクティビティ」](https://developer.salesforce.com/docs/component-library/documentation/ja-jp/50.0/lwc/lwc.reactivity) および[「ワイヤサービスを使用したデータの取得」](https://developer.salesforce.com/docs/component-library/documentation/ja-jp/lwc/lwc.data_wire_service)を参照してください。

以下は、`@wire` デコレータの `getContactList` Apex 関数を含むコード補完の例です。

![Lightning @wire の補完](./images/vscode_lwc_wire.png)

### HTML 属性とタグにおける名前空間の補完

コード補完は、`lightning` および `c` 名前空間のコンポーネントの HTML タグおよび属性に対しても利用できます。以下では、`c-view-source` タグにおいて `source` 属性が補完されています。

![HTML 属性の補完](./images/vscode_lwc_html_attr.png)

## カーソルを置くとコンポーネントドキュメントを表示

`lightning` 名前空間の 標準の Lightning Web コンポーネントにカーソルを置いたときに、そのドキュメントを表示します。`c` 名前空間のカスタムコンポーネントでも、そのカスタムコンポーネントのドキュメントを提供している場合は、ドキュメントを表示します。以下はでは、`lightning-layout` のドキュメントを表示しています。このドロップダウンには、コンポーネントライブラリでコンポーネントを表示するためのリンクも含まれます。

![カーソルを合わせたときのドキュメント](./images/vscode_lwc_hover.png)

## リンティング

編集中のコードが不正な形式であったり、疑わしい場合にエラーを表示します。VS Code は、Salesforce の ESLint ルールを適用します。ESLint を有効にするには、コマンドラインからインストールします。手順については、[Lightning Web Components ESLint Plugin](https://github.com/salesforce/eslint-plugin-lwc) および [Lightning Web Components ESLint Config](https://github.com/salesforce/eslint-config-lwc) のリポジトリを参照してください。

以下の例では、`onpress` にカーソルを置いたとき、API プロパティには "on" で始まる名前を使用できないとリンターがレポートしています。

### 問題の表示とクイックフィックス

VS Code には、クイックフィックスや問題の表示など、問題に素早く対処してコードをリファクタリングするためのアクションが用意されています。詳細については、『VS Code ドキュメント』の [「Refactoring」](https://code.visualstudio.com/docs/editor/refactoring) を参照してください。

エラーメッセージの **問題を表示する** をクリックすると、リンターがエラーを発見した行がハイライトされます。複数のエラーがあると表示されている場合は、メッセージの右上にある下矢印をクリックすると、他のエラーが表示されます。

![問題を表示を使用したリンターの例](./images/vscode_lwc_peek.png)

以下では、**[Quick Fix \(クイック フィックス\)]** をクリックすると、行内やファイル内の有効な API 名に対する警告を無効にするオプションや、ドキュメントへのリンクが表示されています。これらの同じオプションは、`@api onpress;` の隣にある黄色い電球のアイコンをクリックすることでも表示できます。

![クイックフィックスを使用したリンターの例](./images/vscode_lwc_quickfix.png)

### エラーと警告

ファイルとコンパイラのエラーがカーソルを置くと表示されます。以下では、`@track` にカーソルを合わせたときに、それが宣言されていないという内容のエラーが表示されています。

![カーソルを合わせたときのドキュメント](./images/vscode_lwc_track.png)

## コードナビゲーション

VS Code には、現在作業中のコードを見失うことなく、コード内の定義をプレビューしたり、ジャンプしたりするためのショートカットが用意されています。詳細は、『VS Code ドキュメント』の [「Code Navigation」](https://code.visualstudio.com/docs/editor/editingevolved) セクションを参照してください。

定義をプレビューするには、**Ctrl** (Windows または Linux) または **Command** (macOS) を押しながら、定義を見たい項目の上にカーソルを置きます。以下の例では、`c` 名前空間コンポーネントのソースをプレビューしています。

![c名前空間のソースを表示](./images/vscode_lwc_commandhover.png)

定義を参照するには、項目を右クリックし、**Peek Definition (定義をここに表示)** を選択するか **Alt+F12** を押します。

定義の場所にジャンプするには、項目を右クリックし、**Go to Definition (定義に移動)** を選択するか **F12** を押します。

## js-meta.xml のサポート

VS Code では、Red Hat の XML VS Code 拡張機能を js-meta.xml に統合することで、IntelliSense をサポートしています。これにより、自動提案、シンタックスエラーのレポート、リネームのサポート、コードの自動生成など、これら以外にも拡張機能にデフォルトで備わる機能を活用することができます。

![js-meta.xml の target に対する候補を表示](./images/vscode-lwc-jsmeta-intellisense.png)
