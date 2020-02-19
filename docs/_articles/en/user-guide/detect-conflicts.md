---
title: Detect Conflicts
lang: en
---

Whenever you deploy or retrieve source to keep the local project and your default org in sync, the operation could detect conflicts. If conflicts are not detected, the retrieve or deploy operation is completed. If conflicts are detected, the retrieve or deploy operation aborts. The resource files that caused the conflict, along with the CLI command to overwrite conflicts are displayed in the Output panel. You can enable the conflict detection feature only in non-scratch orgs.

> NOTICE: The conflict detection feature is currently in beta. If you have any issues or feedback, [open a GitHub issue](./en/bugs-and-feedback).

Because the conflict detection feature is in beta, you must enable the feature:

1. Select **File** > **Preferences** > **Settings** (Windows or Linux) or **Code** > **Preferences** > **Settings** (macOS).
1. Under Salesforce Feature Previews, select Detect Conflicts At Sync.

You can also enter conflict detection in the search box to find the feature and then enable it.

In this beta release, we have enabled conflict detection for the **SFDX: Retrieve Source in Manifest from Org** and **SFDX: Deploy Source in Manifest to Org** commands only. All manifest files that exists both in the org and in the local environment are checked for conflicts; files that don’t exist in both are not checked.

![Prompt for conflict detection](./images/DetectConflict_prompt.png)

You can either select to overwrite conflicts or cancel the operation and view the conflicts in the Output panel.

![Output panel showing conflicts and CLI command](./images/DetectConflict_outputpane.png)
