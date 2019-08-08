---
title: Apex Replay Debugger
---

## Apex Replay Debugger の設定

Apex Replay Debugger を初めて使用するときに、起動設定を作成します。それ以降は、問題をデバッグするたびに、Apex Replay Debugger セッションを設定します。

### 起動定義の作成

Apex Replay Debugger の起動設定を作成するには、プロジェクトの `.vscode/launch.json` ファイルを作成または更新します。

1. VS Code で Salesforce DX プロジェクトを開きます。
1. Salesforce DX プロジェクトにまだ `.vscode/launch.json` ファイルパスを設定した JSON ファイルがない場合は、そのファイル \(と必要に応じてフォルダ\) を作成します。
1. `.vscode/launch.json` ファイルを開きます。
1. `Launch Apex Replay Debugger` という設定を追加します。

```json
{
  // Use IntelliSense to learn about possible attributes.
  // Hover to view descriptions of existing attributes.
  // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Apex Replay Debugger",
      "type": "apex-replay",
      "request": "launch",
      "logFile": "${command:AskForLogFileName}",
      "stopOnEntry": true,
      "trace": true
    }
  ]
}
```

### ブレークポイントとチェックポイントの設定

再生デバッグ用のデバッグログを生成する前に、ブレークポイントとチェックポイントを設定します。

1.  行ブレークポイントを設定するには、`.cls` または `.trigger` ファイルを開き、行番号の左側にある列をクリックします。
1.  行ブレーキポイントが提供する量よりも情報が多い場合は、チェックポイントを追加します。コード行の実行時にヒープダンプを取得するチェックポイントを最大 5 つ設定できます。ローカル変数、静的変数、トリガコンテキスト変数はすべて、チェックポイントに役立つ情報があります。トリガコンテキスト変数はログに存在せず、チェックポイント場所でのみ使用できます。  
    Visual Studio Code で、チェックポイントはブレークポイントの一種です。ログからの再生デバッグ時に、チェックポイントはブレークポイントのように機能します。Apex Replay Debugger セッションを開始する前に、チェックポイントを設定してアップロードします。

    1.  Apex クラスまたはトリガの最大 5 つの行にチェックポイントを設定します。
    1.  チェックポイントを設定するコード行をクリックします。
    1.  コマンドパレットを開きます \(Windows、Linux は Ctrl+Shift+P キー、macOS は Cmd+Shift+P キーを押します\)。
    1.  **[SFDX: Toggle Checkpoint \(SFDX: チェックポイントを切り替え\)]** を実行します。
        -         -     1.  チェックポイントを組織にアップロードしてヒープダンプ情報を収集するには、コマンドパレットを開き、**[SFDX: Update Checkpoints in Org \(SFDX: 組織のチェックポイントを更新\)]** を実行します。

### スクラッチ組織またはデフォルトの開発組織の Apex Replay Debugger セッションの設定

スクラッチ組織、または Sandbox あるいは VS Code でデフォルト組織として設定した DE 組織で問題をデバッグする場合は、再生するデバッグログを生成するツールが用意されています。ログを有効にして問題を再現し、組織からデバッグログを取得したうえで、デバッグセッションを開始します。

1. ログを有効にするには、VS Code から、コマンドパレットを開き \(Windows、Linux は Ctrl+Shift+P キー、macOS は Cmd+Shift+P キー\)、**[SFDX: Turn On Apex Debug Log for Replay Debugger \(SFDX: Replay Debugger の Apex デバッグログをオン\)]** を実行します。
1. デバッグするシナリオを再現します。次の手順を実行します。
   - **[SFDX: Invoke Apex Tests \(SFDX: Apex テストを呼び出し\)]** を実行します。
   - **[SFDX: Execute Anonymous Apex with Currently Selected Text \(SFDX: 現在選択されているテキストを使用して匿名 Apex を実行\)]** を実行します。
   - **[SFDX: Execute Anonymous Apex with Editor Contents \(SFDX: エディタのコンテンツを使用して匿名 Apex を実行\)]** を実行します。
   - Web ブラウザの組織で手動の手順を実行します。
1. 組織のデバッグログのリストを取得するには、**[SFDX: Get Apex Debug Logs \(SFDX: Apex デバッグログを取得\)]** を実行します。
1. 再生するログをクリックします。VS Code にログがダウンロードされて開きます。
1. **[SFDX: Launch Apex Replay Debugger with Current File \(SFDX: 現在のファイルを使用して Apex Replay Debugger を起動\)]** を実行します。

### Sandbox または本番組織の Apex Replay Debugger セッションの設定

VS Code でスクラッチ組織または開発用のデフォルト組織として設定した組織を使用していない場合は、デバッグを開始する前に組織からデバッグログをダウンロードします。VS Code でログを開き、デバッグセッションを開始します。

