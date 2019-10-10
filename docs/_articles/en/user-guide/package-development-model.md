---
title: Package Development Model with VS Code
lang: en
---

When you employ the package development model, developing against an org with source tracking, the changes that you make on your local workstation and in your default development org are tracked for you. You move changes between orgs using packaged sets of metadata. (The org development model, in contrast, involves tracking your changes manually and deploying only your changed metadata to other orgs.) For details, see the [Package Development Model](https://trailhead.salesforce.com/en/content/learn/modules/sfdx_dev_model) Trailhead module.

This article describes how to work with orgs that have source tracking, such as scratch orgs, in Visual Studio Code.

## Get Started

First, open VS Code and open or create a project:

- If you are starting a new project, open the command palette (press Ctrl+Shift+P on Windows or Linux, or Cmd+Shift+P on macOS) and run **SFDX: Create Project**.
- If you are working on an existing project, choose **File** > **Open** and navigate to the directory where you stored your project’s source code. If your project isn’t a Salesforce DX project in source format, see [Project Setup](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_workspace_setup.htm) in the _Salesforce DX Developer Guide_ for information on converting it. Salesforce Extensions for VS Code requires that your project has an `sfdx-project.json`, and you can work with source-tracked orgs only if your metadata is in source format.

Next, authorize a Dev Hub and create a scratch org.

1. To authorize a Dev Hub, open the command palette and run **SFDX: Authorize a Dev Hub**. If you don’t have a Dev Hub, see [Enable Dev Hub in Your Org](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_enable_devhub.htm) in the _Salesforce DX Setup Guide_ for information about setting one up.
1. To create a scratch org and set it as your default org for development, run **SFDX: Create a Default Scratch Org**.

## Push and Pull Source

When you use the package development model, keeping your local project and your default development org in sync is simple. Because you deploy your changes to other orgs using packaged sets of metadata, there’s no need to manually track your changes.

To push your source to the new scratch org, run **SFDX: Push Source to Default Org**.

After you make changes on your local workstation, to push all your changes to the org, run **SFDX: Push Source to Default Org** again.

After you make changes in your browser, run **SFDX: Pull Source from Default Scratch Org** to update your project.

To push files each time you save them, set the user or workspace setting `salesforcedx-vscode-core.push-or-deploy-on-save.enabled` to `true`.
