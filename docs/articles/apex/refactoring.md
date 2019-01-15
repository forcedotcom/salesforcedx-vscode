---
title: Apex Refactoring (Beta)
---

Salesforce Extensions for VS Code v44.7.0 and later includes a beta version of rename functionality for some Apex symbols. This beta release is limited in functionality and we suggest that you only use it to evaluate features and to provide us with [feedback](#bugs-and-feedback).

> NOTICE: This feature is in beta and there could be bugs. If you are not using source control or are not comfortable reverting changes made by this features, we recommend you do not use this on production code. Also, take care to verify that the changes are correct before publishing/committing code. Please report any [issues on GitHub](https://github.com/forcedotcom/salesforcedx-vscode/issues/new?template=Bug_report.md).

![Demo](/images/apex-rename-demo.gif)

## Preview Setup

Before you can use the feature discussed in this article you’ll need to install version v44.7.0 or later of Salesforce Extensions for VS Code.

Next, you need to enable the feature in VS Code. Open your user and workspace settings, then use the following VS Code menu command:

On Windows or Linux: **File** > **Preferences** > **Settings**

On macOS: **Code** > **Preferences** > **Settings**

Set the following value in your user or workspace settings:

```
"salesforcedx-vscode-apex.enable-rename": true
```

## Getting Started

Apex Refactor: Rename is limited to renaming Apex fields, properties, local variables, and methods. Open any Apex class or trigger, select the code you want to rename, and right-click to open the options menu. You should now see the `Rename Symbol` option.

## Bugs and Feedback

To report issues with this feature (or with anything else related to Salesforce Extensions for VS Code), open a [bug on GitHub](https://github.com/forcedotcom/salesforcedx-vscode/issues/new?template=Bug_report.md). If you would like to suggest a feature, create a [feature request on GitHub](https://github.com/forcedotcom/salesforcedx-vscode/issues/new?template=Feature_request.md).
