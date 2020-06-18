---
title: パフォーマンスの改善
lang: ja
---

パフォーマンスを改善させるために行った変更により、単一ファイルのメタデータのデプロイがより効率的なコードパスを介して実行されるようになりました。現在のところ、これらの変更は Apex と Visualforce のメタデータ型のみをサポートしています。将来のリリースで、より多くのメタデータタイプのサポートを追加される予定です。

> 注意: コードパフォーマンスを改善させる変更は現在ベータ版です。バグを発見したかフィードバックがある場合は、[GitHub に issue をオープン](./ja/bugs-and-feedback)してください。

## 設定

このベータ機能を有効化するには、以下の手順に従います。

1. **[File \(ファイル\)]** > **[Preferences \(基本設定\)]** > **[Settings \(設定\)]** (Windows or Linux) または **[Code \(コード\)]** > **[Preferences \(基本設定\)]** > **[Settings \(設定\)]** を選択します。
2. Salesforce Feature Previews にある、Experimental: Deploy Retrieve を選択します。

このベータ版リリースでは、以下のメタデータ型に対して **SFDX: Deploy This Source to Org (SFDX: このソースを組織にデプロイ)** または **SFDX: Retrieve This Source From Org (SFDX: このソースを組織から取得)** を実行した際に、パフォーマンス改善が有効になります。

- Apex クラス
- Apex トリガ
- Visualforce コンポーネント
- Visualforce ページ
- Lightning コンポーネント
- Aura Components
