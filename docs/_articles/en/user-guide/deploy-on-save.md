---
title: Deploy On Save
lang: en
---

## Overview

Whenever you save a local source file, you can enable immediate deployment of the changes to your default org. You might find this feature useful while trying various user interface and functional behavior or while trying to debug some behavior in an Apex class.

To enable deploy on save, you can:

- Add `"salesforcedx-vscode-core.push-or-deploy-on-save.enabled": true` to the `.vscode/settings.json` file.
- Or update Workspace settings:
  - Select **File** > **Preferences** > **Settings** (Windows or Linux) or **Code** > **Preferences** > **Settings** (macOS).
  - Under Salesforce Feature Previews, select `Push-or-deploy-on-save: Enabled`.

![Deploy on save feature](../../images/deploy-on-save.png)

> We recommend that you enable deploy on save at a project level (Workspace settings) rather than globally on all Salesforce projects you work on (User settings). While working on large sandboxes, be mindful of enabling deploy on save to avoid inadvertently overwriting changes by other developers.

## How it Works

When you enable deploy on save for your project:

- At a given time, only one deployment runs.

- Any files that are saved while a deployment is running are added to a deployment queue.

- When the current deployment completes, a new one that contains the queued files starts. This minimizes the number of deployments and improves performance.

- If there isn’t an active deployment and no files are queued for deployment, a file save triggers an immediate deployment.

If you enable deploy on save while working against a scratch org, the context of the extension is package development model. This means that every time you save a file, **SFDX: Push Source to Default Scratch Org** is initiated and runs `force:source:push` under the hood. In org development model that works with non-source-tracked-orgs, every file save initiates **SFDX: Deploy Source to Org**, which runs `force:source:deploy`.
