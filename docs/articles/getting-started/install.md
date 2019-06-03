---
title: Install Salesforce Extensions for VS Code
---

Before you get started, install the required software on your computer.

## Visual Studio Code

Install Visual Studio Code on any computer running macOS, Windows, or Linux. VS Code’s [system requirements](https://code.visualstudio.com/docs/supporting/requirements) are fairly small, so it should run well on most computers.

To install Visual Studio Code visit <https://code.visualstudio.com> and click the big green **Download** button. After the download finishes, open the installer and follow the steps to complete the installation.

## Java Platform, Standard Edition Development Kit

Some features in Salesforce Extensions for VS Code depend upon the Java Platform, Standard Edition Development Kit (JDK). You need to have either version 8 or version 11 of the JDK installed.

If you don’t already have version 8 or 11 of the JDK installed, you can install the latest version of the Java 8 JDK from [Java SE Development Kit 8 Downloads](http://www.oracle.com/technetwork/java/javase/downloads/jdk8-downloads-2133151.html) or the latest version of the Java 11 JDK from [Java SE Development Kit 11 Downloads](https://www.oracle.com/technetwork/java/javase/downloads/jdk11-downloads-5066655.html).

If you also use other versions of the JDK, set your VS Code user setting `salesforcedx-vscode-apex.java.home` to point to the location where you installed Java 8 or 11.

## Salesforce CLI

Salesforce CLI is used to execute commands against Salesforce orgs and work with source files on your local machine. Salesforce Extensions for VS Code uses Salesforce CLI behind the scenes, so even if you don’t want to use the CLI directly you need to install it on your machine.

For information about installing Salesforce CLI, see the _[Salesforce DX Setup Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_install_cli.htm)_.

## Salesforce Extensions for Visual Studio Code

After you’ve installed Salesforce Extensions for VS Code’s dependencies, install the Salesforce Extension Pack extension from the Visual Studio Marketplace. The extension pack contains everything you need to develop Salesforce apps using Visual Studio Code.

To install the extensions, visit <https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode> and click the green **Install** button. The installation process prompts you to open Visual Studio Code. After Visual Studio Code opens, a dialog box opens in the lower right corner, asking you to install the extension. Click **Install** to proceed.

![Install Extension](/salesforcedx-vscode/images/install-salesforce-extensions-dialog.png)

After the extensions are installed, you see a blue **Reload** button. To reload Visual Studio Code and finish the installation, click the button (or close and reopen Visual Studio Code).
