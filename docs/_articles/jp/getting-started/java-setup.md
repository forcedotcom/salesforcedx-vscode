---
title: Java 設定
lang: jp
---

VS Code 向け Salesforce Apex 拡張機能に付属する Apex 言語サーバは、Java Platform, Standard Edition Development Kit \(JDK\) に依存しています。そのため、JDK バージョン 11 \(推奨\) と JDK バージョン 8 のいずれかのインストールが必要です。この拡張機能はデフォルトで、コンピュータ上の `JAVA_HOME` または `JDK_HOME` 環境変数を探し、ローカルの Java インストールを見つけようとします。拡張機能が Java インストールを見つけられない場合や、あなたが別のインストールを使用したい場合は、`salesforcedx-vscode-apex.java.home` 設定を変更します。

1. **[File \(ファイル\)]** > **[Preferences \(基本設定\)]** > **[Settings \(設定\)]** \(Windows、Linux\) または **[Code \(コード\)]** > **[Preferences \(基本設定\)]** > **[Settings \(設定\)]** \(macOS\) を選択します。
1. `apex` を検索します。
1. `salesforcedx-vscode-apex.java.home` 設定を Java Runtime のフルパス名に変更します。Java 実行可能ファイル自体には**設定しない**でください。

![Apex の Java 設定](./images/apex-java-home-setting.png)

Java の各バージョンをダウンロードして設定する手順は、次のとおりです。

## AdoptOpenJDK

[AdoptOpenJDK](https://adoptopenjdk.net/) は、事前作成済みの OpenJDK バイナリを無料で提供するもので、承認などの複雑な設定が必要ありません。

1. [[AdoptOpenJDK]](https://adoptopenjdk.net/?variant=openjdk11&jvmVariant=hotspot) に移動します。
1. **[OpenJDK 11 \(LTS\)]** を選択します。
1. **[HotSpot \(ホットスポット\)]** を選択します。
1. **[Latest Release \(最新リリース\)]** ボタンをクリックしてダウンロードします。
1. ダウンロードしたファイルを開き、インストール手順を実行します。

Visual Studio Code 内で、`salesforcedx-vscode-apex.java.home` を次のいずれかの値に設定する必要があります。

MacOS:

```json
{
  "salesforcedx-vscode-apex.java.home": "/Library/Java/JavaVirtualMachines/adoptopenjdk-11.jdk/Contents/Home"
}
```

Windows:

```json
{
  "salesforcedx-vscode-apex.java.home": "C:\\Program Files\\AdoptOpenJDK\\jdk-11.0.3.7-hotspot"
}
```

## Zulu

TCK テスト済みの無料の Zulu Java ビルドは、無制限にダウンロードして使用できます。

1. [Zulu のダウンロードページ](https://www.azul.com/downloads/zulu/)に移動します。
1. バージョン **[11]** を選択します。
1. 各自の OS を選択します。
1. インストーラをダウンロードします。
1. macOS の場合は、zip または dmg バージョンをダウンロードします。
1. Windows の場合は、「11」「JDK」「クライアント」バージョンをダウンロードします。
1. ダウンロードしたファイルを開き、インストール手順を実行します。

Visual Studio Code 内で、`salesforcedx-vscode-apex.java.home` を次のいずれかの値に設定する必要があります。

MacOS:

```json
{
  "salesforcedx-vscode-apex.java.home": "/Library/Java/JavaVirtualMachines/zulu-11.jdk/Contents/Home"
}
```

Windows:

```json
{
  "salesforcedx-vscode-apex.java.home": "C:\\Program Files\\Zulu\\zulu-11"
}
```

## Oracle Java 11 \(正式テスト\)

1. [ダウンロードページ](https://www.oracle.com/technetwork/java/javase/downloads/index.html)に移動します。
1. **[Java SE 11.x.y \(LTS\)]** の **[Download \(ダウンロード\)]** ボタンをクリックします。
1. 使用許諾契約に同意します。
1. 各自の OS に対応するダウンロードリンクをクリックします。
1. macOS の場合は、dmg バージョンをダウンロードします。
1. Windows の場合は、exe バージョンをダウンロードします。
1. ログインを求められた場合は、Oracle アカウントを使用してログインする必要があります。
1. ダウンロードしたファイルを開き、インストール手順を実行します。

Visual Studio Code 内で、`salesforcedx-vscode-apex.java.home` を次のいずれかの値に設定する必要があります。

MacOS:

```json
{
  "salesforcedx-vscode-apex.java.home": "/Library/Java/JavaVirtualMachines/jdk-11.0.3.jdk/Contents/Home"
}
```

Windows:

```json
{
  "salesforcedx-vscode-apex.java.home": "C:\\Program Files\\Java\\jdk11.0.3"
}
```

## Oracle Java 8 \(レガシー\)

現在も Java 8 を実行している場合は、`salesforcedx-vscode-apex.java.home` の値が次のようになります。

MacOS:

```json
{
  "salesforcedx-vscode-apex.java.home": "/Library/Java/JavaVirtualMachines/jdk1.8.0_131.jdk/Contents/Home"
}
```

Windows:

```json
{
  "salesforcedx-vscode-apex.java.home": "C:\\Program Files\\Java\\jdk1.8.0_131"
}
```
