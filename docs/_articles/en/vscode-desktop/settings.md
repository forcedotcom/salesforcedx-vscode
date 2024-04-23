---
title: Settings
lang: en
---

## Workspace Settings
To edit your workspace settings, select **File** > **Preferences** > **Settings** (Windows or Linux) or **Code** > **Settings** > **Settings** (macOS). For information about configuring your settings, see [User and Workspace Settings](https://code.visualstudio.com/docs/getstarted/settings) in the Visual Studio Code docs.

## Extension Settings
We use extension settings to provide access to beta features and other customizations.

## Stop CLI Success Messages
To stop Salesforce CLI success messages from showing as pop-up information messages, click **Show Only in Status Bar** in a success message. This button overrides the `salesforcedx-vscode-core.show-cli-success-msg` value in your default settings. It changes the Workspace Settings value to `false`. Setting this value to `false` makes the success messages appear in the status bar (in VS Code’s footer) instead of as information messages. If you decide that you liked the information messages after all, change the value back to `true`.

To see the other settings for this extension pack, search the settings for `salesforcedx-vscode`.
