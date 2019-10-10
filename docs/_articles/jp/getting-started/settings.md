---
title: ワークスペース設定の編集
lang: jp
---

ワークスペース設定を編集するには、**[File \(ファイル\)]** > **[Preferences \(基本設定\)]** > **[Settings \(設定\)]** \(Windows、Linux\) または **[Code \(コード\)]** > **[Preferences \(基本設定\)]** > **[Settings \(設定\)]** \(macOS\) を選択します。各自の設定についての詳細は、『Visual Studio Code Docs』の[「User and Workspace Settings \(ユーザとワークスペースの設定\)」](https://code.visualstudio.com/docs/getstarted/settings)を参照してください。

Salesforce CLI の成功メッセージがポップアップ情報メッセージとして表示されないようにするには、成功メッセージの **[Show Only in Status Bar \(ステータスバーのみに表示\)]** をクリックします。このボタンはデフォルト設定の `salesforcedx-vscode-core.show-cli-success-msg` の値を上書きします。また、ワークスペース設定の値を `false` に変更します。この値を `false` に設定すると、成功メッセージが、情報メッセージとしてではなく、\(VS Code のフッターの\) ステータスバーに表示されます。情報メッセージに戻したいと思ったときは、値を `true` に変更し直します。

この機能パックの他の設定を確認するには、`salesforcedx-vscode` の設定を検索します。
