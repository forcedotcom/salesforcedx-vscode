---
title: VS Code を使用したパッケージ開発モデル
---

ソースを追跡する組織で開発を行うパッケージ開発モデルを採用する場合は、ローカルワークステーションとデフォルトの開発組織で行った変更が追跡されます。パッケージ化されたメタデータセットを使用して変更内容を組織間で移動します\(他方、組織開発モデルでは、変更内容を手動で追跡し、変更済みのメタデータのみを他の組織にリリースします\)。詳細は、Trailhead の[「Package Development Model \(パッケージ開発モデル\)」](https://trailhead.salesforce.com/en/content/learn/modules/sfdx_dev_model)モジュールを参照してください。

このトピックでは、Visual Studio Code のソースを追跡する組織 \(スクラッチ組織など\) で作業する方法を説明します。

## 使用開始

まず、VS Code を開いて、プロジェクトを開くか作成します。

- 新しいプロジェクトを開始するには、コマンドパレットを開き \(Windows または Linux では Ctrl+Shift+P キー、macOS では Cmd+Shift+P キーを押す\)、**[SFDX: Create Project \(SFDX: プロジェクトを作成\)]** を実行します。
- 既存のプロジェクトで作業する場合は、**[File \(ファイル\)]** > **[Open \(開く\)]** を選択して、プロジェクトのソースコードを保存したディレクトリに移動します。プロジェクトがソース形式の Salesforce DX プロジェクトでない場合は、『Salesforce DX 開発者ガイド』の[「プロジェクトの設定」](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_workspace_setup.htm)で詳細を参照してください。VS Code 向け Salesforce 拡張機能では、プロジェクトに `sfdx-project.json` が必要で、メタデータがソース形式である場合に限り、ソースが追跡される組織で作業できます。

次に、Dev Hub を承認してスクラッチ組織を作成します。

1. Dev Hub を承認するには、コマンドパレットを開き、**[SFDX: Authorize a Dev Hub \(SFDX: Dev Hub を承認\)]** を実行します。Dev Hub がない場合は、『Salesforce DX 設定ガイド』の[「組織での Dev Hub の有効化」](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_enable_devhub.htm)でこの設定の詳細を参照してください。
1. スクラッチ組織を作成して、開発用のデフォルト組織として設定するには、**[SFDX: Create a Default Scratch Org \(SFDX: デフォルトのスクラッチ組織を作成\)]** を実行します。

## ソースのプッシュとプル

パッケージ開発モデルを使用する場合は、ローカルプロジェクトとデフォルトの開発組織間の同期を簡単に維持できます。パッケージ化されたメタデータセットを使用して変更内容を他の組織にリリースするため、変更を手動で追跡する必要がありません。

ソースを新しいスクラッチ組織にプッシュするには、**[SFDX: Push Source to Default Org \(SFDX: ソースをデフォルト組織にプッシュ\)]** を実行します。

ローカルワークステーションで変更を行った後、すべての変更内容を組織にプッシュするには、**[SFDX: Push Source to Default Org \(SFDX: ソースをデフォルト組織にプッシュ\)]** を実行します。

ブラウザで変更を行った後、**[SFDX: Pull Source from Default Scratch Org \(SFDX: デフォルトのスクラッチ組織からソースをプル\)]** を実行して、プロジェクトを更新します。

ファイルを保存するたびにプッシュするには、ユーザまたはワークスペースの `salesforcedx-vscode-core.push-or-deploy-on-save.enabled` 設定を `true` にします。