1. VS Code で、分析するデバッグログを開きます。`VISUALFORCE` の場合はログレベルを `FINER` または `FINEST`、`APEX_CODE` の場合はログレベルを `FINEST` に設定したログを生成します。
1. **[SFDX: Launch Apex Replay Debugger with Current File \(SFDX: 現在のファイルを使用して Apex Replay Debugger を起動\)]** を実行します。

ヒント: ログファイルが Salesforce DX プロジェクトの一部である場合は、ログファイルを開いて、別のコマンドを実行する必要はありません。代わりに、[Explorer \(エクスプローラ\)] ビューでログファイルを見つけて右クリックし、**[Launch Apex Replay Debugger with Current File \(現在のファイルを使用して Apex Replay Debugger を起動\)]** を選択します。

## コードのデバッグ

デバッグログを再生して、変数の値を調べます。

1. VS Code の [Debug \(デバッグ\)] ビューに切り替えるには、ウィンドウの左端にあるバグアイコンをクリックします。
1. 1 つ目のブレークポイントに達するまで、デバッグログに記録されたコード実行を再生するには、エディタの上部にある [Debug \(デバッグ\)] アクションペインの緑色の再生アイコンをクリックします。
1. コードをステップ実行し、[Debug \(デバッグ\)] ビューの [VARIABLES \(変数\)] セクションで変数の状態を検証します。詳細は、『Visual Studio Code Docs』の[「Debugging \(デバッグ\)」](https://code.visualstudio.com/docs/editor/debugging)を参照してください。  
   デバッグセッション中にコードをステップ実行していくと、Apex Replay Debugger に、チェックポイントを設定した行のヒープダンプから変数に関する詳細が示されます。
1. ログに記録されたイベントをすべてステップ実行したら、デバッグセッションが終了します。もう一度ログの先頭から開始する場合は、**[SFDX: Launch Apex Replay Debugger with Last Log File \(SFDX: 最新のログファイルを使用して Apex Replay Debugger を起動\)]** を実行します。

## 考慮事項

Apex Replay Debugger を使用するときは、次の考慮事項と既知の問題に留意します。

- このデバッガは各自の組織でのみ使用できます。ISV カスタマーデバッグは Apex Replay Debugger で使用できません。顧客の組織をデバッグする場合は、[ISV カスタマーデバッガ](interactive-debugger#isv-customer-debugger)を使用します。
- デバッグログは一度に 1 つのみ再生できます。この制限により、複数のデバッグログを生成する非同期 Apex のデバッグが困難になることがあります。
- チェックポイントは 30 分で期限が切れるため、チェックポイントをアップロードしたらすぐセッションを開始してください。
- ヒープダンプは生成の約 1 日後に期限が切れるため、セッションを開始したらすぐコードをデバッグしてください。
- スケジュール済み Apex で生成されたデバッグログは再生できません。
- 文字列変数の長い値は、ブレークポイントで切り捨てられます。チェックポイントでは、heap-dump-augmented 変数に完全な文字列があります。
- ブレークポイントで標準オブジェクトまたはカスタムオブジェクトを表示した場合、そのオブジェクトの直下の子変数 \(1 つ下のレベル\) までドリルダウンできます。チェックポイントでは、heap-dump-augmented 変数が、直下の子だけでなく、子標準オブジェクト全体をドリルダウンできます。
- コレクション \(リスト、セット、対応付け\) はそのメンバーが文字列形式で表示されるため、展開できません。
- コレクションを変更しても、[Debug \(デバッグ\)] ビューの [VARIABLES \(変数\)] セクションのコレクション変数は更新されません。
- メソッドブレークポイントまたは条件付きブレークポイントを設定することはできません。
- [Debug \(デバッグ\)] ビューの [WATCH \(ウォッチ\)] セクションの変数や式を評価または監視することはできません。
- デバッグ中に、[Debug \(デバッグ\)] ビューの [VARIABLES \(変数\)] セクションの変数を右クリックし、**[Copy Value \(値のコピー\)]** を選択しても適切に機能します。ただし、**[Copy as Expression \(式としてコピー\)]** と **[Add to Watch \(ウォッチに追加\)]** は適切に機能しません。
  - **[Copy as Expression \(式としてコピー\)]** は [Copy Value \(値をコピー\)] のように機能します。つまり、完全な変数名をコピーするのではなく、変数の値をコピーします。
  - **[Add to Watch \(ウォッチに追加\)]** は変数の値を [WATCH \(ウォッチ\)] セクションにコピーしますが、このセクションの変数は評価されないため、`<VariableValue>:<VariableValue>` のみが表示されます。
