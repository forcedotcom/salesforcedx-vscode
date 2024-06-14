---
title: Use Manifest Builder
lang: ja
---

## Create Project with Manifest

1. Open the VS Code editor and from the Command Palette, run **SFDX: Create Project with Manifest**.

![Create project](./images/create-project-with-manifest.png)

1. In the code editor's status bar, click Org Picker to open the Command Palette. You can select from the list of authorized orgs, or you can choose to authorize a new org.

If this is the first time you are creating a project in VS Code and haven’t authorized an org, the display text for the Org Picker shows No Default Org Set.

1. Run **SFDX: Authorize an Org** and select a login URL, for example Sandbox.

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

Use the new manifest file to deploy and retrieve source from the org using **SFDX: Deploy Source in Manifest to Org** or **SFDX: Retrieve Source in Manifest from Org** commands.

### Retrieve Source

Org Development model doesn’t automatically track changes to your org, so be sure to keep track of the changes you retrieve. Retrieving source from an org overwrites the local versions of the source files. When you retrieve source from an org, you could enable conflict detection between the org and the local metadata. See [Detect Conflicts](./en/user-guide/detect-conflicts).

![Retrieve source from org](./images/retrieve-source-from-org.png)

You can retrieve source for a manifest, source files, directories, or folders:

- Manifest
  - In VS Code explorer or editor, right-click a manifest file and select **SFDX: Retrieve Source in Manifest from Org**.
  - With a manifest file open in the editor, open the Command Palette and run **SFDX: Retrieve Source in Manifest from Org**.
- Source File or Directory
  - In VS Code explorer, right-click a source file or a directory and select **SFDX: Retrieve Source from Org**.
  - With a source file open in the editor, right-click in the editing pane and select **SFDX: Retrieve This Source from Org**.
  - With a source file open in the editor, open the Command Palette and run **SFDX: Retrieve This Source from Org**.

When you select an item to retrieve source, only the existing nested items in the directory structure are retrieved. For example, if you retrieve source for the `classes` folder, the Apex classes that **currently exist in that directory** are retrieved. The command doesn’t retrieve all the Apex classes in the org; it only updates the classes that already exist in the folder. If you want to retrieve a new Apex class, add that class (or all Apex classes) to a `package.xml` file and retrieve source using the manifest file. You could also use a terminal to run `sfdx force:source:retrieve --metadata ApexClass:YourApexClass`.

You can also use [Org Browser](./en/user-guide/development-models#create-project-and-use-org-browser) to retrieve source from orgs.

The project structure after you retrieve source:

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

### Deploy Source

When you deploy the code changes, the local version of the source files overwrites the metadata in your org. You could enable detecting conflicts between the local metadata and the org. See [Detect Conflicts](./en/user-guide/detect-conflicts).

![Deploy source to org](./images/deploy-source-to-org.png)

You can deploy source of a manifest, source files, directories, or folders:

- Manifest
  - In VS Code explorer or editor, right-click a manifest file and select **SFDX: Deploy Source in Manifest in Org**.
  - With a manifest file open in the editor, open the Command Palette and run **SFDX: Deploy Source in Manifest in Org**.
- Source File or Directory
- In VS Code explorer, right-click single or multi-selected source files or directories and select **SFDX: Deploy Source to Org**.
- With a source file open in the editor, right-click in the editing pane and select **SFDX: Deploy This Source File to Org**.
- With a source file open in the editor, open the Command Palette and run **SFDX: Deploy This Source File to Org**.

### Delete Source

You can delete source from your project and from your org.

- In the VS Code explorer, right-click a manifest, a source file, or a directory and select **SFDX: Delete from Project and Org**.
- With a source file open in the editor, right-click the file and select **SFDX: Delete This from Project and Org**.
- With a source file open in the editor, open the Command Palette and run **SFDX: Delete from Project and Org**.
