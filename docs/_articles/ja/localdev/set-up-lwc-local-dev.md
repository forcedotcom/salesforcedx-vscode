---
title: LWC ローカル開発の設定
lang: ja
---

LWC の ローカル開発を設定するには、サーバをインストールし、Dev Hub 組織を有効化して認証し、スクラッチ組織を作成します。LWC のローカル開発を使用するには、Salesforce DX プロジェクト内で Lightning Web コンポーネントを開発する必要があります。

## LWC ローカル開発サーバのインストール

コマンドラインインターフェースから次のコマンドを実行します。

```
sf plugins install @salesforce/lwc-dev-server
```

> **トラブルシューティングのヒント:** 既知の問題のため、プラグインをインストールする際にエラーが表示される可能性があります。プラグインがインストールされているかどうかを確認するために、`sf plugins --core` を実行してください。インストールされていたら、ローカル開発サーバを起動してみてください。成功すれば、次に進むことができます。

**SFDX: Preview Component Locally \(SFDX: コンポーネントをローカルでプレビュー\)** を選択すると、コマンドパレットにプレビューオプションのリストが表示されます。コンポーネントのプレビューをデスクトップのブラウザで行うか、仮想モバイルデバイス (iOS または Android) で行うかを選択できます。モバイルでのプレビューには追加設定が必要です。詳細は、『Lightning Web コンポーネント開発者ガイド』 の[「モバイルでの Lightning Web コンポーネントのプレビュー (ベータ)」](https://developer.salesforce.com/docs/component-library/documentation/ja-jp/lwc/lwc.mobile_extensions)を参照してください。
