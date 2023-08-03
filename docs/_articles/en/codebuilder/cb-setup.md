---
title: Set Up Code Builder
lang: en
---

## Enable and Install Code Builder

Enable Code Builder to provide the permissions needed to install the Code Builder managed package in a Salesforce supported org.

CHECK THIS: **To install Code Builder in a Professional Edition org, the org must have API access, which enables Code Builder to access data from the source control system. If you attempt to install Code Builder in a Professional Edition org without API access, an installation error occurs. Contact your Account Executive to request the API add-on.**

1. From Setup, enter Code Builder in the Quick Find box, then select Code Builder. If you don’t see Code Builder as an option under Setup, your Developer Edition org was likely created before Code Builder was introduced and doesn’t have the correct permissions. To continue, create another Developer Edition org.

2. Enable Code Builder, and then review and accept the license agreement, which allows you to install the package.
   CHECK **You can disable the preference at any time. Disabling the preference means that you can’t install the app or updates. If Code Builder is already installed, disabling the preference prevents access to the Code Builder application.**

3. Click **Install Package**.
   After the installer launches, you’re guided through the installation process to install the latest version of the Code Builder managed package. You can come back to this Setup page to reinstall or upgrade the package.

4. Select **Install for All Users**, and then click **Install**.

5. Approve third-party access and click **Continue**

CHECK **Next, create the connected app so that Code Builder appears in App Launcher, then be sure to assign the appropriate Code Builder permission sets to each team member.**
or
**Code Builder Dashboard** in now available in App Launcher. Be sure to assign the appropriate Code Builder permission sets to team member.

## Confirm Code Builder Package Installation

When installation is complete, you receive a confirmation email. You can confirm the installation on the Installed Packages Setup page.

From Setup, enter `Installed Packages` in the Quick Find box, then select **Installed Packages**. You see an entry for Code Builder that looks something like this. If you get the message that the app is taking a long time to install, you get automatically redirected to this page after you click **Done**.

![Installed Package](../../../images/installed_package.png)

## Add Team Members as Users in the Code Builder Org

Add any team members who aren’t already users in the Code Builder org. For each team member, specify the appropriate license and profile based on their role.

The listed license and profile is required to use Code Builder.
|**ROLE** | **LICENSE** | **PROFILE** |
| --- | --- | --- |
| Team Member | Salesforce | Standard User |
| | | |

:::tip
This procedure generates an email inviting the new users into the org. But until you’re finished setting up DevOps Center, there’s not much for them to do in the org. We recommend that you let your team know that you’re setting up DevOps Center and to wait until they hear from you before logging in.
:::

1. Log in to the Code Builder org.
2. From Setup, enter `Users` in the Quick Find box, then select **Users.**
3. Click **New User** or **Add Multiple Users**.
4. Select the appropriate license type and profile based on the user’s role.
5. Select the **Generate passwords and notify user via email** checkbox.
6. Click **Save**.

## Assign Permissions

As an admin, assign user permissions:

1. From Setup, enter `Permission Set Groups` in the Quick Find box, then select **Permission Set Groups**.
2. Click **CodeBuilderGroup**.
3. Click **Manage Assignments**
4. Click **Add Assignments**.
5. Select the checkboxes next to the names of the users to assign the permission set group, and click **Next**.
6. Click **Assign**.

Your users can now go to the App Launcher and launch **Code Builder**.

## Upgrade to the Latest Code Builder Version

In most cases, you don’t have to do anything to upgrade to the latest version of the Code Builder. When we release a new package version, we update your org automatically.

However, sometimes the push upgrade doesn’t work. If you don’t have the latest version, we recommend that you manually install the package through the Code Builder Setup page. If a newer version doesn’t exist, the package installer informs you that you already have the latest version.

## See Also

[Installing Packages](https://developer.salesforce.com/docs/atlas.en-us.appExchangeInstallGuide.meta/appExchangeInstallGuide/appexchange_install_installation.htm)

[Assign a Permission Set to Multiple Users](https://help.salesforce.com/s/articleView?id=sf.perm_sets_mass_assign.htm&type=5)

[View and Manage Users](https://help.salesforce.com/s/articleView?id=sf.admin_users.htm&type=5)
[Standard Profiles](https://help.salesforce.com/s/articleView?id=sf.standard_profiles.htm&type=5)
[User Licenses](https://help.salesforce.com/s/articleView?id=sf.users_understanding_license_types.htm&type=5)
