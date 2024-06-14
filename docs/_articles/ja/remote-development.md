---
title: リモート開発
lang: ja
---

## 概要

Salesforce Extension for VS Code は、リモート開発をサポートし、コンテナをフル機能の開発環境として利用することができます。Docker コンテナまたは Windows Subsystems for Linux (WSL) 2 にマウントされたプロジェクトを開いて、完全なコード補完、コードナビゲーション、デバッグなどを使用して編集することができます。

> 注意: リモート開発機能は現在ベータ版です。バグを発見したかフィードバックがある場合は、[GitHub に issue をオープン](./ja/bugs-and-feedback)してください。

リモート開発についての詳細を理解するには、VS Code のドキュメントを参照してください。

- [開発コンテナ](https://code.visualstudio.com/docs/remote/containers#_indepth-setting-up-a-folder-to-run-in-a-container)として [Docker コンテナ](https://www.docker.com/)を使用する
- [開発コンテナ](https://code.visualstudio.com/docs/remote/containers#_indepth-setting-up-a-folder-to-run-in-a-container)として [WSL 2](https://docs.microsoft.com/en-us/windows/wsl/)を使用する
- [フル機能の開発環境](https://code.visualstudio.com/docs/remote/remote-overview)を提供する
- [コンテナに接続](https://code.visualstudio.com/docs/remote/containers)することで開発環境を切り替える

## Docker コンテナの使用

リモート開発に Docker コンテナを使用するには以下の手順に従ってください。

### インストール

開発コンテナでリモート開発を開始するには、以下をインストールします。

- Docker Desktop。システム要件とインストール手順については、以下を参照してください。
  - [Windows](https://docs.docker.com/docker-for-windows/install/): 現在、Docker desktop for windows は Linux Containers のみをサポートしており、[Windows Containers はサポートしていません](https://code.visualstudio.com/docs/remote/containers#_known-limitations)。インストールの際には、Linux Containers のデフォルトオプションを使用してください。
  - [Mac](https://docs.docker.com/docker-for-mac/install/)
  - [Linux](https://docs.docker.com/install/linux/docker-ce/centos/)
- [VS Code](https://code.visualstudio.com/download) の最新版
- [VS Code Remote Development Extension Pack](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.vscode-remote-extensionpack) の最新版
  VS Code と Docker Desktop を OS にインストール後、
  - Windows の場合、コンテナで開きたいソースコードの場所を設定してください。Docker で右クリックし、 **Settings** / **Preferences** > **Shared Drives** / **File Sharing** を選択します。共有がうまくいかない場合は、[Container tips](https://code.visualstudio.com/docs/remote/troubleshooting#_container-tips) を参照してください。
  - Linux の場合、[supported platforms](https://docs.docker.com/install#supported-platforms) を参照してください。ターミナルから、`sudo usermod -aG docker $USER` を実行して、ユーザを `docker` グループに追加します。この設定は、一度サインアウトして再度ログインした後に有効になります。
- [Salesforce Extension Pack](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode) の最新版

### 開発コンテナでプロジェクトを開く

1. 作業したい既存のプロジェクトを開くか、新しいプロジェクトを作成ます。
2. コマンドパレットから、`Remote-Container: Add Development Container Configuration Files` を実行します。
   このコマンドが表示されない場合は、VS Code Remote Development Extension Pack の最新版をインストールしていることを確認してください。

   ![開発コンテナの設定ファイルを追加](./images/add_dev_container.png)

3. テンプレートの一覧から **Salesforce Project** を選択し、`SFDX .devcontainer` フォルダを追加します。このファイルは開発コンテナの設定方法、使用する Dockerfile、インストールする拡張機能を定義します。

   VS Code では開発コンテナの設定ファイルが検出され、コンテナ内のプロジェクトフォルダを再度開くように促されます。ポップアップウィンドウが非表示になる場合は、コマンドパレットから、**Remote-Containers: Reopen in Container** を実行します。

   VS Code は、プロジェクトを初めて開いたときに開発コンテナを作成します。開発コンテナが作成されると、ローカルシステム内のプロジェクトフォルダがコンテナに自動的に接続、マップされ、サイドバーには `Dev Container: Salesforce Project` が表示されます。コンテナでは、Java、Git、Salesforce CLI、および `devcontainer.json` ファイルで定義された他のすべての拡張機能がプリインストールされ設定されます。

   ![開発コンテナ](./images/devcontainer.png)

4. コマンドパレットから、`SFDX: Authorize a Dev Hub (SFDX: Dev Hub を認証)` をコンテナで実行します。[Output \(出力\)] パネル (エディタ領域の下) から、認証を完了するために必要なユーザコードと検証 URL を取得することができます。

   Dev Hub として認証したくない組織にログインしている場合は、必ずログアウトしてください。そうしないと、認証したい組織の認証情報を入力するプロンプトが表示されません。認証が完了すると、`SFDX: Dev Hub を認証 が正常に実行されました` というメッセージが表示されます。成功メッセージが表示されない場合は、正しいユーザコードを入力しているかどうかを確認してから再度実行してください。ログインページでコードの再入力を促されない場合は、コマンドを終了して再度実行してください。

もし興味がある場合は、[デバイス認証フロー](https://help.salesforce.com/articleView?id=remoteaccess_oauth_device_flow.htm&type=5&language=ja) を参照してください。

![認証成功のメッセージ](./images/authorize_message.png)

5. **SFDX: Create a Default Scratch Org (SFDX: デフォルトのスクラッチ組織を作成)** を実行します。
6. **Reopen in Container** をクリックして開発コンテナを構築します。サイドバーには `Dev Container: Salesforce Project` が表示されます。

   既存のプロジェクトの開発コンテナを設定して、フルタイムの開発環境として使用できるようになりました。

## Windows Subsystem for Linux (WSL) 2 を使用

リモート開発に WSL 2 を使用するには以下の手順に従ってください。

### インストール

最初に、WSL 2 を設定します。[Microsoft が提供するインストールガイド](https://docs.microsoft.com/ja-jp/windows/wsl/install-win10)に従ってください。

**重要:** WSL 2 のみを使用してください。WSL 1 には既知の問題があります。 以下の手順は Ubuntu を想定しています。他の Linux ディストリビューションでも動作するはずですが、手順が少し異なる可能性があります。

WSL 2 をインストールした後、Salesforce の開発環境を設定します。Node.js、Salesforce CLI、OpenJDK が必要になります。

Node.js をインストールするには、[Microsoft が提供する手順](https://docs.microsoft.com/ja-jp/windows/dev-environment/javascript/nodejs-on-wsl)に従ってください。node のバージョンを簡単に切り替えるために、NVM を使用することをお勧めします。また、Salesforce の開発では、LTS バージョンの Node.js を使用することをお勧めします。

Node.js の設定が完了したら、以下のコマンドを実行して Salesforce CLI を実行してインストールします。

```
$ npm install sfdx-cli -g
```

JDK をインストールするには、以下のコマンドを実行します。

```
$ sudo apt install openjdk-11-jre-headless
```

JDK のインストールパスを指定するには、以下のコマンドを実行します。

```
$ update-java-alternatives --list
```

出力には `/usr/lib/java-1.11.0-openjdk-amd64` のようなパスが含まれています。このパスを後で使用するためコピーします。

### 開発コンテナでプロジェクトを開く

1. 既存のプロジェクトを開くか、新しいプロジェクトを作成ます。
2. コマンドパレットから、`Remote-Container: Add Development Container Configuration Files` を実行します。
   このコマンドが表示されない場合は、VS Code Remote Development Extension Pack の最新版をインストールしていることを確認してください。

   ![開発コンテナの設定ファイルを追加](./images/add_dev_container.png)

3. テンプレートの一覧から **Salesforce Project** を選択し、`SFDX .devcontainer` フォルダを追加します。このファイルは開発コンテナの設定方法、使用する Dockerfile、インストールする拡張機能を定義します。

   VS Code では開発コンテナの設定ファイルが検出され、コンテナ内のプロジェクトフォルダを再度開くように促されます。**この時点ではまだ実行しないでください。**

4. `.devcontainer/devcontainer.json` ファイルを開き、以下の通り編集します。

   - `"dockerFile": "Dockerfile",` の行を削除
   - `salesforcedx-vscode-apex.java.home` の値に、先ほど`update-java-alternatives --list` コマンドの出力でコピーしたパスを設定

5. コマンドパレットから、**Remote-Containers: Reopen in Container** を実行します。
6. プロジェクトを開いたら、node モジュールをインストールします。VS Code で、リモートの WSL 環境にマウントされた新しいターミナルを開き、`npm i` を実行します。
7. 組織を認証し、スクラッチ組織を作成します。

参考 (VS Code のドキュメント):

- [Opening a Terminal in a Container](https://code.visualstudio.com/docs/remote/containers#_opening-a-terminal)
- [Debugging in a Container](https://code.visualstudio.com/docs/remote/containers#_debugging-in-a-container)
- [Container Specific Settings](https://code.visualstudio.com/docs/remote/containers#_container-specific-settings)
- [Known Limitations](https://code.visualstudio.com/docs/remote/containers#_known-limitations)
- [Common Questions](https://code.visualstudio.com/docs/remote/containers#_common-questions)
