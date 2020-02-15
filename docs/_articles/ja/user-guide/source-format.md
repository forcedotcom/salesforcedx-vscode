---
title: ソース形式
lang: ja
---

VS Code 向け Salesforce 拡張機能でソースのプッシュ、プル、リリース、取得に使用するコマンドは、ファイルが \(メタデータ形式ではなく\) ソース形式であると想定しています。ソース形式は、バージョン管理システムで作業しやすいように最適化されています。詳細は、『Salesforce DX 開発者ガイド』の[「Salesforce DX プロジェクトの構造とソース形式」](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_source_file_format.htm)を参照してください。

Force.com IDE ではメタデータ形式を使用していたため、VS Code で Force.com IDE プロジェクトを開くことはできません。このトピックで説明するコマンドを操作するには、メタデータをソース形式に変換するか \(`sfdx force:mdapi:convert` を使用\)、新しいプロジェクトを作成して、以前の IDE で使っていたマニフェスト \(`package.xml` ファイル\) を使用して組織からメタデータを取得します。

ソース形式への変換と Git 履歴の管理についての詳細は、[このブログ投稿](https://ntotten.com/2018/05/11/convert-metadata-to-source-format-while-maintain-git-history/)を参照してください。
