---
title: Detect Conflicts
lang: en
---

Whenever you retrieve or deploy source to keep the local project and your default org in sync, the operation could detect conflicts. If conflicts are not detected, the retrieve or deploy operation is completed. If conflicts are detected, the retrieve or deploy operation can be cancelled. The resource files that caused the conflict and the CLI command to overwrite the conflict is displayed in the Output panel. You can enable the conflict detection feature only in non-scratch orgs.

All manifest files that exists both in the org and in the local environment are checked for conflicts; files that don’t exist in both are not checked.

![Prompt for conflict detection](./images/DetectConflict_prompt.png)

You can either select to overwrite conflicts or cancel the operation and view the conflicts in the Output panel.

![Output panel showing conflicts and CLI command](./images/DetectConflict_outputpane.png)
