---
title: Remove Code Builder
lang: en
---

## Uninstall Code Builder

You can uninstall Code Builder, if necessary. If you plan to reinstall Code Builder, don't delete the Code Builder auth providers. However, if you deleted the auth providers, you can recreate them by re-enabling the Code Builder preference in Setup.

**Important**: Uninstalling Code Builder also removes all associated data including, but not limited to, projects and activity history.

### Remove Permission Set Assignments

Before you uninstall the Code Builder package, remove permission set assignments, then delete Code Builder permissions sets.

First, remove the Code Builder permission set group assignments from all Code Builder users.

- CodeBuilderGroup

Next, delete the Code Builder permission sets.

From Setup, enter `Permission Sets` in the Quick Find box, then select **Permission Sets**.
Delete the `Code Builder Package` permission set.

### Uninstall the Code Builder Package

After you remove the permission set and permission set assignments, you can uninstall the Code Builder package, which removes the application and all its associated data and objects.

Before you uninstall the package:

- Remove Code Builder permission Set assignments.
- Delete Code Builder permission sets.

1. From Setup, enter `Installed Packages` in the Quick Find box, then select **Installed Packages**.
2. Click **Uninstall**, then scroll to the bottom of the page to choose whether to save and export a copy of the package’s data.
3. Select **Yes, I want to uninstall this package and permanently delete all associated components**.
4. Click **Uninstall**.

### Disable Code Builder Preference

When Code Builder was installed, a Salesforce admin first enabled Code Builder. To ensure that Code Builder can’t be installed or used, you can disable the Code Builder preference.

From Setup, enter `Code Builder` in the Quick Find box, then select **Code Builder**.
Disable **Enable Code Builder**.
You no longer can install or upgrade the Code Builder app and users see Code Builder has not been enabled for your org when they try to use it.
