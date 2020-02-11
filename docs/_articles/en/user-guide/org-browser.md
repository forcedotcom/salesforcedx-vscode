---
title: Org Browser
lang: en
---

The Org Browser displays the available metadata types and their corresponding components in your default org. This feature makes it easier and simpler to retrieve metadata source, without having to use a [manifest file](./en/user-guide/development-models/#create-project-with-manifest). The Org Browser is available only in non-scratch orgs such as sandboxes or dev orgs.

## Opening the Org Browser

![Org Browser Overview](./images/org_browser_overview.png)

1. Open Org Browser
2. Refresh available metadata types in the org
3. Default org
4. Metadata type
5. Metadata component
6. Refresh components for metadata type
7. Retrieve source for metadata component
8. Retrieve source for metadata type

To open the Org Browser, click the cloud icon in the side bar of the VS Code window **(1)**. If you don't see the icon, make sure your [default org](./en/user-guide/default-org/) is set to a non-scratch org.

When you open the Org Browser, all the metadata for the default org is saved in your local project under the .sfdx directory to minimize the number of calls to the org.

## Listing and Refreshing Metadata

The Org Browser lists all the metadata types **(4)** in your default org. To view the components **(5)**, expand the metadata type. When you expand metadata types with folders such as Reports, Dashboards, Documents, and EmailTemplates, all the available folders are displayed. You can view the components in a folder by expanding it.

You can refresh metadata at org level, for a type, for folders in a type, and for components in a folder. Click refresh icon next to:

- Org Browser **(2)** to refresh available metadata types in the org
- metadata type **(6)** to get an updated list of components for the type
- folder metadata type to update the folders in the type, but not the components in the folder
- folder in a metadata type to refresh the components in it

![Metadata type with folders](./images/org_browser_folders.png)

## Retrieving Metadata

You can retrieve a metadata component or all metadata of the same type. Click retrieve icon next to:

- component name **(7)** to retrieve a component to your local project
- metadata type **(8)** to retrive all components of the type

Currently, the source is retrieved into your default package directory as defined in the [sfdx-project.json](./en/getting-started/first-project#the-sfdx-projectjson-file) file.

You can also retrieve multiple components from the default org by clicking the retrieve button next to the metadata type. If retrieving a component overwrites it, you'll be prompted to select how to proceed.

![Overwrite components](./images/overwrite-prompt.png)

When you retrieve components for a metadata type, the Org Browser automatically refreshes the component list for the selected type and then retrieves them. This ensures that the extensions accurately check the local workspace for existing components.

> Because of the asynchronous nature of the Metadata API calls, a simultaneous deploy and retrieve could potentially lead to a race condition. To prevent retrieving unexpected components, be mindful of using the Org Browser while a deploy operation is in progress.
