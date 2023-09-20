---
title: Use Manifest Builder
lang: en
---

## Create Project with Manifest

1. Open the VS Code editor and from the Command Palette, run **SFDX: Create Project with Manifest**.

![Create project](./images/create-project-with-manifest.png)

2. In the code editor's status bar, click Org Picker to open the Command Palette. Select from the list of authorized orgs, or choose to authorize a new org.

If this is the first time you are creating a project in VS Code and haven’t authorized an org, the display text for the Org Picker shows No Default Org Set.

3. Run **SFDX: Authorize an Org** and select a login URL, for example, Sandbox.

![Authorize an Org](./images/authorize-org-command.png)

After you provide an org alias, a browser window opens. Allow access, log in to your org, and then return to the VS Code window. The Org Picker now shows the alias provided while authorizing the org.

![Org Picker](./images/org-picker.png)

### The Manifest (`package.xml`) File

After connecting to a sandbox, DE org, or Trailhead Playground, use the package.xml file to retrieve the metadata from your org. When you run SFDX: Create Project with Manifest command, a package.xml file is created. Add the various metadata types you want to retrieve to this file. To understand how to work with different subsets of metadata in `package.xml` file, see [Sample package.xml Manifest Files](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/manifest_samples.htm) in the _Metadata API Developer Guide_.

### Manifest Builder

Automatically generate a manifest file for a given a set of metadata components instead of editing the package.xml file manually:

1.  In the Explorer view, right-click to select the components you want to use to generate the manifest.
2.  Run **SFDX: Generate Manifest File**
3.  Enter a unique name (without an xml extension) for the manifest file.

A new file is created and added to the manifest folder.

Use the new manifest file to deploy and retrieve source from the org using **SFDX: Deplopy Source in Manifest to Org** or **SFDX: Retrieve Source in Manifest from Org** command.
