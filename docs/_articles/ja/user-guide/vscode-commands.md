---
title: コマンドリファレンス
lang: ja
---

VS Code 向け Salesforce 拡張機能からコマンドを実行するには、Ctrl+Shift+P キー (Windows or Linux) または Cmd+Shift+P (macOS) キーを押し、コマンドパレットで **SFDX** と入力します。  
![SFDX コマンドでフィルタされたコマンドパレット](./images/sfdx_commands.png)

コマンドの実行が終了 (成功、失敗、キャンセルにより) すると 、ウィンドウの上部に通知が表示されます。
![ソースがスクラッチ組織に正常にプッシュされたことを示す通知](./images/command_success_notification.png)

実行したコマンドの出力結果を表示するには、**View (表示)** > **Output (出力)** を選択し、ドロップダウンメニューから **Salesforce CLI** を選択します。あるいは、完了通知の **Show (表示)** をクリックします。  
![Apex テスト実行の結果を表示する出力ビュー](./images/output_view.png)

## 利用可能なコマンド

以下では、VS Code 向け Salesforce 拡張機能で利用可能なコマンド、その使用方法、実行するされる CLI コマンド、および詳細なリファレンスについて記載します。

### プロジェクトを作成する

- **SFDX: Create Project (SFDX: プロジェクトを作成)**
  - カレントディレクトリに Salesforce プロジェクトを作成します。 このコマンドは、ディレクトリが Salesforce DX プロジェクトであることを示す、標準のディレクトリ構造と設定ファイルを作成します。
  - 実行される CLI コマンドは `force:project:create --template standard` です。
  - [「プロジェクトの設定」](https://developer.salesforce.com/docs/atlas.ja-jp.sfdx_dev.meta/sfdx_dev/sfdx_dev_workspace_setup.htm)を参照してください。
- **SFDX: Create Project with Manifest (SFDX: マニフェストファイルを使用してプロジェクトを作成)**
  - カレントディレクトリに Salesforce プロジェクトを作成し、Apex、Visualforce、Lightning Web コンポーネントなどのコンポーネントを取得するためのデフォルトのマニフェスト (package.xml) を生成します。
  - 実行される CLI コマンドは `force:project:create --template standard --manifest` です。
  - [「package.xml マニフェストファイルのサンプル」](https://developer.salesforce.com/docs/atlas.ja-jp.api_meta.meta/api_meta/manifest_samples.htm)を参照してください。

### 組織を認証する

- **SFDX: Authorize an Org (SFDX: 組織を認証)**
  - 指定されたログイン URL と名前を使用して組織を認証し、認証された組織をデフォルトのユーザ名に設定します。
  - 実行される CLI コマンドは `force:auth:web:login --setalias --instanceurl --setdefaultusername` です。リモート開発環境の場合は、`force:auth:device:login` が実行されます。
  - [「認証」](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth.htm)を参照してください。
- **SFDX: Authorize a Dev Hub (SFDX: Dev Hub を認証)**
  - 組織を認証し、認証された組織をスクラッチ組織作成のためのデフォルトの Dev Hub に設定します。
  - 実行される CLI コマンドは `force:auth:web:login --setdefaultdevhubusername` です。リモート開発環境の場合は、`force:auth:device:login --setdefaultdevhubusername` が実行されます。
  - [「Web ベースフローを使用した組織の認証」](https://developer.salesforce.com/docs/atlas.ja-jp.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_web_flow.htm)を参照してください。
- **SFDX: Create a Default Scratch Org (SFDX: デフォルトのスクラッチ組織を作成)**
  - スクラッチ組織を作成し、作成された組織をデフォルトのユーザ名に設定します。
  - 実行される CLI コマンドは `force:org:create --setdefaultusername` です。
  - [「Salesforce DX のユーザ名と組織」](https://developer.salesforce.com/docs/atlas.ja-jp.sfdx_dev.meta/sfdx_dev/sfdx_dev_cli_usernames_orgs.htm)を参照してください。
- **SFDX: Open Default Org (SFDX: デフォルトの組織を開く)**
  - ブラウザでデフォルトの組織を開きます。
  - 実行される CLI コマンドは `force:org:open` です。
  - 関連情報は、[「スクラッチ組織の作成」](https://developer.salesforce.com/docs/atlas.ja-jp.sfdx_dev.meta/sfdx_dev/sfdx_dev_scratch_orgs_create.htm)を参照してください。
- **SFDX: Log Out from All Authorized Orgs (SFDX: すべての認証済み組織からログアウト)**
  - 確認のプロンプトを表示することなく、認証されたすべての Salesforce 組織からログアウトします。
  - 実行される CLI コマンドは `force:auth:logout --all --noprompt` です。
  - [「組織からのログアウト」](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_logout.htm)を参照してください。

### 組織とローカルのプロジェクトを同期する

- **SFDX: Retrieve Source from Org (SFDX: 組織からソースを取得)**
  - 選択したファイルやディレクトリのソースをデフォルトの組織から取得します。Sandbox や本番組織のようなソース追跡されない組織からソースを取得するには、このコマンドを使用します。取得したソースは、対応するローカルのソースファイルを上書きします。
  - 実行される CLI コマンドは `force:source:retrieve` です。
  - [「任意の組織に対する開発」](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_develop_any_org.htm)を参照してください。
- **SFDX: Retrieve This Source from Org (SFDX: このソースを組織から取得)**
  - VS Code で開いたファイルのソースを組織から取得します。
  - 実行される CLI コマンドは `force:source:retrieve --sourcepath` です。
- **SFDX: Retrieve Source in Manifest from Org (SFDX: マニフェストファイルのソースを組織から取得)**
  - マニフェストファイルにリストしたメタデータコンポーネントを組織からローカルプロジェクトへ取得します。
  - 実行される CLI コマンドは `force:source:retrieve --manifest` です。
- **SFDX: Deploy Source to Org (SFDX: 組織へソースをデプロイ)**
  - 選択したファイルまたはディレクトリのメタデータをソース形式で組織にデプロイします。ソース追跡されない組織にソースをデプロイするには、このコマンドを使用します。デプロイしたソースは、組織内のメタデータをローカルバージョンで上書きします。
  - 実行される CLI コマンドは `force:source:deploy` です。
- **SFDX: Deploy This Source to Org (SFDX: このソースを組織へデプロイ)**
  - VS Code のエディタで開いたファイルのソースを組織へデプロイします。
  - 実行される CLI コマンドは `force:source:deploy --sourcepath` です。
- **SFDX: Deploy Source in Manifest to Org (SFDX: マニフェストファイルのソースを組織へデプロイ)**
  - マニフェストファイルのメタデータコンポーネントを組織へデプロイします。
  - 実行される CLI コマンドは `force:source:deploy --manifest` です。
- **SFDX: Delete from Project and Org (SFDX: プロジェクトおよび組織から削除)**
  - ローカルのプロジェクトおよびソース追跡されない組織からソースを削除します。
  - 実行される CLI コマンドは `force:source:delete` です。
  - [「追跡されないソースの削除」](https://developer.salesforce.com/docs/atlas.ja-jp.224.0.sfdx_dev.meta/sfdx_dev/sfdx_dev_develop_any_org.htm)のセクションを参照してください。
- **SFDX: Pull Source from Default Scratch Org (SFDX: スクラッチ組織からソースをプル)**
  - スクラッチ組織から変更をローカルのプロジェクトにプルします。このコマンドが競合を検出した場合、プル操作を終了し、ターミナルに競合の情報を表示します。ソース追跡される組織からソースをプルするには、このコマンドを使用します。
  - 実行される CLI コマンドは `force:source:pull` です。
  - [「スクラッチ組織からプロジェクトへのソースのプル」](https://developer.salesforce.com/docs/atlas.ja-jp.sfdx_dev.meta/sfdx_dev/sfdx_dev_pull_md_from_scratch_org.htm)を参照してください。
- **SFDX: Pull Source from Default Scratch Org and Override Conflicts (SFDX: デフォルトのスクラッチ組織からソースをプルして競合を上書き)**
  - スクラッチ組織から変更をローカルのプロジェクトにプルします。競合がある場合、スクラッチ組織の変更はローカルプロジェクトの変更を上書きします。
  - 実行される CLI コマンドは `force:source:pull --forceoverwrite` です。
- **SFDX: Push Source to Default Scratch Org (SFDX: デフォルトのスクラッチ組織へソースをプッシュ)**
  - ローカルプロジェクトの変更をデフォルトの組織にプッシュします。このコマンドが競合を検出した場合、プッシュ操作を終了し、ターミナルに競合の情報を表示します。
  - 実行される CLI コマンドは `force:source:push` です。
  - [「スクラッチ組織へのソースの転送」](https://developer.salesforce.com/docs/atlas.ja-jp.sfdx_dev.meta/sfdx_dev/sfdx_dev_push_md_to_scratch_org.htm)を参照してください。
- **SFDX: Push Source to Default Scratch Org and Override Conflicts (SFDX: デフォルトのスクラッチ組織へソースをプッシュして競合を上書き)**
  - ローカルプロジェクトの変更をデフォルトの組織にプッシュします。競合がある場合、ローカルプロジェクトの変更はスクラッチ組織の変更を上書きします。
  - 実行される CLI コマンドは `force:source:push --forceoverwrite` です。
- **SFDX: View All Changes (Local and in Default Scratch Org) (SFDX: すべての変更を表示 (ローカルとデフォルトのスクラッチ組織内))**
  - デフォルトの組織 (リモート) とプロジェクト (ローカル) の新しいメタデータ型、変更されたメタデータ型 (競合がある場合はそれを示します)、削除されたメタデータ型を表示します。
  - 実行される CLI コマンドは `force:source:status` です。
  - [「プロジェクトとスクラッチ組織の間での変更の追跡」](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_track_changes.htm)を参照してください。
- **SFDX: View Local Changes (SFDX: ローカルの変更を表示)**
  - ローカルプロジェクトで行われた変更を表示します。これは、ローカルの変更をスクラッチ組織にプッシュする前に確認するのに役立ちます。
  - 実行される CLI コマンドは `force:source:status --local` です。
  - 関連情報は[「ソースのプッシュ」](https://developer.salesforce.com/docs/atlas.ja-jp.sfdx_dev.meta/sfdx_dev/sfdx_dev_push_md_to_scratch_org.htm)を参照してください。
- **SFDX: View Changes in Default Scratch Org (SFDX: デフォルトのスクラッチ組織内の変更を表示)**
  - スクラッチ組織で行われた変更を表示します。これは、スクラッチ組織の変更をローカルプロジェクトにプルする前に確認するのに役立ちます。
  - 実行される CLI コマンドは `force:source:status --remote` です。

### 組織情報

- **SFDX: Display Org Details for Default Org (SFDX: デフォルトの組織の詳細を表示)**
  - デフォルトの組織の説明を表示します。詳細には、アクセストークン、エイリアス(別名)、クライアント ID、接続状態などが含まれます。
  - 実行される CLI コマンドは `force:org:display` です。
  - [「組織の認証情報」](https://developer.salesforce.com/docs/atlas.ja-jp.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_view_info.htm)を参照してください。
- **SFDX: Display Org Details... (SFDX: 組織の詳細を表示...)**
  - 指定された組織の説明を表示します。
  - 実行される CLI コマンドは `force:org:display --targetusername` です。
- **SFDX: List All Aliases (SFDX: すべてのエイリアスを一覧表示)**
  - 認証した組織および作成したアクティブなスクラッチ組織について、エイリアス(別名)と対応するユーザ名を表示します。組織に接続する際に、設定したユーザ名またはエイリアスを使用することができます。
  - 実行される CLI コマンドは `force:alias:list` です。
  - [「Salesforce DX のユーザ名と組織」](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_cli_usernames_orgs.htm)を参照してください。
- **SFDX: List All Config Variables (SFDX: すべての設定変数を一覧表示)**
  - 設定した設定変数を一覧表示します。現在のプロジェクトのローカル値とすべてのグローバル値が含まれます。
  - 実行される CLI コマンドは `force:config:list` です。

### Apex

- **SFDX: Create Apex Class (SFDX: Apex クラスを作成)**
  - Apex クラスと関連するメタデータファイルをデフォルトのディレクトリ `force-app/main/default/classes` に作成します。
  - 実行される CLI コマンドは `force:apex:class:create` です。
  - [「Apex クラスの作成」](https://developer.salesforce.com/docs/atlas.ja-jp.sfdx_dev.meta/sfdx_dev/sfdx_dev_develop_create_apex.htm)を参照してください。
- **SFDX: Execute Anonymous Apex with Currently Selected Text (SFDX: 現在選択されているテキストで匿名 Apex コードを実行)**
  - 現在選択されている Apex コードの匿名ブロックを実行します。
  - 実行される CLI コマンドは `force:apex:execute` です。
  - [「匿名ブロック」](https://developer.salesforce.com/docs/atlas.ja-jp.apexcode.meta/apexcode/apex_anonymous_block.htm)を参照してください。
- **SFDX: Execute Anonymous Apex with Editor Contents (SFDX: エディタの内容で匿名 Apex コードを実行)**
  - VS Code エディタで開かれている Apex コードを実行します。
  - 実行される CLI コマンドは `force:apex:execute --apexcodefile` です。
- **SFDX: Get Apex Debug Logs... (SFDX: Apex デバッグログを取得...)**
  - デフォルトの組織から直近のデバッグログを取得します。
  - 実行される CLI コマンドは `force:apex:log:get` です。
  - [「Apex デバッグログの表示」](https://developer.salesforce.com/docs/atlas.ja-jp.sfdx_dev.meta/sfdx_dev/sfdx_dev_develop_view_apex_debug_logs.htm)を参照してください。
- **SFDX: Invoke Apex Tests... (SFDX: Apex テストを呼び出す...)**
  - ソースコードの変更をテストするために Apex テストを実行し、結果を可読形式で表示します。
  - 実行される CLI コマンドは `force:apex:test:run --resultformat human` です。
  - [「テスト」](https://developer.salesforce.com/docs/atlas.ja-jp.sfdx_dev.meta/sfdx_dev/sfdx_dev_testing.htm)を参照してください。
- **SFDX: Create Apex Trigger (SFDX: Apex トリガを作成)**
  - Apex トリガと関連するメタデータファイルをデフォルトのディレクトリ `force-app/main/default/triggers` に作成します。
  - 実行される CLI コマンドは `force:apex:trigger:create` です。
  - [「Apex トリガの作成」](https://developer.salesforce.com/docs/atlas.ja-jp.sfdx_dev.meta/sfdx_dev/sfdx_dev_develop_create_trigger.htm)を参照してください。
- **SFDX: Turn On Apex Debug Log for Replay Debugger (SFDX: Replay Debugger 用の Apex デバッグログを有効化)**
  - デフォルトの組織から取得したデバッグログをリプレイできるようにロギングを有効にします。
  - 実行される CLI コマンドは `force:data:record:create --sobjecttype --values --usetoolingapi` です。
- **SFDX: Turn Off Apex Debug Log for Replay Debugger (SFDX: Replay Debugger 用の Apex デバッグログを無効化)**
  - デバッガセッションを無効化します。
  - 実行される CLI コマンドは `force:data:record:delete --sobjecttype --sobjectid --usetoolingapi` です。
- **SFDX: Execute SOQL Query with Currently Selected Text**
  - デフォルトの組織のデータに対して選択されたクエリを実行します。
  - 実行される CLI コマンドは `force:data:soql:query` です。
- **SFDX: Execute SOQL Query... (SFDX: SOQL クエリを実行...)**
  - デフォルトの組織のデータに対してクエリを実行します。
  - 実行される CLI コマンドは `force:data:soql:query` です。
- **SFDX: Create and Set Up Project for ISV Debugging**
  - デバッグしたい Sandbox 環境のプロジェクト設定を VS Code で作成します。
  - 実行されるコマンドは、`force:config:set --isvDebuggerSid --isvDebuggerUrl --instanceUrl`、 `force:mdapi:retrieve --retrievetargetdir --unpacked --targetusername`、`force:mdapi:convert --rootdir --outputdir force-app` および `force:package:installed:list --targetusername` です。

### Lightning コンポーネント

- **SFDX: Create Lightning App (SFDX: Lightning Aura アプリケーションを作成)**
  - Lightning Aura アプリケーションバンドルを指定された名前でデフォルトのディレクトリ `force-app/main/default/aura` に作成します。
  - 実行される CLI コマンドは `force:lightning:app:create` です。
  - [「アプリケーションの作成」](https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/apps_intro.htm#)を参照してください。
- **SFDX: Create Lightning Component (SFDX: Lightning Aura コンポーネントを作成)**
  - Aura コンポーネントを指定された名前でデフォルトのディレクトリ `force-app/main/default/aura` に作成します。
  - 実行される CLI コマンドは `force:lightning:component:create` です。
  - [『Lightning Aura コンポーネント開発者ガイド』](https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/intro_framework.htm) および [『Salesforce DX 開発者ガイド』](https://developer.salesforce.com/docs/atlas.ja-jp.224.0.sfdx_dev.meta/sfdx_dev/sfdx_dev_develop_create_lightning.htm)を参照してください。
- **SFDX: Create Lightning Web Component (SFDX: Lightning Web コンポーネントを作成)**
  - Lightning Web コンポーネントを指定された名前でデフォルトのディレクトリ `force-app/main/default/lwc` に作成します。
  - 実行される CLI コマンドは `force:lightning:component:create --type lwc` です。
  - [「Lightning Web Components Dev Guide」](https://developer.salesforce.com/docs/component-library/documentation/ja-jp/lwc/lwc.create_components_introduction) を参照してください。
- **SFDX: Create Lightning Event (SFDX: Lightning Aura イベントを作成)**
  - Lightning Aura イベントを指定された名前でデフォルトのディレクトリ `force-app/main/default/aura` に作成します。
  - 実行される CLI コマンドは `force:lightning:event:create` です。
- **SFDX: Create Lightning Interface (SFDX: Lightning Aura インタフェースを作成)**
  - Lightning Aura インタフェースを指定された名前でデフォルトのディレクトリ `force-app/main/default/aura` に作成します。
  - 実行される CLI コマンドは `force:lightning:interface:create` です。

### Visualforce

- **SFDX: Create Visualforce Page (SFDX: Visualforce ページを作成)**
  - Visualforce ページと関連するメタデータファイルをデフォルトのディレクトリ `force-app/main/default/pages` に作成します。
  - 実行される CLI コマンドは `force:visualforce:page:create` です。
- **SFDX: Create Visualforce Component (SFDX: Visualforce コンポーネントを作成)**
  - Visualforce コンポーネントと関連するメタデータファイルをデフォルトのディレクトリ `force-app/main/default/components` に作成します。
  - 実行される CLI コマンドは `force:visualforce:component:create` です。
