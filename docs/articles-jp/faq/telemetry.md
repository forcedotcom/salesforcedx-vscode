---
title: 'FAQ: テレメトリ'
---

## Salesforce がデータを集めるのはなぜですか?

Salesforce では、VS Code 向け Salesforce 拡張機能を向上させるために、利用状況データと総計値を収集しています。

## どのようなデータが収集されるのですか?

Salesforce では、拡張機能の利用状況に関連する匿名情報 \(どのコマンドが実行されたかなど\) のほか、パフォーマンスやエラーのデータを収集しています。

## テレメトリレポートを無効にするにはどうすればよいですか?

利用状況データを Salesforce に送信したくない場合は、`salesforcedx-vscode-core.telemetry.enabled` 設定を `false` にしてください。

Windows または Linux では、**[File \(ファイル\)]** > **[Preferences \(基本設定\)]** > **[Settings \(設定\)]** を選択します。macOS では、**[Code \(コード\)]** > **[Preferences \(基本設定\)]** > **[Settings \(設定\)]** を選択します。次に、VS Code シェルからのテレメトリイベントをすべてオフにして、テレメトリレポートを無効にするには、次のオプションを追加します。

```json
"salesforcedx-vscode-core.telemetry.enabled": false
```

> 重要: このオプションを有効にするためには、VS Code を再起動する必要があります。

> 注意: また、グローバルテレメトリ設定 `telemetry.enableTelemetry` も用意しています。`false` に設定すると、Salesforce テレメトリが無効になります。詳細は、[Microsoft のドキュメント](https://code.visualstudio.com/docs/supporting/faq#_how-to-disable-telemetry-reporting)を参照してください。
