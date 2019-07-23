---
title: Org Browser
---

The Org Browser displays the available metadata types and their corresponding components in your default org. This feature allows you to retrieve metadata source without having to use a [manifest file](./org-development-model#the-manifest-packagexml-file). The Org Browser is only available when working against non-scratch orgs, such as sandboxes or dev orgs.

> NOTICE: The Org Browser is currently in beta. If you find any bugs or have feedback, [open a GitHub issue](../bugs-and-feedback).

## Enabling the Org Browser

Because the Org Browser is in beta, you will first need to enable it in your user or workspace settings. The feature flag is located under the "Salesforce Feature Previews" category. Alternatively, enter "Org Browser" in the search bar to find it. 

![Enable Org Browser](../../images/org_browser_setting.png)

## Overview

![Org Browser Overview](../../images/org_browser_overview.png)

1. Open Org Browser
2. Refresh available metadata types in org
3. Default org
4. Metadata type
5. Metadata component
6. Refresh components for metadata type
7. Retrieve source for metadata component

Open the Org Browser by clicking on the cloud icon in the VS Code sidebar **(1)**. If you don't see the icon, make sure your [default org](./default-org) is set to a non-scratch org and the feature flag is enabled as described above.

## Listing Metadata

When you open the view you will see the metadata types available in the org. Expanding a type **(4)** will fetch a list of the components of that type. This information is saved in your local project under the .sfdx directory to minimize the number of calls to the org. If you need an updated list of components for a type, click the refresh button next to the type **(6)**.

Metadata types with folders (Reports, Dashboards, Documents, and EmailTemplates) will first fetch the available folders when they are expanded. Expanding a folder will then show you the components under that folder. Clicking the refresh button next to one of these folder metadata types will refresh the folders, not the components. You can refresh the components for a particular folder by clicking the button next to the folder instead. 

![Metadata type with folders](../../images/org_browser_folders.png)

## Retrieving Components

A component can be retrieved to your local project by clicking the retrieve button **(7)** next to the component name. Currently, the component is retrieved into your default package directory, which is defined in the [sfdx-project.json](../getting-started/first-project#the-sfdx-projectjson-file) file. If you have an existing version of that component locally, you will be prompted to confirm if you want to overwrite the local version.