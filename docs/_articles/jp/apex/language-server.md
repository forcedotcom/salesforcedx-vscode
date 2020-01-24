---
title: Apex 言語サーバ
lang: jp
---

Apex 言語サーバは、ツールがコード編集機能 \(コード補完など\) へのアクセス、定義への移動、すべての使用法の確認、リファクタリングなどを行う手段で、IDE に関係なく使用できます。VS Code 向け Salesforce 拡張機能が、他の IDE にもアクセスできる Apex アナライザを実装する強力な方法です。

Apex 言語サーバは、言語サーバプロトコル 3.0 [仕様](https://github.com/Microsoft/language-server-protocol/blob/master/protocol.md)の実装です。この言語サーバプロトコルにより、ツール \(この場合は VS Code\) が言語スマートネスプロバイダ \(サーバ\) と通信できるようになります。Salesforce ではこの共通仕様を使用して Apex 言語サーバを構築し、ツーリングパートナーが各自のツールのスマートネスを向上できるようにしています。

詳細は、Dreamforce '17 プレゼンテーションの[「Building Powerful Tooling For All IDEs Through Language Servers \(言語サーバを使用した全 IDE 向けの強力なツールの構築\)」](https://www.salesforce.com/video/1765282/)という動画をご覧ください。

[![Dreamforce '17 プレゼンテーション](./images/apex-language-server-presentation-dreamforce-17.png)](https://www.salesforce.com/video/1765282/)

## インストール

VS Code Marketplace から [Salesforce Extension Pack](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode) をインストールすることをお勧めします。この拡張機能パックには、Apex 言語サーバと、VS Code とのインテグレーションが含まれます。

## 使用法

[「Apex」](./jp/apex/writing)を参照してください。

## キャッシュのクリア

Apex 言語サーバのキャッシュをクリアするには、`PROJECT_DIR/.sfdx/tools/apex.db` ファイルを削除して、VS Code を再起動します。

## Apex 言語サーバとの統合

Apex 言語サーバとの統合を考えている開発者は、[apex-jorje-lsp.jar](https://github.com/forcedotcom/salesforcedx-vscode/blob/develop/packages/salesforcedx-vscode-apex/out/apex-jorje-lsp.jar) ファイルを使用します。

Apex 言語サーバの初期化と通信の例については、[languageServer.ts](https://github.com/forcedotcom/salesforcedx-vscode/blob/develop/packages/salesforcedx-vscode-apex/src/languageServer.ts) ファイルを参照してください。

詳細は、以下のリソースをご覧ください。

- [Language Server Protocol Specification \(言語サーバプロトコル仕様\)](https://github.com/Microsoft/language-server-protocol)
- [Language Server Protocol \(言語サーバプロトコル\) - Eclipse ニュースレター 2017 年 5 月](http://www.eclipse.org/community/eclipse_newsletter/2017/may/article1.php)
- [VS Code's Implementation of the Language Server Protocol \(VS Code の言語サーバプロトコルの実装\)](https://github.com/Microsoft/vscode-languageserver-node)
- [Langserver.org - Information about other language servers and clients, e.g., Atom, Sublime, Vim, etc \(他の言語サーバおよびクライアント \(Atom、Sublime、Vim など\) に関する情報\)](http://langserver.org/)
