---
title: VS Code を使用した組織開発モデル
lang: jp
---

組織開発モデルを採用する場合は、変更内容を手動で追跡し、変更セットを Sandbox にリリースしてから本番組織にリリースします\(他方、パッケージ開発モデルでは、ソースが追跡される組織で作業し、パッケージ化されたメタデータセットを使用して変更内容を組織間で移動します\)。詳細は、Trailhead の[「Org Development Model \(組織開発モデル\)」](https://trailhead.salesforce.com/content/learn/modules/org-development-model)モジュールを参照してください。

このトピックでは、Visual Studio Code のソースを追跡しない組織 \(Sandbox、Developer Edition \(DE\) 組織、Trailhead Playground など\) で作業する方法を説明します。

![デモ](./images/changeset-demo.gif)

> 注意: このトピックで取り上げる機能はベータ版です。バグを見つけた場合やフィードバックがある場合は、[GitHub の問題を登録](../bugs-and-feedback)してください。

## 使用開始

まず、VS Code を開いてプロジェクトを作成します。マニフェストを使用してプロジェクトを作成する場合は、コマンドパレットを開き \(Windows または Linux では Ctrl+Shift+P キー、macOS では Cmd+Shift+P キーを押す\)、**[SFDX: Create Project with Manifest \(SFDX: マニフェストを使用してプロジェクトを作成\)]** を実行します。

![プロジェクトの作成](./images/create-project-with-manifest.png)

次に、開発を行う組織を承認します。ログインプロセスを開始するには、コマンドパレットを開き、**[SFDX: Authorize an Org \(SFDX: 組織を承認\)]** を実行します。

![組織の承認](./images/authorize-org-command.png)

ログイン URL を選択してプロジェクトに名前を付けると、ブラウザが開き、組織にログインできます。ログインが済んだら、ブラウザを閉じて VS Code に戻ります。

## マニフェスト \(`package.xml`\) ファイル

Sandbox、DE 組織、Trailhead Playground に接続している場合、作業するすべてのメタデータを組織から取得する一番簡単な方法は、`package.xml` ファイルを使用することです。このファイルがまだない場合は、提供されたファイルを更新するか、`manifest` ディレクトリに `package.xml` ファイルを作成します。

取得する各種のメタデータ型をこのファイルに追加します。`package.xml` ファイルについての詳細は、『メタデータ API 開発者ガイド』の[「package.xml マニフェストファイルのサンプル」](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/manifest_samples.htm)を参照してください。

[ソースを取得](#retrieve-source)すると、プロジェクトが次のような構造になります。

```text
your-app
├── README.md
├── sfdx-project.json
├── .sfdx
├── .vscode
│   ├── extensions.json
│   └── settings.json
├── force-app
|   └── main
|       └── default
|           ├── aura
|           ├── classes
|           └── objects
└── manifest
    └── package.xml
```

## ソースの取得

組織を承認したら、その組織からソースを取得します。Salesforce ユーザインターフェースで変更を行った後、その変更内容をデフォルト組織から取得します\(変更内容は必ず追跡します。組織開発モデルを使用する場合は、変更が自動的に追跡されません\)。

> 注意: 組織からソースを取得すると、ソースファイルのローカルバージョンが上書きされます。

![組織からソースを取得](./images/retrieve-source-from-org.png)

ソースを追跡せずに \(スクラッチ組織ではない\) 組織からソースを取得する手順は、次のとおりです。

- Visual Studio Code エクスプローラまたはエディタでマニフェストを右クリックし、**[SFDX: Retrieve Source in Manifest from Org \(SFDX: 組織からマニフェストのソースを取得\)]** を選択します。
- エディタにマニフェストファイルを開いたまま、コマンドパレットを開き \(Windows または Linux では Ctrl+Shift+P キー、macOS では Cmd+Shift+P キーを押す\)、**[SFDX: Retrieve Source in Manifest from Org \(SFDX: 組織からマニフェストのソースを取得\)]** を実行します。
- Visual Studio Code エクスプローラで、ソースファイルまたはディレクトリを右クリックします。**[SFDX: Retrieve Source from Org \(SFDX: 組織からソースを取得\)]** を選択します。
  > 注意: 取得は、\(ファイルツリーの\) 選択した項目の下位にネストされているメタデータでのみ実行されます。たとえば、`classes` フォルダを右クリックすると、**そのディレクトリに既存する**すべての Apex クラスが取得またはリリースされます。`classes` などのディレクトリで取得操作を実行した場合、組織のすべての Apex クラスが取得されるわけではありません。そのフォルダに既存のクラスに対する更新のみが取得されます。新しい Apex クラスを取得する場合は、そのクラス \(またはすべての Apex クラス\) を `package.xml` ファイルに追加し、マニフェストファイルを使用してソースを取得します\(また、ターミナルを使用して `sfdx force:source:retrieve --metadata ApexClass:YourApexClass` を実行することもできます\)。
- エディタに開いているソースファイルで、編集ペインの任意の場所を右クリックします。**[SFDX: Retrieve This Source File from Org \(SFDX: 組織からこのソースファイルを取得\)]** を選択します。
- エディタにソースファイルを開いたまま、コマンドパレットを開き \(Windows または Linux では Ctrl+Shift+P キー、macOS では Cmd+Shift+P キーを押す\)、**[SFDX: Retrieve This Source File from Org \(SFDX: 組織からこのソースファイルを取得\)]** を実行します。

## ソースのリリース

コードに変更を行った後、その変更内容を組織にリリースします。

> 注意: ソースを組織にリリースすると、組織のメタデータがソースファイルのローカルバージョンで上書きされます。

![ソースを組織にリリース](./images/deploy-source-to-org.png)

ソースを追跡せずに \(スクラッチ組織ではない\) 組織にソースをリリースする手順は、次のとおりです。

- Visual Studio Code エクスプローラまたはエディタでマニフェストを右クリックし、**[SFDX: Deploy Source in Manifest to Org \(SFDX: 組織にマニフェストのソースをリリース\)]** を選択します。
- エディタにマニフェストファイルを開いたまま、コマンドパレットを開き \(Windows または Linux では Ctrl+Shift+P キー、macOS では Cmd+Shift+P キーを押す\)、**[SFDX: Deploy Source in Manifest to Org \(SFDX: 組織にマニフェストのソースをリリース\)]** を実行します。
- Visual Studio Code エクスプローラで、ソースファイルまたはディレクトリを右クリックします。**[SFDX: Deploy Source to Org \(SFDX: 組織にソースをリリース\)]** を選択します。
- エディタに開いているソースファイルで、編集ペインの任意の場所を右クリックします。**[SFDX: Deploy This Source File to Org \(SFDX: 組織にこのソースファイルをリリース\)]** を選択します。
- エディタにソースファイルを開いたまま、コマンドパレットを開き \(Windows または Linux では Ctrl+Shift+P キー、macOS では Cmd+Shift+P キーを押す\)、**[SFDX: Deploy This Source File to Org \(SFDX: 組織にこのソースファイルをリリース\)]** を実行します。
- ファイルを保存するたびにリリースするには、ユーザまたはワークスペースの `salesforcedx-vscode-core.push-or-deploy-on-save.enabled` 設定を `true` にします。

## ソースの削除

プロジェクトと、ソースが追跡されない組織からソースを削除する手順は、次のとおりです。

- Visual Studio Code エクスプローラで、マニフェスト、ソースファイル、ディレクトリのいずれかを右クリックします。**[SFDX: Delete from Project and Org \(SFDX: プロジェクトおよび組織から削除\)]** を選択します。
- エディタで開いているファイルを右クリックし、**[SFDX: Delete This from Project and Org \(SFDX: プロジェクトおよび組織からこれを削除\)]** を選択します。
- エディタにソースファイルを開いたまま、コマンドパレットを開き \(Windows または Linux では Ctrl+Shift+P キー、macOS では Cmd+Shift+P キーを押す\)、**[SFDX: Delete from Project and Org \(SFDX: プロジェクトおよび組織から削除\)]** を実行します。
