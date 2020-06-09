---
title: Prettier コードフォーマッタ
lang: ja
---

現在、Prettier は Aura コンポーネントと Lightning Web コンポーネント \(LWC\) のほか、`.json`、`.md`、`.html`、`.js` などの標準ファイル形式もサポートしています。Prettier は、[Dang Mai](https://github.com/dangmai) により開発されている、[Prettier Apex プラグイン](https://github.com/dangmai/prettier-plugin-apex) をインストールすると、Apex もサポートします。

## 前提条件

このプラグインを利用するには、NodeJS および npm が必要です。設定の詳細については、[Node.js および npm のダウンロードとインストール](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)を参照してください。

## インストール

Prettier Apex プラグインをインストールするには、以下の手順に従います。

1. プロジェクトディレクトリのトップレベルに移動します。
2. プロジェクトに `package.json` ファイルが含まれているか確認してください。もし含まれていなければ、`npm init` を実行し、デフォルトのオプションをすべて受け入れます。
3. `npm install -save-dev -save-exact prettier prettier-plugin-apex` を実行します。

プロジェクトのルートに設定ファイル `.prettierrc` を作成する必要があります。Prettier のフォーマットオプションについて詳しく知りたい場合は、[他の設定オプション](https://prettier.io/docs/en/options.html)を参照してください。

```json
{
  "trailingComma": "none",
  "overrides": [
    {
      "files": "**/lwc/**/*.html",
      "options": { "parser": "lwc" }
    },
    {
      "files": "*.{cmp,page,component}",
      "options": { "parser": "html" }
    }
  ]
}
```

> 注意: Aura の場合 `"trailingComma": "none"` 設定は必須です。

ローカルの設定ファイルを作成した後、VS Code の [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) 拡張機能をインストールします。ファイルを保存するたびにすべてのファイルがフォーマットされるようにしたい場合は、ユーザーとワークスペースの設定で `editor.formatOnSave` の設定を有効化してください。Prettier をプレコミットツールと一緒に使用して、ファイルをコミットする前にファイルを再フォーマットすることができます。詳しくは、[Git hook の設定](https://prettier.io/docs/en/precommit.html)を参照してください。

Prettier Apex プラグインは、他のほとんどのフォーマッタよりも遅く実行されます。保存は重要な操作なので、ファイルを保存する前にプラグインがフォーマットを完了するまで待つかどうかを決めることができます。VS Code がどのように[遅い保存操作を処理するか](https://code.visualstudio.com/updates/v1_42#_handling-slow-save-operations)を参照してください。
