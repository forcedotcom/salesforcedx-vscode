---
title: ヒントとコツ
---

## VS Code 拡張機能を開発タスク別に整理

VS Code 拡張機能を開発タスク別に整理しておくと、現在取り組んでいるタスクには必要のない拡張機能をしまっておくことができます。必要な拡張機能だけがあれば、VS Code の起動時間が短縮され、ショートカットキーが干渉し合うこともありません。Salesforce と連携する拡張機能のみが起動するように VS Code を設定する手順は、次のとおりです。

1.  シェルの起動スクリプトに `code-sfdx` エイリアスを追加します。

    - Windows

      1. VS Code をインストールするときに、`code` をプロンプトの一部としてインストールします。詳細は、『Visual Studio Code Docs』の[「Visual Studio Code on Windows \(Windows の Visual Studio Code\)」](https://code.visualstudio.com/docs/setup/windows#_installation)を参照してください。
      1. Git Bash を開きます\(Git Bash は Salesforce CLI の一部としてインストールされています\)。
      1. .bashrc ファイルがあるかどうかを確認します。ない場合は、次のコマンドを実行して作成します。  
         `touch .bashrc`
      1. .bashrc ファイルに次の行を追加します。  
         `alias code-sfdx='code --extensions-dir ~/.sfdx-code'`

    - macOS または Linux

      1.  VS Code を開きます。
      1.  コマンドパレットを開くには、Cmd+Shift+P キー \(macOS\) または Ctrl+Shift+P キー \(Linux\) を押します。
      1.  **[Shell command: Install 'code' command in PATH \(シェルコマンド: PATH で 'code' コマンドを実行\)]** コマンドを実行します。
          ![コマンドパレットから [Shell command: Install 'code' command in PATH (シェルコマンド: PATH で 'code' コマンドを実行)] を選択](../../images/invoke_shell_command.png)

                このコマンドで、任意のターミナルから直接 `code` を起動できます。

      1.  任意のターミナルで、シェルの起動スクリプトを開きます。

          Bash を使用している場合、起動スクリプトは通常 `.bashrc` または `.bash_profile` ファイルです。Z Shell を使用している場合は、通常 `.zshrc` ファイルです。上記の名前のファイルがない場合は、ホームディレクトリ \(`Macintosh HD/users/yourName` など\) で `.bashrc` というファイルを作成します。

      1.  シェルの起動スクリプトに次の行を追加します。  
          `alias code-sfdx='code --extensions-dir ~/.sfdx-code'`

1.  新しいターミナルウィンドウを開くか、現在のターミナルから次のいずれかのコマンドを実行します。  
    `source .bashrc`  
    `source .bash_profile`  
    `source .zshrc`

1.  ターミナルから、`code-sfdx` を実行して、各自の拡張機能のみを含める VS Code のインスタンスを起動します。

    > 注意: `code-sfdx` を初めて起動するときは、VS Code の真新しいインスタンスのため、拡張機能が 1 つもありません。

1.  **[View \(表示\)]** > **[Extensions \(拡張機能\)]** を選択します。

1.  [Salesforce Extension Pack](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode) 拡張機能 \(と Salesforce の開発に使用する[他の拡張機能](recommended-extensions)\) をインストールします。

1.  次回 Salesforce DX プロジェクトで作業するときに、`code-sfdx` を使用して、拡張機能が揃った VS Code を起動できます。

エイリアスはいくつでも追加でき、`extensions-dir` ディレクトリも拡張機能を整理するために必要なだけ設定できます。
