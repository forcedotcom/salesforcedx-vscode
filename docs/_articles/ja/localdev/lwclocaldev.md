---
title: ローカル開発 (ベータ)
lang: ja
---

ローカルの開発サーバは、コンピュータ上に Lightning Web コンポーネント対応のサーバを構成して実行する Salesforce CLI プラグインです。組織にコンポーネントをリリースすることなく、Lightning Web コンポーネントを開発し、ライブで変更を確認することができます。

## VS Code で ローカル開発の Salesforce CLI コマンドを実行する

ローカルの開発サーバでは、以下の Salesforce CLI コマンドを使用します。

`command` + `shift` + `p` を押して VS Code のコマンドパレットから、コマンドを表示します。「local development」と入力すると、3 つのコマンドがすべて表示されます。

![VS Code のローカル開発用コマンド](./images/vscode_localdev_sfdx_commands.png)

**SFDX: Open Local Development Home \(SFDX: ローカルの開発サーバを開く\)**
ローカルの開発サーバが現在起動していない場合、このコマンドはサーバを起動し、Web ブラウザで `localhost:3333` を開きます。サーバが既に起動している場合は、このコマンドは単にブラウザで `localhost:3333` を開きます。

**SFDX: Start Local Development Server \(SFDX: ローカルの開発サーバを開始\)**  
このコマンドは、ローカルの開発サーバを起動します。VS Code から既にサーバを起動している場合は、VS Code はブラウザで開くか、再起動するかのオプションを提示します。既にコマンドラインからサーバを起動している場合は、VS Code の出力コンソールにエラーが表示されます。

> **トラブルシューティングのヒント:** サーバが起動できないエラーが表示された場合、ポートがすでに使用されているか、プロセスがまだ実行中である可能性があります。VS Code を使用している場合は、サーバのポート (デフォルトでは`3333`) のプロセスを強制終了させることができます。ターミナルウィンドウで CLI を実行している場合は、ターミナルを閉じて、実行中のプロセスを終了してください。

**SFDX: Stop LWC Local Development Server \(SFDX: ローカルの開発サーバを停止\)**
このコマンドは、ローカルの開発サーバを停止します。

**VS Code で Lightning Web コンポーネントをプレビューする**
Lightning Web コンポーネントをプレビューするには、コンポーネントの HTML、CSS、JavaScript ファイル内の任意のコード行を右クリックします。また、HTML、CSS、JavaScript のファイル名やコンポーネントのフォルダを右クリックすることもできます。

次の例は HTML コードから`c-hello`をプレビューします。
![HTMLからコンポーネントをプレビュー](./images/vscode_localdev_preview_html.png)

次の例は HTML ファイルから `c-hello` をプレビューします。
![コンポーネントをファイルからプレビューします](./images/vscode_localdev_file_preview.png)

SFDX: コンポーネントをローカルでプレビュー (SFDX: Preview Component Locally) を選択すると、コマンドパレットにプレビューオプションのリストが表示されます。コンポーネントのプレビューは、デスクトップのブラウザで行うか、仮想のモバイルデバイス (iOS または Android) で行うかを選択できます。モバイルプレビューには追加の設定が必要です。[『Lightning Web コンポーネント開発者ガイド』の「モバイルでの Lightning Web コンポーネントのプレビュー (ベータ)」](https://developer.salesforce.com/docs/component-library/documentation/ja-jp/lwc/lwc.mobile_extensions)を参照してください。
![デスクトップのブラウザ、Android のエミュレータ、iOS のシミュレータでプレビューするかを選択します](./images/vscode_localdev_command_palette_preview_options.png)

次の例は、ローカルの開発サーバのデスクトップブラウザでプレビューされたコンポーネントです。
![ブラウザでプレビューされたコンポーネント](./images/vscode_localdev_preview.png)

次の例は、仮想モバイルデバイス上でプレビューされたコンポーネントです。
![仮想モバイルデバイスでプレビューされたコンポーネント](./images/vscode_localdev_preview_ios.png)
