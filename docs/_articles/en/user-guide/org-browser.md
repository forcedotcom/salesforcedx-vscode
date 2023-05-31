---
title: Org Browser
lang: en
---

The Org Browser displays the available metadata types and their corresponding components in your default org. This feature makes it easier to retrieve metadata source, without having to use a [manifest file](./en/user-guide/development-models/#create-project-with-manifest).

## Opening the Org Browser

![Org Browser Overview](../../../images/org_browser_overview.png)

1. Open Org Browser
2. Refresh available metadata types in the org
3. Default org
4. Metadata type
5. Metadata component
6. Refresh components for metadata type
7. Retrieve source for metadata component
8. Retrieve source for all components of metadata type
9. Retrieve source for metadata component and open it in VS Code

To open the Org Browser, click the cloud icon in the Activity Bar of the VS Code window **(1)**.

When you open the Org Browser, all the metadata for the default org is saved in your local project under the `.sfdx` directory to minimize the number of calls to the org.

## Listing and Refreshing Metadata

The Org Browser lists all the metadata types **(4)** in your default org. To view the components **(5)**, expand the metadata type. When you expand metadata types with folders such as Reports, Dashboards, Documents, and EmailTemplates, all the available folders are displayed. You can view the components in a folder by expanding it. Expand the `Custom Object` metadata type to view fields and their type information. Additional information is displayed for following field types:
-  strings: string(length)
-  textareas: textarea(length)
-  emails: email(length)
-  lookups: lookup(reference)

You can refresh metadata at org level, for a type, for folders in a type, and for components in a folder. Click refresh icon next to:

- Org Browser **(2)** to refresh available metadata types in the org
- Metadata type **(6)** to get an updated list of components for the type
- Folder metadata type to update the folders in the type, but not the components in the folder
- Folder in a metadata type to refresh the components in it

![Metadata type with folders](../../../images/org_browser_folder_ret.png)

## Retrieving Metadata

You can retrieve a single metadata component or all components of the same type. Click retrieve icon next to:

- Component name **(7)** to retrieve a component to your local project
- Metadata type **(8)** to retrieve all components of the type

You can retrieve all folders of folder metadata types such as Reports, Dashboards, Documents, and EmailTemplates, by clicking on the retrieve icon next to the metadata type. When you retrieve a folder, only information about the folder is retrieved  and added to a `<folder>-meta.xml` file. To retrieve components within folders, view the components in a folder by expanding it and then retrieve the individual component by clicking the retrieve icon. 

Currently, the source is retrieved into your default package directory as defined in the [`sfdx-project.json`](./en/getting-started/first-project#the-sfdx-projectjson-file) file.

You can also retrieve multiple components from the default org by clicking the retrieve button next to the metadata type. If retrieving a component overwrites it, you're prompted to select how to proceed.

![Overwrite components](../../../images/overwrite-prompt.png)

When you retrieve components for a metadata type, the Org Browser automatically refreshes the component list for the selected type and then retrieves them. This action ensures that the extensions accurately check the local workspace for existing components.

**Note:** Because of the asynchronous nature of the Metadata API calls, a simultaneous deploy and retrieve could potentially lead to a race condition. To prevent retrieving unexpected components, be mindful of using the Org Browser while a deploy operation is in progress.

## Create Project and Use Org Browser

To develop in non-scratch orgs and use Org Browser to retrieve source:

1. Open the VS Code editor and from the Command Palette, run **SFDX: Create Project**.
1. In the code editor's status bar, click Org Picker to open the Command Palette. Select a command to authorize an org, Dev Hub, or create a scratch org, or select from the list of authorized orgs.
1. Run **SFDX: Authorize an Org** and select a login URL, for example Sandbox. Log in to your org in the browser window and then return to the VS Code window.

Org Browser displays the available metadata types and their corresponding components in your default org. It saves the metadata of the default org in your local project under the .sfdx directory. See [Org Browser](./en/user-guide/org-browser).

### Retrieve Source

You can retrieve a component or multiple components to your local project from the default org:
- In Org Browser, click the retrieve button next to the component or the metadata type.
- In VS Code explorer, right-click single or multi-selected source files or directories and select **SFDX: Retrieve Source from Org**.

You can also refresh metadata at org level, for a type, for folders in a type, and for components in a folder by clicking the refresh icon. Before refreshing the metadata, you can compare the differences between your local project and the metadata in your org. See [Source Diff](./en/user-guide/source-diff).

### Deploy Source

After you have made the code changes you can deploy the source files or directories.

- In VS Code explorer, right-click single or multi-selected source files or directories and select  **SFDX: Deploy Source to Org**.
- With a source file open in the editor, right-click in the editing pane and select **SFDX: Deploy This Source File to Org**.
- With a source file open in the editor, open the Command Palette and run **SFDX: Deploy This Source File to Org**.
