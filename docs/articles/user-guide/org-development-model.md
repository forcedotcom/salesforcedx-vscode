---
title: Org Development Model with VS Code
---

When you employ the Org Development Model, you track your changes manually and deploy sets of changes to sandboxes and then to your production org. (The Package Development Model, in contrast, involves working with source-tracked orgs and moving your changes between orgs using packaged sets of metadata.) For details, see the [Org Development Model](https://trailhead.salesforce.com/content/learn/modules/org-development-model) Trailhead module.

This article describes how to work with orgs that don’t have source tracking, such as sandboxes, Developer Edition (DE) orgs, or Trailhead Playgrounds, in Visual Studio Code.

![Demo](/images/changeset-demo.gif)

> NOTICE: The features mentioned in this article are in beta. If you find any bugs or have feedback, please [open a GitHub issue](../bugs-and-feedback).

## Get Started

First, open VS Code and create a project. To create a project with a manifest, open the command palette (press Ctrl+Shift+P on Windows or Linux, or Cmd+Shift+P on macOS) and run **SFDX: Create Project with Manifest**.

![Create project](/images/create-project-with-manifest.png)

Next, authorize the org you want to develop against. To start the login process, open the command palette and run **SFDX: Authorize an Org**.

![Authorize an Org](/images/authorize-org-command.png)

After you select a login URL and give your project a name, your browser opens and you can log in to your org. After you finish logging in, close the browser and return to VS Code.

## Pull and Push Source

After you authorize an org, retrieve your source from it. To retrieve source from an org without source tracking (from an org that’s not a scratch org), you can:
- Right-click a manifest, in the Visual Studio Code explorer or the editor, then select **SFDX: Retrieve Source in Manifest from Org**.
- In the Visual Studio Code explorer, right-click a source file or a directory. Select **SFDX: Retrieve Source from Org**.
- In a source file that’s open in the editor, right-click anywhere in the editing pane. Select **SFDX: Retrieve This Source File from Org**.

> CAUTION: Retrieving source from an org overwrites your local versions of the source files.

![Retrieve source from org](/images/retrieve-source-from-org.png)

After you make code changes, deploy these changes to your org. To deploy source to an org without source tracking (to an org that’s not a scratch org), you can:
- Right-click a manifest, in the Visual Studio Code explorer or the editor, then select **SFDX: Deploy Source in Manifest to Org**.
- In the Visual Studio Code explorer, right-click a source file or a directory. Select **SFDX: Deploy Source to Org**.
- In a source file that’s open in the editor, right-click anywhere in the editing pane. Select **SFDX: Deploy This Source File to Org**.
- To deploy files each time you save them, set the user or workspace setting `salesforcedx-vscode-core.push-or-deploy-on-save.enabled` to `true`.

> CAUTION: Deploying source to an org overwrites the metadata in your org with your local versions of the source files.

![Deploy source to org](/images/deploy-source-to-org.png)

To delete source from your project and from your non-source-tracked org, you can:
- Right-click a manifest, a source file, or a directory in the Visual Studio Code explorer. Select **SFDX: Delete from Project and Org**.
- Right-click a file that’s open in the editor, and select **SFDX: Delete This from Project and Org**.