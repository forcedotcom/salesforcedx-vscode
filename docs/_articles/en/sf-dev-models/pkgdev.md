---
title: Salesforce Package Development Model
lang: en
---

## Package Development Model

Use package development model for developing against orgs with source tracking such as scratch orgs. This model tracks the changes you make on your local workstation and in your default development org. Use packaged sets of metadata to move changes between orgs. See the [Package Development Model](https://trailhead.salesforce.com/en/content/learn/modules/sfdx_dev_model) Trailhead module.

## Create Project

To start developing with this model:

1. Open the VS Code editor and from the Command Palette, run **SFDX: Create Project**.
   If you want to work on an existing project, choose **File** > **Open** and navigate to the project directory. Before you open an existing project in VS Code, make sure that your project has a `sfdx-project.json` file and that metadata is in source format.
   - For information on the project structure, see [Project Setup](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_workspace_setup.htm) in the _Salesforce DX Developer Guide_.
   - You can work with source-tracked orgs only if your metadata is in source format. See Source Format (./en/user-guide/source-format).
1. In the code editor's status bar, click Org Picker to open the Command Palette.
1. Run **SFDX: Authorize an Org**. If you don’t have a Dev Hub, see [Enable Dev Hub in Your Org](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_enable_devhub.htm) in the _Salesforce DX Setup Guide_.
1. Click Org Picker and run **SFDX: Create a Default Scratch Org** to create and set a scratch org as your default org for development.
1. Select the scratch org shape, enter an alias, and enter the duration when the scratch org expires. The Org Picker now shows the alias provided for the scratch org. You can click the browser icon ({% octicon browser %}) in the status bar to open the default org you are working against.
   To change the default org you’re developing against, click the Org Picker and select a different org. Or, open the Command Palette and run **SFDX: Authorize an Org** or **SFDX: Create a Default Scratch Org**.

### Push and Pull Source

When you use the package development model, it’s simple to keep your local project and default development org in sync. Because you deploy your changes to other orgs using packaged sets of metadata, there’s no need to manually track your changes.
VS Code is context aware that you are working in a scratch org and provides only push and pull commands, not commands to retrieve and deploy source.

#### Push Source

To push your source to the new scratch org or changes you made, run **SFDX: Push Source to Default Scratch Org**.

If you want the changes in the project to overwrite changes in the scratch org, run **SFDX: Push Source to Default Scratch Org and Override Conflicts**.

#### Pull Source

After you make changes in your browser, run **SFDX: Pull Source from Default Scratch Org** to update your project.

If you want the changes in the scratch org to overwrite changes in the project, run **SFDX: Pull Source from Default Scratch Org and Override Conflicts**.

#### View Changes

Before you push local changes to the scratch org or pull remote changes to the local project, you can see the changes in the Output panel. To do so, run **SFDX: View Changes in Default Scratch Org** from the Command Palette.
