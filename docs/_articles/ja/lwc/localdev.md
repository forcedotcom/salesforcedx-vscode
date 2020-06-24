---
title: ローカル開発 (ベータ)
lang: ja
---

> [Lightning Web Components Developer Guide](https://developer.salesforce.com/docs/component-library/documentation/lwc/lwc.get_started_local_dev) のドキュメント全文を参照してください。

ローカル開発サーバは、お使いのコンピュータ上で Lightning Web コンポーネントに対応したサーバを設定して実行する Salesforce CLI プラグインです。Lightning Web コンポーネントを開発して、コンポーネントを組織に公開することなく、ライブで変更を確認することができます。

## VS Code でローカル開発の SFDX コマンドを実行

ローカル開発サーバは以下の SFDX コマンドを使用します。

ローカル開発サーバの SFDX コマンドを確認するには、VS Code で、`Ctrl + Shift + P` キー (Windows、Linux) または `Cmd + Shift + P` キー (macOS) を押してコマンドパレットを開きます。"local development (ローカル開発)" と入力することで、3 つのコマンドがすべて表示されます。

![VS Code のコマンド](./images/vscode_localdev_sfdx_commands.png)

**SFDX: Open Local Development Server (SFDX: ローカル開発サーバを開く)**  
ローカル開発サーバが現在実行されていない場合、このコマンドはサーバを起動し、Web ブラウザで localhost:3333 を開きます。サーバが既に起動している場合は、ブラウザで localhost:3333 を開きます。

**SFDX: Start Local Development Server (SFDX: ローカル開発サーバを開始)**  
このコマンドは、ローカル開発サーバを起動します。VS Code から既にサーバを起動している場合、VS Code はそれをブラウザで開くか、再起動するかを選択肢を表示します。コマンドラインから既にサーバを起動している場合、VS Code は出力コンソールにエラーを表示します。

**SFDX: Stop Local Development Server (SFDX: ローカル開発サーバを停止)**  
このコマンドはローカル開発サーバを停止します。

**VS Code で Lightning Web コンポーネントのプレビュー**  
Lightning Web コンポーネントをプレビューするには、コンポーネントの HTML、CSS、または JavaScript ファイル内の任意のコード行を右クリックします。また、HTML、CSS、JavaScript のファイル名やコンポーネントフォルダを右クリックすることもできます。

HTML コードから `c-hello` をプレビューする
![HTMLからコンポーネントをプレビューする](./images/vscode_localdev_preview_html.png)

HTML ファイルから `c-hello` をプレビューする
![ファイルからコンポーネントをプレビューする](./images/vscode_localdev_file_preview.png)

ローカル開発サーバ上でプレビューされたコンポーネントは以下の通りです。
![ローカル開発でプレビューされたコンポーネント](./images/vscode_localdev_preview.png)
