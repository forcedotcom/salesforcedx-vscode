---
title: Installation and Java Setup
lang: en
---

Before you get started, install the required software on your computer.

## Visual Studio Code

Install Visual Studio Code on any computer running macOS, Windows, or Linux. VS Code’s [system requirements](https://code.visualstudio.com/docs/supporting/requirements) are fairly small, so it should run well on most computers.

To install Visual Studio Code visit <https://code.visualstudio.com> and click the big green **Download** button. After the download finishes, open the installer and follow the steps to complete the installation.

## Java Platform, Standard Edition Development Kit

Some features in Salesforce Extensions for VS Code depend upon the Java Platform, Standard Edition Development Kit (JDK). You need to have either version 8 or version 11 of the JDK installed.

The Apex Language Server, shipped as part of the Salesforce Apex Extension for VS Code depends upon the Java Platform, Standard Edition Development Kit (JDK). It requires an installation of either JDK version 11 (Recommended) or JDK version 8. By default, the extension attempts to locate your local Java installation by looking for a `JAVA_HOME` or `JDK_HOME` environment variable on your computer. If the extension cannot find your Java installation, or if you want it to use a different installation, change the `salesforcedx-vscode-apex.java.home` setting.

1. Select **File** > **Preferences** > **Settings** (Windows or Linux) or **Code** > **Preferences** > **Settings** (macOS).
1. Search for `apex`.
1. Change the `salesforcedx-vscode-apex.java.home` setting to the full pathname of your Java Runtime. Do **not** set it to the Java executable itself.

![Apex Java Setting](./images/apex-java-home-setting.png)

Below you will find instructions on how to download and configure different versions of Java.

### AdoptOpenJDK

[AdoptOpenJDK](https://adoptopenjdk.net/) provides prebuilt OpenJDK binaries for free without authentication or complications.

1. Navigate to [AdoptOpenJDK](https://adoptopenjdk.net/?variant=openjdk11&jvmVariant=hotspot)
1. Select **OpenJDK 11 (LTS)**
1. Select **HotSpot**
1. Click the **Latest Release** button to download.
1. Once the file is downloaded open it and complete the installation steps.

Inside Visual Studio Code, you will need to set the `salesforcedx-vscode-apex.java.home` to one of the following values.

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

### Zulu

Zulu Java builds are TCK-tested and free to download and use without restrictions.

1. Navigate to the [Zulu download page](https://www.azul.com/downloads/zulu/)
1. Select version **11**
1. Select your OS
1. Download the installer
1. For macOS download the zip or dmg version.
1. For Windows Download the "11", "JDK", "Client" version.
1. Once the file is downloaded open it and complete the installation steps.

Inside Visual Studio Code, you will need to set the `salesforcedx-vscode-apex.java.home` to one of the following values.

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

### Oracle Java 11 (Officially Test)

1. Navigate to the [download page](https://www.oracle.com/technetwork/java/javase/downloads/jdk11-downloads-5066655.html)
1. Click the **Download** button for **Java SE 11.x.y (LTS)**
1. Accept the license agreement
1. Click the download link that applies to your OS
1. For macOS download the dmg version.
1. For Windows Download exe version.
1. If prompted to login, you will need to login with your Oracle account.
1. Once the file is downloaded open it and complete the installation steps.

Inside Visual Studio Code, you will need to set the `salesforcedx-vscode-apex.java.home` to one of the following values.

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

### Oracle Java 8 (Legacy)

If you are still running Java 8 the values for `salesforcedx-vscode-apex.java.home` are as follows.

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

### Advanced Setup

By default, a JVM allocates up to one fourth of the system's physical memory to the Apex Language Server process. If you are working on projects with more memory requirements, use the `salesforcedx-vscode-apex.java.memory` setting to override the defaults. Use this setting to specify the maximum size of memory allocation in megabytes and in multiples of 1024.

```json
{
  "salesforcedx-vscode-apex.java.memory": 4096
}
```

## Salesforce CLI

Salesforce CLI is used to execute commands against Salesforce orgs and work with source files on your local machine. Salesforce Extensions for VS Code uses Salesforce CLI behind the scenes, so even if you don’t want to use the CLI directly you need to install it on your machine.

For information about installing Salesforce CLI, see the _[Salesforce DX Setup Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_install_cli.htm)_.

## Salesforce Extensions for Visual Studio Code

After you’ve installed Salesforce Extensions for VS Code’s dependencies, install the Salesforce Extension Pack extension from the Visual Studio Marketplace. The extension pack contains everything you need to develop Salesforce apps using Visual Studio Code.

To install the extensions, visit <https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode> and click the green **Install** button. The installation process prompts you to open Visual Studio Code. After Visual Studio Code opens, a dialog box opens in the lower right corner, asking you to install the extension. Click **Install** to proceed.

![Install Extension](./images/install-salesforce-extensions-dialog.png)

After the extensions are installed, you see a blue **Reload** button. To reload Visual Studio Code and finish the installation, click the button (or close and reopen Visual Studio Code).
