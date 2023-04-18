---
title: Metadata Operations
lang: en
---

## Source Diff
The Source Diff command allows you to diff metadata types against your default org. This feature makes it easier to visualize the changes between files in your local project and the metadata in your org. You can look at diffs for an individual file or directory.

### Usage
Menu options `SFDX: Diff File Against Org` and `SFDX: Diff Folder Against Org` appear when you right-click a file or folder.  

![Source Diff command](../../../images/source_diff.png)

You can then view individual file diffs side by side. If a file doesn’t exist locally or in the Org, it will not show up in the list.

## Retrieve Source

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

You can also use [Org Browser](./en/user-guide/development-models/#create-project-and-use-org-browser) to retrieve source.

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
## Deploy Source

When you deploy the code changes, the local version of the source files overwrites the metadata in your org. You could enable detecting conflicts between the local metadata and the org. See [Detect Conflicts](./en/user-guide/detect-conflicts).

![Deploy source to org](./images/deploy-source-to-org.png)

You can deploy source of a manifest, source files, directories, or folders:

- Manifest
  - In VS Code explorer or editor, right-click a manifest file and select **SFDX: Deploy Source in Manifest in Org**.
  - With a manifest file open in the editor, open the Command Palette and run **SFDX: Deploy Source in Manifest in Org**.
- Source File or Directory
- In VS Code explorer, right-click single or multi-selected source files or directories and select **SFDX: Deploy Source to Org**.
- With a source file open in the editor, right-click in the editing pane and select **SFDX: Deploy This Source File to Org**.
- With a source file open in the editor, open the command palette and run **SFDX: Deploy This Source File to Org**.

## Delete Source

You can delete source from your project and from your org.

- In the VS Code explorer, right-click a source file or a directory and select **SFDX: Delete from Project and Org**.
- With a source file open in the editor, right-click the file and select **SFDX: Delete This from Project and Org**.
- With a source file open in the editor, open the Command Palette and run **SFDX: Delete This from Project and Org**.

## Rename Component

You can rename a component and all the files associated with it using the **SFDX: Rename Component** command.