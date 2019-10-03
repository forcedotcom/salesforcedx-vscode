---
title: Install Salesforce Extensions for VS Code
lang: en
---

Before you get started, install the required software on your computer.

## Visual Studio Code

Install Visual Studio Code on any computer running macOS, Windows, or Linux. VS Code’s [system requirements](https://code.visualstudio.com/docs/supporting/requirements) are fairly small, so it should run well on most computers.

To install Visual Studio Code visit <https://code.visualstudio.com> and click the big green **Download** button. After the download finishes, open the installer and follow the steps to complete the installation.

## Java Platform, Standard Edition Development Kit

Some features in Salesforce Extensions for VS Code depend upon the Java Platform, Standard Edition Development Kit (JDK). You need to have either version 8 or version 11 of the JDK installed.

If you don’t already have version 11 or 8 of the JDK installed, see the [instructions on how to install and configure Java](./en/getting-started/java-setup).

## Salesforce CLI

Salesforce CLI is used to execute commands against Salesforce orgs and work with source files on your local machine. Salesforce Extensions for VS Code uses Salesforce CLI behind the scenes, so even if you don’t want to use the CLI directly you need to install it on your machine.

For information about installing Salesforce CLI, see the _[Salesforce DX Setup Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_install_cli.htm)_.

## Salesforce Extensions for Visual Studio Code

After you’ve installed Salesforce Extensions for VS Code’s dependencies, install the Salesforce Extension Pack extension from the Visual Studio Marketplace. The extension pack contains everything you need to develop Salesforce apps using Visual Studio Code.

To install the extensions, visit <https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode> and click the green **Install** button. The installation process prompts you to open Visual Studio Code. After Visual Studio Code opens, a dialog box opens in the lower right corner, asking you to install the extension. Click **Install** to proceed.

![Install Extension](./images/install-salesforce-extensions-dialog.png)

After the extensions are installed, you see a blue **Reload** button. To reload Visual Studio Code and finish the installation, click the button (or close and reopen Visual Studio Code).
