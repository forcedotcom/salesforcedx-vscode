---
title: Force.com IDE から VS Code 向け Salesforce 拡張機能への移行
---

どの組織でも Force.com IDE の使い慣れたワークフローに従って開発することができます。このトピックでは、既存のプロジェクトを Force.com IDE から VS Code に移行する 2 通りの手順について説明します。

> 注意: このトピックで取り上げる機能はベータ版です。バグを見つけた場合やフィードバックがある場合は、[GitHub の問題を登録](../bugs-and-feedback)してください。

## 移行が必要な理由

移行を始める前に、Force.com IDE プロジェクトと VS Code プロジェクトの構造上の違いを理解しておくことが大切です。開発者に影響を及ぼす主な違いとして、Salesforce DX プロジェクトファイルとローカルソースの形式の 2 つが挙げられます。

### 1. プロジェクトファイル

VS Code のどの Salesforce プロジェクトにも `sfdx-project.json` ファイルが必要です。このファイルは、作業する組織の種別 \(本番、Sandbox など\) や、ソースコードがローカルワークステーションのどこに保存されるかなど、プロジェクトレベルの各種オプションを指定します。`sfdx-project.json` ファイルについての詳細は、『Salesforce DX 開発者ガイド』の[「Salesforce DX プロジェクトの設定」](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_config.htm)を参照してください。

### 2. ソース形式

Salesforce プロジェクトは、ローカルメタデータに[ソース形式](../user-guide/source-format)という新しい形式とディレクトリ構造を使用します。ソース形式は、バージョン管理しやすいように最適化されています。この特長は、複数のディレクトリやファイルに拡張するオブジェクトと、静的リソースを直接操作できることです。ただし、新たな形式になるため、VS Code で既存のプロジェクトを開いて、すぐ機能させることはできません。新しい形式に変換する必要があります。

## 使用する移行プロセスの決定

Force.com IDE から VS Code への移行には 2 通りの実行方法があります。1 つ目の一番シンプルな方法は、既存の `package.xml` ファイルを使用して、新しいプロジェクトをゼロから作成することです。次の条件に該当する場合は、この手法が推奨されます。

1. プロジェクトが比較的小規模である \(何千ものファイルがあるわけではない\)。
2. すべてのコードがすでに組織に保存されている。
3. バージョン管理を使用しない \(または、ソース履歴が失われても構わない\)。

2 つ目の方法は、既存のプロジェクトを変換するもので、より複雑です。ただし、比較的大きなプロジェクトで使用でき、バージョン管理履歴を維持できます。

## マニフェスト \(`package.xml`\) ファイルを使用した移行 \(簡便\)

Force.com IDE プロジェクトにすでに `package.xml` ファイルがある場合は、そのプロジェクトをわずか数ステップで新しい VS Code プロジェクトに簡単に移行できます。始める前に、マシンが [VS Code を使用した Salesforce 開発](../getting-started/install)に適した設定になっていることを確認します。

1. VS Code を開いて、プロジェクトを作成します。VS Code の開始画面から、Ctrl+Shift+P キー \(Windows、Linux\) または Cmd+Shift+P キー \(macOS\) を押して、コマンドパレットを表示します。project-creation コマンドを検索するには、「`SFDX: Create Project with Manifest`」と入力していきます。このコマンドを選択して Enter キーを押します。

   ![マニフェストを使用したプロジェクトの作成](../../create-project-with-manifest.png)

1. プロジェクトの場所を選択して、`Create Project` をクリックします。
1. 次に、Force.com IDE プロジェクトで使用した `package.xml` ファイルの内容をコピーします。
1. VS Code で、`manifest` ディレクトリを展開して、`package.xml` ファイルを開きます。
1. `package.xml` ファイルの内容を、Force.com IDE プロジェクトのファイルからコピーした内容に置換します。
1. 次に、組織を承認します。コマンドパレット \(Windows または Linux では Ctrl+Shift+P キー、macOS では Cmd+Shift+P キー\) を使用して、**[SFDX: Authorize an Org \(SFDX: 組織を承認\)]** コマンドを選択します。このコマンドによって Salesforce ログインページが開きます。ログインして、プロンプトを受け入れます。

   > 注意: 通常 Sandbox 組織に接続している場合は、組織を承認する前に `sfdx-project.json` ファイルを編集して `sfdcLoginUrl` を `https://test.salesforce.com` に設定します。

