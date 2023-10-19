---
title: Detect Conflicts on Deploy
lang: en
---

## Overview

When you deploy source to your default org, the operation could detect conflicts on deploy to help you avoid accidentally overwriting others’ changes in the org. The conflict detection feature can be turned on for any org that is not using source tracking, which is most non-scratch orgs such as sandboxes or dev orgs. Note that this feature is always on for scratch orgs and source-tracked sandboxes.

A conflict occurs when the metadata file in the org was last modified more recently than the last successful deployment or retrieval of this file to your local project.
If conflicts are detected in your project manifest or files, you can cancel the deploy operation and view the differences between your local files and default org.

To view the files that caused conflicts, click the Org Differences icon ({% octicon issue-opened %}) in the Activity Bar or the **Show Conflicts** prompt from the dialog. The **Org Differences: Conflicts** view opens in the side bar and displays the list of files with conflicts. To inspect conflicts, click a file to open the diff editor and compare the remote file (to the left) with the local file (on the right). To edit a file, hover over the file name and click the open file icon.

You can also view the resource files with conflicts and the CLI command to overwrite the conflicts in the Output panel.

If conflicts aren’t detected, the deploy operation is completed.

## How it Works

You must enable the conflict detection feature to use it:

1. Select **File** > **Preferences** > **Settings** (Windows or Linux) or **Code** > **Preferences** > **Settings** (macOS).
2. Under Salesforce Core Configuration, select **Detect Conflicts At Sync**.

You can also enter conflict detection in the search box to find the feature and then enable it.

When enabled, conflict detection will check for potential conflicts for all Deploy commands executed from VS Code. Changes based on last sync date are compared for all files that exist both in the org and in the local project; files that don’t exist in both are not considered in conflict. If conflicts are detected on deploy, you can choose to view them or override them to continue the deploy operation:

![Prompt for conflict detection](./images/DetectConflict_prompt.png)

You can either select to override conflicts or cancel the operation and view the conflicts in the Org Differences view.

You can use [Source Diff](./en/user-guide/source-diff) if you are interested in detecting conflicts in advance of any retrieve operation.

![Retrieve metadata flow](./images/RetrieveMetadataFlow.gif)
