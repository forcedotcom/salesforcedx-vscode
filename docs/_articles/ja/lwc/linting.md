---
title: リンティング
lang: ja
---

リンティングは、不正な形式コードに関するエラーを編集中に提供します。VS Code は Salesforce の ESLint ルールを適用します。

## 前提条件

SSL のサポートを含めてビルドされた Node.js の [Active LTS リリース](https://nodejs.org/en/about/releases/)がインストールされていること。

## インストール

### 新しいプロジェクト

SFDX プロジェクトを、`sfdx force:project:create (SFDX: プロジェクトを作成)` コマンドで作成した場合、そのプロジェクトに含まれる `package.json` ファイルにはすでに ESLint のプラグインが含まれています。

1. ESLint プラグインと他の依存関係をインストールするには、プロジェクトのディレクトリで `npm install` を実行します。

2. [ESLint プラグインのルール](./en/lwc/linting#configure-linting-rules)を設定します。(任意)

3. リンティングを実行するには、プロジェクトにコンポーネントが必要です。リンティングを開始するには、 `npm run lint:lwc` を実行します。

### 既存のプロジェクト

1. プロジェクトに以下の構成の `package.json` があることを確認します。 `package.json` に設定がない場合は、`npm install eslint @salesforce/eslint-config-lwc --save-dev` を実行します。

   ```json
   "scripts": {
       "lint": "npm run lint:lwc",
       "lint:lwc": "eslint force-app/main/default/lwc"
   }

   "devDependencies" {
       "@salesforce/eslint-config-lwc": "0.4.0",
       "eslint": "^5.16.0"
   }
   ```

2. プロジェクトに [`package.json`](https://github.com/forcedotcom/salesforcedx-templates/blob/master/src/templates/project/package.json) ファイルがない場合は、リンク先のファイルをコピーして、プロジェクトディレクトリに追加します。

3. プロジェクトにこの [`.eslintignore`](https://github.com/forcedotcom/salesforcedx-templates/blob/master/src/templates/project/.eslintignore) ファイルがあることを確認してください。このファイルは、リントしないファイルを指定します。プロジェクトにこのファイルがない場合は、プロジェクトディレクトリに追加してください。

4. プロジェクトにこの [`.eslintrc.json`](https://github.com/forcedotcom/salesforcedx-templates/blob/master/src/templates/project/.eslintrc.json) ファイルがあることを確認してください。このファイルは、[リンティング設定レベル](./ja/lwc/linting#リンティングルールの設定)を指定します。プロジェクトにこのファイルがない場合は、プロジェクトディレクトリに追加してください。

5. ESLint プラグインと他の依存関係をインストールするには、プロジェクトディレクトリで `npm install` を実行します。

6. リンティングを実行するには、プロジェクトにコンポーネントが必要です。リンティングを開始するには、`npm run lint:lwc` を実行してください。

## リンティングルールの設定

ESLint には 3 つの設定レベルが含まれます。デフォルトのレベルは `@salesforce/eslint-config-lwc/recommended` です。

設定レベルを変更するには、`.eslintrc.json` のこの行を編集します。

```json
{
  "extends": ["@salesforce/eslint-config-lwc/recommended"]
}
```

- `@salesforce/eslint-config-lwc/base`
  この設定により、Lightning Web コンポーネントでよくある落とし穴を防ぎ、その他の Salesforce プラットフォームの制限を適用することができます。

- `@salesforce/eslint-config-lwc/recommended`
  この設定により、JavaScript でよくある落とし穴を防ぎ、すべてのベストプラクティスに従うことができます。

- `@salesforce/eslint-config-lwc/extended`
  この設定により、IE 11 などの古いブラウザでは動作が遅くなることがある一部の JavaScript 言語機能の使用が制限されます。古いブラウザで新しい JavaScript 構文と言語機能をサポートするために、Lightning Web コンポーネントのコンパイラは、Lightning Web コンポーネントモジュールを変換します。

リンティングルールの詳細や個別の使用方法については、[ESLint プラグイン](https://github.com/salesforce/eslint-plugin-lwc)の Github リポジトリを参照してください。

## スクリプトの追加

`package.json` の `"scripts"` セクションには、ESLint を実行するためのスクリプトがあらかじめ設定されています。独自のスクリプトを追加するには、[npm のドキュメント](https://docs.npmjs.com/misc/scripts)を参照してください。

## 参考

- ESLint の設定に関する詳しい情報については、 [ESLint User Guide](https://eslint.org/docs/user-guide/configuring) を参照してください。
- [github.com/salesforce/eslint-plugin-lwc](https://github.com/salesforce/eslint-plugin-lwc)
- [github.com/salesforce/eslint-config-lwc](https://github.com/salesforce/eslint-config-lwc)
