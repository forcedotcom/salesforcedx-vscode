---
title: Salesforce プロジェクト用の Prettier コードフォーマッタの設定
lang: jp
---

現在、Prettier は Aura コンポーネントと Lightning Web コンポーネント \(LWC\) のほか、`.json`、`.md`、`.html`、`.js` などの標準ファイル形式もサポートしています。Apex に対するサポートは[コミュニティ](https://github.com/dangmai/prettier-plugin-apex)で進められており、間もなく使用できるようになるものと思われます。

Aura や LWC に Prettier を使用するためには、一定の設定が必要です。

1. プロジェクトにまだ `package.json` がない場合は、`npm init` を実行します。
   デフォルトをすべて受け入れて構いません。

1. `npm install --save-dev --save-exact prettier` を実行して Prettier をインストールします。

1. プロジェクトのルートに、次の内容を記載した `.prettierrc` という Prettier 設定ファイルを作成します。

   > 注意: Aura の場合 `"trailingComma": "none"` 設定は必須です。

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

1. Prettier をさらにカスタマイズするときは、[他の設定オプション](https://prettier.io/docs/en/options.html)を追加します。

1. VS Code 向け [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) 拡張機能をインストールします。

1. 全ファイルの形式が設定されていることを確認する場合は、VS Code の `editor.formatOnSave` 設定を有効にします。各自の設定についての詳細は、『Visual Studio Code Docs』の[「User and Workspace Settings \(ユーザとワークスペースの設定\)」](https://code.visualstudio.com/docs/getstarted/settings)を参照してください。

変更内容を Git リポジトリにコミットするたびにファイルの形式を設定する場合は、[Git フックを設定](https://prettier.io/docs/en/precommit.html)します。
