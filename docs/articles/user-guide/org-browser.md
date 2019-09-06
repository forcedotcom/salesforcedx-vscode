---
title: Org Browser
---

The Org Browser displays the available metadata types and their corresponding components in your default org. This feature makes it easier and simpler to retrieve metadata source, without having to use a [manifest file](./org-development-model#the-manifest-packagexml-file). The Org Browser is available only in non-scratch orgs such as sandboxes or dev orgs.

> NOTICE: The Org Browser feature is currently in beta. If you find any bugs or have feedback, [open a GitHub issue](../bugs-and-feedback).

## Opening the Org Browser

![Org Browser Overview](../../images/org_browser_overview.png)

1. Open Org Browser
2. Refresh available metadata types in the org
3. Default org
4. Metadata type
5. Metadata component
6. Refresh components for metadata type
7. Retrieve source for metadata component

To open the Org Browser, click the cloud icon in the side bar of the VS Code window **(1)**. If you don't see the icon, make sure your [default org](./default-org) is set to a non-scratch org and the feature is enabled.

When you open the Org Browser, all the metadata for the default org is saved in your local project under the .sfdx directory to minimize the number of calls to the org.

## Listing and Refreshing Metadata

The Org Browser lists all the metadata types **(4)** in your default org. To view the components **(5)**, expand the metadata type. When you expand metadata types with folders such as Reports, Dashboards, Documents, and EmailTemplates, all the available folders are displayed. You can view the components in a folder by expanding it.

You can refresh metadata at org level, for a type, for folders in a type, and for components in a folder. Click refresh icon next to:

- Org Browser **(2)** to refresh available metadata types in the org
- metadata type **(6)** to get an updated list of components for the type
- folder metadata type to update the folders in the type, but not the components in the folder
- folder in a metadata type to refresh the components in it

![Metadata type with folders](../../images/org_browser_folders.png)

## Retrieving Components

You can retrieve a component to your local project by clicking the retrieve button **(7)** next to the component name. Currently, the component is retrieved into your default package directory, which is defined in the [sfdx-project.json](../getting-started/first-project#the-sfdx-projectjson-file) file. If a local version of the component exists, you'll be prompted to confirm before overwriting it.

![Overwrite local component](../../images/org_browser_overwrite.png)
