---
title: Detect Conflicts
lang: en
---

Whenever you retrieve or deploy source to keep the local project and your default org in sync, the operation could detect conflicts. The conflict detection feature is available only in non-scratch orgs such as sandboxes or dev orgs.

If conflicts are detected, you can cancel the retrieve or deploy operation and view the differences between your local project and default org.

To view the files that caused conflicts, click the Org Differences icon ({% octicon issue-opened %}) in the Activity Bar. The Org Differences: Conflicts view opens in the Side Bar and displays the list of files with conflicts. To resolve conflicts, click a file to open the diff editor and compare the remote file (to the left) with the local file (on the right). To edit a file, hover over the file name and click the open file icon.

You can also view the resource files with conflicts and the CLI command to overwrite the conflicts in the Output panel.

If conflicts are not detected, the retrieve or deploy operation is completed.

> NOTICE: The conflict detection feature is currently in beta. If you have any issues or feedback, [open a GitHub issue](./en/bugs-and-feedback).

Because the conflict detection feature is in beta, you must enable the feature:

1. Select **File** > **Preferences** > **Settings** (Windows or Linux) or **Code** > **Preferences** > **Settings** (macOS).
1. Under Salesforce Feature Previews, select Detect Conflicts At Sync.

You can also enter conflict detection in the search box to find the feature and then enable it.

In this beta release, we have enabled conflict detection for the **SFDX: Retrieve Source in Manifest from Org** and **SFDX: Deploy Source in Manifest to Org** commands only. All manifest files that exists both in the org and in the local environment are checked for conflicts; files that don’t exist in both are not checked.

![Prompt for conflict detection](./images/DetectConflict_prompt.png)

You can either select to override conflicts or cancel the operation and view the conflicts in the Org Differences view.

> Note: If the Org Differences view is not populated with files having conflicts, make sure that the **Detect Conflicts At Sync** setting is enabled.

![Retrieve metadata flow](./images/RetrieveMetadataFlow.gif)
