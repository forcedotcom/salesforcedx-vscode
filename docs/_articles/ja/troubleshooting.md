---
title: 一般的な問題のトラブルシューティング
lang: ja
---

ここでは、VS Code 向け Salesforce 拡張機能の使用時に生じる可能性がある障害の対処方法について説明します。

## SFDX コマンドを使用できない

コマンドパレットに SFDX コマンドが 1 つも表示されない場合は、Salesforce DX プロジェクトで作業していることと、Salesforce CLI が最新バージョンであることを確認してください。

1. VS Code で開いているプロジェクトのルートディレクトリに `sfdx-project.json` ファイルがあることを確認します。Salesforce DX プロジェクトを設定していない場合は、『Salesforce DX 開発者ガイド』の[「プロジェクトの設定」](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_workspace_setup.htm)を参照してください。
2. 『Salesforce DX 設定ガイド』の説明に従って[Salesforce CLI を更新](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_update_cli.htm)します。

## Java バージョンの設定

関連資料: [Java の設定](./ja/vscode-desktop/java-setup)

## Apex 言語サーバの出力の監視

Apex 言語サーバは、[言語サーバプロトコル](https://github.com/Microsoft/language-server-protocol) 3.0 仕様の実装です。この言語サーバプロトコルにより、ツール \(この場合は VS Code\) が言語スマートネスプロバイダ \(サーバ\) と通信できるようになります。VS Code は Apex 言語サーバを使用して、Apex クラスやトリガのアウトライン、コード補完候補、構文エラーを表示します。Apex 言語サーバからのすべての診断情報を確認するには、**[View \(表示\)]** > **[Output \(出力\)]** を選択し、ドロップダウンメニューから **[Apex Language Server \(Apex 言語サーバ\)]** を選択します。この診断情報に、言語サーバの進捗状況に対するインサイトが示され、発生した問題を確認できます。

## Apex 言語サーバの有効化

Apex 機能を使用できない場合は、Apex 言語サーバを有効にします。VS Code のメニューバーで、**[View \(表示\)]** > **[Output \(出力\)]** を選択し、右側のドロップダウンリストから **[Apex Language Server \(Apex 言語サーバ\)]** を選択します。[Apex Language Server \(Apex 言語サーバ\)] というエントリが表示されない場合は、言語サーバが有効になっていません。

Apex 言語サーバが有効になっていない場合は、次の操作を実行したことを確認します。

1. 有効な `sfdx-project.json` ファイルがある Salesforce DX プロジェクトを開く。
1. Salesforce DX プロジェクトを最上位フォルダとして開く。
1. Java 11 をインストールする。どちらのバージョンもインストールされていない場合は警告が表示されます。

上記の操作をすべて行っても機能しない場合は、VS Code 自体にエラーがないか確認します。VS Code のメニューバーで、**[Help \(ヘルプ\)]** > **[Toggle Developer Tools \(開発者ツールの切り替え\)]** を選択して、**[Console \(コンソール\)]** をクリックし、関連のあるメッセージを探します。

## デバッガのエラーの表示

デバッガが生成したエラーを表示するには、`launch.json` ファイルに `"trace": "all"` を追加します。次に、シナリオを再実行して、VS Code のデバッグコンソールにデバッガログの行を表示します。

## Apex コードのリリース時間の短縮

Apex コードのリリースに時間がかかる場合は、組織の `CompileOnDeploy` 基本設定が `true` になっている可能性があります。この設定についての詳細は、『Apex 開発者ガイド』の[「Apex のリリース」](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_deploying.htm)を参照してください。

## その他のリソース

Apex デバッガのトラブルシューティング情報については、[「Apex 対話型デバッガ」](./ja/apex/interactive-debugger)を参照してください。

VS Code の一般的な情報については、[『Visual Studio Code Docs』](https://code.visualstudio.com/docs)を参照してください。

VS Code 向け Salesforce 拡張機能の大半の機能を実行する Salesforce CLI のトラブルシューティング情報については、『Salesforce DX 開発者ガイド』の[「Salesforce DX のトラブルシューティング」](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_troubleshoot.htm)を参照してください。
