---
title: Org Browser
lang: en
---

Org Browser makes it easy to retrieve metadata sources by displaying org metadata types and their corresponding components. Access the org browser by clicking the cloud icon in the VS Code Activity Bar. Use the Org Browser to:

- Browse your org metadata.
- View the available metadata types and their corresponding components in your default org.
- Retrieve metadata source, without using a [manifest file](./en//deploy-changes/manifestbuilder).

## Overview

![Org Browser Overview](./images/org_browser_overview.png)

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

## List and Refresh Metadata

The Org Browser lists all the metadata types **(4)** in your default org. To view the components **(5)**, expand the metadata type. When you expand metadata types with folders such as Reports, Dashboards, Documents, and EmailTemplates, all the available folders are displayed. You can view the components in a folder by expanding it. Expand the `Custom Object` metadata type to view fields and their type information. Additional information is displayed for following field types:

- strings: string(length)
- textareas: textarea(length)
- emails: email(length)
- lookups: lookup(reference)

Use the icons in the Org Browser, or the **SFDX:Refresh Types** and **SFDX:Refresh Components** commands to refresh metadata at org level, for a metadata type, for folders within a metadata type, or for components within a folder.

- **(2)** Refresh available metadata types in the org.
- **(6)** Refresh components for the corresponding metadata type.
- **(10)** Refresh to only update the folders within the metadata type.
- **(11)** Refresh components within a Folder.

![Metadata type with folders](./images/org_browser_folder_ret.png)

## Retrieve Org Metadata

You can retrieve a single metadata component or all components of the same type. Click retrieve icon next to:

- Component name **(7)** to retrieve a component to your local project
- Metadata type **(8)** to retrieve all components of the type

You can retrieve all folders of folder metadata types such as Reports, Dashboards, Documents, and EmailTemplates, by clicking on the retrieve icon next to the metadata type. When you retrieve a folder, only information about the folder is retrieved and added to a `<folder>-meta.xml` file. To retrieve components within folders, view the components in a folder by expanding it and then retrieve the individual component by clicking the retrieve icon.

Currently, the source is retrieved into your default package directory as defined in the `sfdx-project.json` file.

You can also retrieve multiple components from the default org by clicking the retrieve button next to the metadata type. If retrieving a component overwrites it, you're prompted to select how to proceed.

![Overwrite components](./images/overwrite-prompt.png)

When you retrieve components for a metadata type, the Org Browser automatically refreshes the component list for the selected type and then retrieves them. This action ensures that the extensions accurately check the local workspace for existing components.

**Note:** Because of the asynchronous nature of the Metadata API calls, a simultaneous deploy and retrieve could potentially lead to a race condition. To prevent retrieving unexpected components, be mindful of using the Org Browser while a deploy operation is in progress.
