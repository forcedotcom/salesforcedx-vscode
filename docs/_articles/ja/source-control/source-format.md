---
title: ソース形式
lang: ja
---

VS Code 向け Salesforce 拡張機能でソースのプッシュ、プル、リリース、取得に使用するコマンドは、ファイルが \(メタデータ形式ではなく\) ソース形式であると想定しています。ソース形式は、バージョン管理システムで作業しやすいように最適化されています。詳細は、『Salesforce DX 開発者ガイド』の[「Salesforce DX プロジェクトの構造とソース形式」](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_source_file_format.htm)を参照してください。

Force.com IDE ではメタデータ形式を使用していたため、VS Code で Force.com IDE プロジェクトを開くことはできません。このトピックで説明するコマンドを操作するには、メタデータをソース形式に変換するか \(`sf project convert mdapi` を使用\)、新しいプロジェクトを作成して、以前の IDE で使っていたマニフェスト \(`package.xml` ファイル\) を使用して組織からメタデータを取得します。

## メタデータ形式からソース形式への変換および Git 履歴の維持

メタデータ形式の Salesforce プロジェクトを Git でトラッキングしている場合、新しいソース形式に一括変換すると、リビジョン履歴がすべて失われてしまいます。これは、Git には制限が組み込まれており、同時に発生する膨大な量の変更を検出できないためです。解決策は、プロジェクトをより小さな塊でソース形式に変換し、リビジョン履歴を維持できるようにすることです。変換の手順に従うために、[dreamhouse](https://github.com/dreamhouseapp/dreamhouse-sfdx) のプロジェクトを例にしてみましょう。

以下は、`./metadata` フォルダ内のメタデータ形式のコード構造のスナップショットです。

```text
.
├── README.md
└─── metadata
├── objectTranslations
├── objects
│ ├── Bot_Command\_\_c.object
│ └── ...
├── package.xml
├── pages
├── pathAssistants
├── permissionsets
├── quickActions
├── remoteSiteSettings
├── reports
├── staticresources
│ ├── leaflet.resource
│ ├── leaflet.resource-meta.xml
│ └── ...
├── tabs
├── triggers
└── workflows
```

以下の手順に従い、Git の履歴を失うことなく、プロジェクトをメタデータ形式からソース形式に変換します。

1. Git リポジトリの外で一時的な SFDX プロジェクトを作成します。この一時的なプロジェクトには Salesforce のプロジェクトで必要とされるディレクトリ構造や設定ファイルがあります。

   `$ sf project generate -name tempproj`

2. メタデータ内のプロジェクトを一時的なプロジェクトに変換します。

   `$ sf project convert mdapi --root-dir ./project/metadata --output-dir ./tempproj`

   これで、プロジェクトのコピーが 2 つできました。1 つは元の場所にあり、もう 1 つは新しいディレクトリ `temproj` にあり、ソース形式に変換した後のプロジェクトファイルが保存されます。

3. `sfdx-project.json` ファイルおよび `config` フォルダを移動します。ファイル `sfdx-project.json` は、そのディレクトリを Salesforce プロジェクトとして識別します。

   `$ mv ./tempproj/sfdx-project.json ./project/sfdx-project.json`

   `$ mv ./tempproj/confg ./project/config`

4. これらの変更をリポジトリにコミットします。

   `$ git add -A`

   `$ git commit -m "Created sfdx-project.json and config"`

5. Salesforce プロジェクトで必要なフォルダ構造を新規に作成します。

   `$ mkdir ./project/force-app`

   `$ mkdir ./project/force-app/main`

   `$ mkdir ./project/force-app/main/default`

フォルダ構造が整ったので、メタデータ形式をソース形式に変換し始めることができます。

## 単純なメタデータ型の変換

メタデータ型が 1 つまたは 2 つのファイル (ソースファイルと metadata.xml ファイル、または 1 つの xml ファイルのみ) で構成されている場合、以下の手順で変換します。

1. 一時的なプロジェクトから変換されたソースのフォルダ全体 (トリガなど) を適切な新しいフォルダにコピーします。

   `$ mv ./tempproj/force-app/main/default/triggers`
   `./project/force-app/main/default/triggers`

2. 古いメタデータを削除します。

   `$ rm -rf ./project/metadata/triggers`

3. 変更をコミットします。

   `$ git add -A`

   `$ git commit -m "Converted triggers to source format"`

これらの手順を繰り返して、単純なメタデータ形式を含むすべてのファイルまたはフォルダを変換します。

変更が正しく検出されない場合、メタデータフォルダのファイル数が多すぎる可能性があります。そのような場合は、マージ時にリネーム検出の制限を設定することで、1 回のコミットですべてのリネームが可能になります。このリネームの制限を設定するには [merge.renameLimit](https://git-scm.com/docs/git-config/1.5.6.5#git-config-mergerenameLimit) 変数を使用します。このオプションはカスタムオブジェクトに対しては機能しないことに注意してください。

以下のコマンドは、1 回のコミットにおけるリネームの検出制限を設定し、ソース形式に変換します。

```text
`$ git config merge.renameLimit 999999`

`$ sf project convert mdapi --root-dir src --output-dir src2`

`$ rm -rf src`

`$ mv src2 src`

`$ git add -A`

`$ git commit -m "Converted from metadata to source format"`

`$ git config --unset merge.renameLimit # Return the git config option to the default`
```

## 拡張されたソースのメタデータの変換

新しいフォーマットが、単一のメタデータ項目から複数のファイルに分割される拡張ソースタイプ (例えばカスタムオブジェクト) の場合は、変換するための良いアプローチは以下の通りです。

1. Salesforce プロジェクトで必要なフォルダ構造を作成します。

   `$ mkdir ./project/force-app/main/default/objects`

   `$ mkdir ./project/force-app/main/default/objects/MyObject__c`

2. メタデータ形式のファイルをソース形式の場所に移動します。

   `$ mv ./project/metadata/objects/MyObject__c.object /`
   `./project/force-app/main/default/objects/MyObject__c/MyObject__c.object-meta.xml`

3. 変更をコミットします。

   `$ git add -A`

   `$ git commit -m "Moved MyObject to source format location"`

4. ソース形式に変換されたファイルをソース形式の場所に移動し、その場所にある古いメタデータ形式のバージョンを上書きします。

   `$ mv -f ./tempproj/force-app/main/default/objects/MyObject__c/**/*.* ./project/force-app/main/default/objects/MyObject__c`

5. 変更をコミットします。

   `$ git add -A`

   `$ git commit -m "Converted MyObject to source format"`

これらの手順を繰り返して、複数のファイルに分割されているすべてのメタデータ項目を変換します。
