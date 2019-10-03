---
title: Org Development Model with VS Code
lang: en
---

When you employ the org development model, you track your changes manually and deploy sets of changes to sandboxes and then to your production org. (The package development model, in contrast, involves working with source-tracked orgs and moving your changes between orgs using packaged sets of metadata.) For details, see the [Org Development Model](https://trailhead.salesforce.com/content/learn/modules/org-development-model) Trailhead module.

This article describes how to work with orgs that don’t have source tracking, such as sandboxes, Developer Edition (DE) orgs, or Trailhead Playgrounds, in Visual Studio Code.

![Demo](./images/changeset-demo.gif)

> NOTICE: The features mentioned in this article are in beta. If you find any bugs or have feedback, [open a GitHub issue](../bugs-and-feedback).

## Get Started

First, open VS Code and create a project. To create a project with a manifest, open the command palette (press Ctrl+Shift+P on Windows or Linux, or Cmd+Shift+P on macOS) and run **SFDX: Create Project with Manifest**.

![Create project](./images/create-project-with-manifest.png)

Next, authorize the org you want to develop against. To start the login process, open the command palette and run **SFDX: Authorize an Org**.

![Authorize an Org](./images/authorize-org-command.png)

After you select a login URL and give your project a name, your browser opens and you can log in to your org. After you finish logging in, close the browser and return to VS Code.

## The Manifest (`package.xml`) File

If you are connected to a sandbox, DE org, or Trailhead Playground, the easiest way to retrieve all the metadata you want to work with from your org is by using a `package.xml` file. If you don’t already have one, update the provided file, or create a `package.xml` file in the `manifest` directory.

Add the various metadata types you want to retrieve to this file. For information about the `package.xml` file, see [Sample package.xml Manifest Files](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/manifest_samples.htm) in the _Metadata API Developer Guide_.

After you [retrieve your source](#retrieve-source), your project structure looks something like this.

```text
your-app
├── README.md
├── sfdx-project.json
├── .sfdx
├── .vscode
│   ├── extensions.json
│   └── settings.json
├── force-app
|   └── main
|       └── default
|           ├── aura
|           ├── classes
|           └── objects
└── manifest
    └── package.xml
```

## Retrieve Source

After you authorize an org, retrieve your source from it. After you make changes in the Salesforce user interface, retrieve those changes from your default org. (Be sure to keep track of those changes; when you use the org development model, your changes aren’t tracked automatically.)

> CAUTION: Retrieving source from an org overwrites the local versions of the source files.

![Retrieve source from org](./images/retrieve-source-from-org.png)

To retrieve source from an org without source tracking (from an org that’s not a scratch org), you can:

- Right-click a manifest, in the Visual Studio Code explorer or the editor, then select **SFDX: Retrieve Source in Manifest from Org**.
- With a manifest file open in the editor, open the command palette (press Ctrl+Shift+P on Windows or Linux, or Cmd+Shift+P on macOS) and run **SFDX: Retrieve Source in Manifest from Org**.
- In the Visual Studio Code explorer, right-click a source file or a directory. Select **SFDX: Retrieve Source from Org**.
  > NOTE: The retrieval occurs only on metadata that’s nested (in the file tree) under the item you select. For example, if you right-click the `classes` folder, all Apex classes that **currently exist in that directory** are retrieved or deployed. Running a retrieve operation on a directory like `classes` doesn’t retrieve all Apex classes on the org; it retrieves updates only to classes that already exist in the folder. If you want to retrieve a new Apex class, add that class (or all Apex classes) to a `package.xml` file and retrieve your source using the manifest file. (Or, you can use a terminal to run `sfdx force:source:retrieve --metadata ApexClass:YourApexClass`.)
- In a source file that’s open in the editor, right-click anywhere in the editing pane. Select **SFDX: Retrieve This Source File from Org**.
- With a source file open in the editor, open the command palette (press Ctrl+Shift+P on Windows or Linux, or Cmd+Shift+P on macOS) and run **SFDX: Retrieve This Source File from Org**.
- Clicking the retrieve button next to a component in the [Org Browser](./org-browser) (Beta).

## Deploy Source

After you make code changes, deploy these changes to your org.

> CAUTION: Deploying source to an org overwrites the metadata in your org with the local versions of the source files.

![Deploy source to org](./images/deploy-source-to-org.png)

To deploy source to an org without source tracking (to an org that’s not a scratch org), you can:

- Right-click a manifest, in the Visual Studio Code explorer or the editor, then select **SFDX: Deploy Source in Manifest to Org**.
- With a manifest file open in the editor, open the command palette (press Ctrl+Shift+P on Windows or Linux, or Cmd+Shift+P on macOS) and run **SFDX: Deploy Source in Manifest to Org**
- In the Visual Studio Code explorer, right-click a source file or a directory. Select **SFDX: Deploy Source to Org**.
- In a source file that’s open in the editor, right-click anywhere in the editing pane. Select **SFDX: Deploy This Source File to Org**.
- With a source file open in the editor, open the command palette (press Ctrl+Shift+P on Windows or Linux, or Cmd+Shift+P on macOS) and run **SFDX: Deploy This Source File to Org**.
- To deploy files each time you save them, set the user or workspace setting `salesforcedx-vscode-core.push-or-deploy-on-save.enabled` to `true`.

## Delete Source

To delete source from your project and from your non-source-tracked org, you can:

- Right-click a manifest, a source file, or a directory in the Visual Studio Code explorer. Select **SFDX: Delete from Project and Org**.
- Right-click a file that’s open in the editor, and select **SFDX: Delete This from Project and Org**.
- With a source file open in the editor, open the command palette (press Ctrl+Shift+P on Windows or Linux, or Cmd+Shift+P on macOS) and run **SFDX: Delete from Project and Org**.