1. ブラウザタブを閉じて VS Code に戻ります。
1. VS Code エディタで、`package.xml` ファイル内を右クリックし、**[SFDX: Retrieve Source in Manifest from Org \(SFDX: 組織からマニフェストのソースを取得\)]** を選択します。
1. ソースが `sfdx-project.json` ファイルで指定したディレクトリにダウンロードされます。デフォルトは `force-app/main/default` です。

これでプロジェクトが Force.com IDE から VS Code に移行しました。新しいコードエディタを使用して、通常どおり作業を続行できます。このプロセスについての詳細は、[「組織開発モデル」](../user-guide/org-development-model)を参照してください。

## 変換による移行 \(高度\)

プロジェクトの移行の 2 つ目のオプションは、インプレース変換です。このオプションはやや複雑ながら、メタデータをすべてダウンロードする必要がなく、バージョン管理履歴を維持するオプションがあります。始める前に、マシンが [VS Code を使用した Salesforce 開発](../getting-started/install)に適した設定になっていることを確認します。

1. まず、プロジェクトが次の形式であるとします。

   ```text
   .
   ├── salesforce.schema
   └─── src
       ├── objectTranslations
       ├── objects
       │   ├── Bot_Command__c.object
       │   └── ...
       ├── pages
       ├── pathAssistants
       ├── permissionsets
       ├── quickActions
       ├── remoteSiteSettings
       ├── reports
       ├── staticresources
       ├── tabs
       ├── triggers
       └── package.xml
   ```

1. 最初のステップとして、新しいプロジェクト形式をサポートするために、数種のファイル \(一部は必須、他は省略可能\) を追加する必要があります。この中で一番重要なファイルは `sfdx-project.json` です。これらのファイルを作成する最も簡単な方法は、一時的なプロジェクトを作成して、そこからコピーすることです。このために次のコマンドを実行します。

   ```bash
   $ sfdx force:project:create -n ../tempproj --template standard
   ```

1. 次に、この一時プロジェクトから次の 2 つを各自のプロジェクトにコピーします。

   ```bash
   $ mv ../tempproj/sfdx-project.json ./sfdx-project.json
   $ mv ../tempproj/config ./config
   ```

   > 注意: ソースコントロールを使用している場合は、途中のステップごとにコミットすることをお勧めします。

1. デフォルトの `sfdx-project.json` ファイルは、ソースコードが `force-app` ディレクトリにあるものと想定しています。このデフォルトオプションを使用することもできますが、この例ではソースファイルが `src` に常駐しています。ファイルを `src` ディレクトリに保存するには、`sfdx-project.json` の次のコードを変更します。

   ```json
    "packageDirectories": [
        {
            "path": "src",
            "default": true,
        }
    ],
   ```

1. 次に、現在のソースを新しいフォルダに移動します。

   ```bash
   $ mv ./src ./src_old
   ```

1. これでプロジェクトを設定できたため、次はメタデータを[ソース形式](../user-guide/source-format)に変換します。変換するために、次のコマンドを実行します。


    ```bash
    $ sfdx force:mdapi:convert --rootdir ./src_old --outputdir ./src
    ```

1. 最後に、古いソースを削除します。

   ```bash
   $ rm -rf ./src_old
   ```

1. これでメタデータがソース形式になりました。

### バージョン管理に関する考慮事項

メタデータのソース形式への変換について特筆すべき点は、大量の名前変更が行われるため、バージョン管理システムに何らかの設定やスクリプトが必要になる可能性があることです。たとえば、Git はデフォルトで、一度に少数のファイルの名前変更のみを追跡します。この点を修正するには、次の設定を変更します。

```bash
$ git config merge.renameLimit 999999
```

名前変更が完了し、すべてコミットされたら、Git をデフォルトの設定に戻すことができます。

```bash
$ git config --unset merge.renameLimit
```

また、移行や名前変更をまとめて行うこともできます。詳細は、[このブログ投稿](https://ntotten.com/2018/05/11/convert-metadata-to-source-format-while-maintain-git-history/)を参照してください。
