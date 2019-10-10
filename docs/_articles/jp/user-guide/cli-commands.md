---
title: Salesforce CLI コマンドの実行
lang: jp
---

VS Code 向け Salesforce 拡張機能からコマンドを実行するには、Ctrl+Shift+P キー \(Windows、Linux\) または Cmd+Shift+P キー \(macOS\) を押し、コマンドパレットに**「SFDX」**と入力します。  
![コマンドパレット。SFDX コマンドを表示するように絞り込まれています。](./images/sfdx_commands.png)

コマンドの実行が \(成功、失敗、キャンセルにより\) 終了すると、ウィンドウの上部に通知が表示されます。  
![ソースがスクラッチ組織に正常にプッシュされたことを伝える通知](./images/command_success_notification.png)

実行したコマンドの出力を確認するには、**[View \(表示\)]** > **[Output \(出力\)]** を選択して、ドロップダウンメニューから **[Salesforce CLI]** を選択します。または、完了通知の **[Show \(表示\)]** をクリックします。  
![[Output (出力)] ビュー。Apex テスト実行の結果が表示されています。](./images/output_view.png)

## 使用可能なコマンド

VS Code 向け Salesforce 拡張機能では、以下の Salesforce CLI コマンドを使用できます。

- `force:alias:list`: **SFDX: List All Aliases \(SFDX: すべてのエイリアスをリスト\)**
- `force:apex:class:create ...`: **SFDX: Create Apex Class \(SFDX: Apex クラスを作成\)**
- `force:apex:execute`: **SFDX: Execute Anonymous Apex with Currently Selected Text \(SFDX: 現在選択されているテキストを使用して匿名 Apex を実行\)**
- `force:apex:execute --apexcodefile`: **SFDX: Execute Anonymous Apex with Editor Contents \(SFDX: エディタのコンテンツを使用して匿名 Apex を実行\)**
- `force:apex:log:get ...`: **SFDX: Get Apex Debug Logs... \(SFDX: Apex デバッグログを取得...\)**
- `force:apex:test:run --resultformat human ...`: **SFDX: Invoke Apex Tests... \(SFDX: Apex テストを呼び出し...\)**
- `force:apex:trigger:create ...`: **SFDX: Create Apex Trigger \(SFDX: Apex トリガを作成\)**
- `force:auth:logout --all --noprompt`: **SFDX: Log Out from All Authorized Orgs \(SFDX: 承認済みのすべての組織からログアウト\)**
- `force:auth:web:login --setdefaultdevhubusername`: **SFDX: Authorize a Dev Hub \(SFDX: Dev Hub を承認\)**
- `force:config:list`: **SFDX: List All Config Variables \(SFDX: すべての設定変数をリスト\)**
- `force:data:soql:query`: **SFDX: Execute SOQL Query with Currently Selected Text \(SFDX: 現在選択されているテキストを使用して SOQL クエリを実行\)**
- `force:data:soql:query ...`: **SFDX: Execute SOQL Query... \(SFDX: SOQL クエリを実行...\)**
- `force:lightning:app:create ...`: **SFDX: Create Lightning App \(SFDX: Lightning アプリケーションを作成\)**
- `force:lightning:component:create ...`: **SFDX: Create Lightning Component \(SFDX: Lightning コンポーネントを作成\)**
- `force:lightning:event:create ...`: **SFDX: Create Lightning Event \(SFDX: Lightning イベントを作成\)**
- `force:lightning:interface:create ...`: **SFDX: Create Lightning Interface \(SFDX: Lightning インターフェースを作成\)**
- `force:org:create --setdefaultusername ...`: **SFDX: Create a Default Scratch Org \(SFDX: デフォルトのスクラッチ組織を作成\)**
- `force:org:display`: **SFDX: Display Org Details for Default Scratch Org \(SFDX: デフォルトのスクラッチ組織の詳細を表示\)**
- `force:org:display --targetusername ...`: **SFDX: Display Org Details... \(SFDX: 組織の詳細を表示...\)**
- `force:org:open`: **SFDX: Open Default Org \(SFDX: デフォルト組織を開く\)**
- `force:project:create --template standard ...`: **SFDX: Create Project \(SFDX: プロジェクトを作成\)**
- `force:project:create --template standard --manifest ...`: **SFDX: Create Project with Manifest \(SFDX: マニフェストを使用してプロジェクトを作成\)**
- `force:source:delete`: **SFDX: Delete from Project and Org \(SFDX: プロジェクトおよび組織から削除\)** \(ベータ\)
- `force:source:deploy`: **SFDX: Deploy Source to Org \(SFDX: 組織にソースをリリース\)** \(ベータ\)
- `force:source:deploy --manifest ...`: **SFDX: Deploy Source in Manifest to Org \(SFDX: 組織にマニフェストのソースをリリース\)** \(ベータ\)
- `force:source:pull`: **SFDX: Pull Source from Default Scratch Org \(SFDX: デフォルトのスクラッチ組織からソースをプル\)**
- `force:source:pull --forceoverwrite`: **SFDX: Pull Source from Default Scratch Org and Override Conflicts \(SFDX: ソースをデフォルトのスクラッチ組織からプルして競合を上書き\)**
- `force:source:push`: **SFDX: Push Source to Default Scratch Org \(SFDX: ソースをデフォルトのスクラッチ組織にプッシュ\)**
- `force:source:push --forceoverwrite`: **SFDX: Push Source to Default Scratch Org and Override Conflicts \(SFDX: ソースをデフォルトのスクラッチ組織にプッシュして競合を上書き\)**
- `force:source:retrieve`: **SFDX: Retrieve Source from Org \(SFDX: 組織からソースを取得\)** \(ベータ\)
- `force:source:retrieve --manifest ...`: **SFDX: Retrieve Source in Manifest from Org \(SFDX: 組織からマニフェストのソースを取得\)** \(ベータ\)
- `force:source:status`: **SFDX: View All Changes \(Local and in Default Scratch Org\) \(SFDX: すべての変更を表示 \(ローカルとデフォルトのスクラッチ組織内\)\)**
- `force:source:status --local`: **SFDX: View Local Changes \(SFDX: ローカルの変更を表示\)**
- `force:source:status --remote`: **SFDX: View Changes in Default Scratch Org \(SFDX: デフォルトのスクラッチ組織の変更を表示\)**
- `force:visualforce:component:create ...`: **SFDX: Create Visualforce Component \(SFDX: Visualforce コンポーネントを作成\)**
- `force:visualforce:page:create ...`: **SFDX: Create Visualforce Page \(SFDX: Visualforce ページを作成\)**
