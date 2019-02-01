---
title: Apex Refactoring
---

## Refactor: Rename

You can rename any valid Apex symbol defined in your source: methods, locals, fields, properties, constructors, or types (classes, triggers, or enums). To perform a rename, right-click the symbol that you want to rename and select **Rename Symbol**.

![GIF showing the symbol renaming process](../../images/apex-rename-demo.gif)

Validation of the new symbol name is performed before applying the rename. If the validation fails, an error message explains the reason why the rename refactoring could not be applied. Validation fails if the new name is not a valid Apex identifier or, sometimes, if the new name conflicts with an existing identifier name. (If these situations were allowed, a compiler error or a runtime behavior change could result.)

![GIF showing a renaming error](../../images/apex-rename-error.gif)

If the new name conflicts with an existing identifier name, we try to fully qualify the references to the existing name in contexts where the conflicts exist.

![GIF showing a renaming conflict](../../images/apex-rename-conflict.gif)

## Bugs and Feedback

To report issues with this feature (or with anything else related to Salesforce Extensions for VS Code), open a [bug on GitHub](https://github.com/forcedotcom/salesforcedx-vscode/issues/new?template=Bug_report.md). If you would like to suggest a feature, create a [feature request on GitHub](https://github.com/forcedotcom/salesforcedx-vscode/issues/new?template=Feature_request.md).
