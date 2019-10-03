---
title: 最初のプロジェクトの作成
lang: jp
---

このガイドは、Visual Studio Code を初めて使用する Salesforce 開発者が、無の状態からでも VS Code 向け Salesforce 拡張機能を使用してアプリケーションをリリースできるようにします。

## パート 1: プロジェクトの作成

VS Code 向け Salesforce 拡張機能では、開発者の 2 種類のプロセスまたはモデルがサポートされています。ここでは、これらのモデルについて説明します。どちらのモデルも長所と短所があり、完全サポートされています。

### 組織開発モデル

組織開発モデルでは、Sandbox、Developer Edition \(DE\) 組織、Trailhead Playground、場合によっては本番組織に直接接続し、コードの取得やリリースを直接行うことができます。このモデルは、Force.COM IDE や MavensMate などのツールを使用してこれまで行ってきたタイプの開発と似ています。

このモデルで開発を始める場合は、[「VS Code を使用した組織開発モデル」](./jp/user-guide/org-development-model)を参照してください。

ソースが追跡されない組織 \(Sandbox、DE 組織、Trailhead Playground など\) で開発する場合は、`SFDX: Create Project with Manifest` コマンドを使用してプロジェクトを作成します。別のコマンドを使用した場合は、このコマンドで作成し直したほうがよい場合があります。

ソースが追跡されない組織で作業する場合は、`SFDX: Deploy Source to Org` と `SFDX: Retrieve Source from Org` コマンドを使用します。`Push` と `Pull` コマンドは、ソースを追跡する組織 \(スクラッチ組織\) のみで機能します。

### パッケージ開発モデル

サポートされている 2 つ目のモデルをパッケージ開発モデルといいます。このモデルでは、1 つのパッケージとして組織にリリースされる自己完結型のアプリケーションやライブラリを作成できます。これらのパッケージは通常、ソースを追跡する組織 \(スクラッチ組織\) で開発されます。この開発モデルは、組織のソース追跡、ソース管理、継続的なインテグレーションやリリースなどを使用した、新しいタイプのソフトウェア開発プロセスに向いています。

新規プロジェクトを始める場合は、パッケージ開発モデルを検討することをお勧めします。このモデルで開発を始める場合は、[「VS Code を使用したパッケージ開発モデル」](./jp/user-guide/package-development-model)を参照してください。

スクラッチ組織で開発する場合は、`SFDX: Create Project` コマンドを使用してプロジェクトを作成します。別のコマンドを使用した場合は、このコマンドで作成し直したほうがよい場合があります。

ソースを追跡する組織で作業する場合は、`SFDX: Push Source to Org` と `SFDX: Pull Source from Org` コマンドを使用します。スクラッチ組織で `Retrieve` と `Deploy` コマンドを使用しないでください。

## `sfdx-project.json` ファイル

`sfdx-project.json` ファイルには、プロジェクトに役立つ設定情報が含まれています。このファイルについての詳細は、『Salesforce DX 開発者ガイド』の[「Salesforce DX プロジェクトの設定」](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_config.htm)を参照してください。

この拡張機能を使い始めるうえで、このファイルの最も重要な要素は `sfdcLoginUrl` と `packageDirectories` プロパティです。

`sfdcLoginUrl` は、組織の承認時に使用するデフォルトのログイン URL を指定します。

`packageDirectories` ファイルパスは、プロジェクトのメタデータファイルが保存されている場所を VS Code と Salesforce CLI に伝えます。ファイルにパッケージディレクトリを 1 つ以上設定している必要があります。デフォルト設定は以下のとおりです。`path` という `packageDirectories` プロパティを `force-app` に設定すると、デフォルトでメタデータが `force-app` ディレクトリに格納されます。このディレクトリを `src` などに変更したい場合は、単に `path` の値を変更し、参照先のディレクトリが存在することを確認します。

```json
"packageDirectories" : [
    {
      "path": "force-app",
      "default": true
    }
]
```

## パート 2: ソースの操作

スクラッチ組織での開発についての詳細は、[「VS Code を使用したパッケージ開発モデル」](./jp/user-guide/package-development-model)を参照してください。

ソースを追跡しない組織での開発についての詳細は、[「VS Code を使用した組織開発モデル」](./jp/user-guide/org-development-model)を参照してください。

## パート 3: 本番へのリリース

コードを Visual Studio Code から直接本番にリリースしないでください。deploy および retrieve コマンドは、トランザクション操作をサポートしていないため、リリースの途中で失敗することがあります。また、deploy と retrieve コマンドは、本番へのリリースに必要なテストを実行しません。変更内容を本番にリリースする場合は、[パッケージ化](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_dev2gp.htm)を行うか、[ソースをメタデータ形式に変換](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference_force_source.htm#cli_reference_convert)して、[metadata deploy コマンドを使用](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference_force_mdapi.htm#cli_reference_deploy)します。
