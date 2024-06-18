---
title: Set Up Code Builder
lang: en
---

Enable Code Builder to provide the permissions needed to install the Code Builder managed package in a supported Salesforce edition.

## Supported Editions

**Available in**: Lightning Experience in Enterprise, Performance, Professional, and Unlimited Editions.

Code Builder isn't available in sandboxes. However, during the development lifecycle, you can deploy code from Code Builder in a supported edition to a sandbox.

**Not Available in**: EU Operating Zone. EU Operating zone is a special paid offering that provides an enhanced level of data residency commitment. Code Builder is supported in orgs in the EU that aren’t part of EU OZ, per standard product terms and conditions.

## Enable and Install Code Builder

To install Code Builder in a Professional Edition org, the org must have API access. If you attempt to install Code Builder in a Professional Edition org without API access, an installation error occurs. To request the API add-on, contact your Account Executive.

**Note**:
- Turning on Code Builder in Government Cloud Plus organizations can send data outside the authorization boundary. Contact your Salesforce account executive for more details.
- Code Builder runs in the cloud with a different IP address from your org and your computer. If your org has Trusted IP Ranges configured in Network Access in Setup, you can't connect to an org from Code Builder because the IP range for Code Builder can vary. See the [Known Gaps and Issues doc](https://github.com/forcedotcom/code-builder-feedback/wiki/Known-Gaps-and-Issues#ip-restricted-orgs) on GitHub.

1. From Setup, enter Code Builder in the Quick Find box, then select Code Builder.

2. Enable Code Builder, and then review and accept the license agreement, which allows you to install the package.You can disable the preference at any time. If Code Builder is already installed, disabling the preference prevents access to the Code Builder application.

3. Click **Install Package**.
   After the installer launches, you’re guided through the installation process to install the latest version of the Code Builder managed package. You can come back to this Setup page to reinstall or upgrade the package.

4. Select **Install for All Users**, and then click **Install**.

5. Approve third-party access and click **Continue**.

The code Builder Dashboard in now available in App Launcher. Be sure to assign the appropriate Code Builder permission sets to team members.

## Confirm Code Builder Package Installation

When installation is completed, you receive a confirmation email. You can confirm the installation on the Installed Packages Setup page.

From Setup, enter `Installed Packages` in the Quick Find box, then select **Installed Packages**. You see an entry for Code Builder that looks something like this. If you get the message that the app is taking a long time to install, you get automatically redirected to this page after you click **Done**.

![Installed Package](./images/installed_package.png)

## Add Team Members as Users in the Code Builder Org

Code Builder is accessed through a user-based license and works with the [Identity](https://help.salesforce.com/s/articleView?id=sf.users_license_types_available.htm&type=5) or the [Free Limited Access](https://help.salesforce.com/s/articleView?id=release-notes.rn_sfdx_dev_hub.htm&release=218&type=5) licenses.


### Licenses for Editions

The number of Code Builder licenses available depends on the Salesforce edition:


| Salesforce Edition      | Professional      |  Enterprise     |  Unlimited     |
|  ---  |  ---  |  ---  |  ---  |
|     Code Builder Users  |  10     |  40     |  100     |

**Note**: The number of Code Builder licenses in a Trial org depends on the Salesforce edition.

### Licenses for Add-ons

The number of Code Builder licenses associated with add-ons are:

| Add-on      | Developer Pro Sandbox      |  Partial Copy Sandbox     |  Full Sandbox Add-On     |
|  ---  |  ---  |  ---  |  ---  |
|     Code Builder Users  |  5     |  10     |  15     |

**Note**: Additional Code Builder user licenses are available as a part of a scratch org add-on purchase. Each scratch org add-on gives you one Code Builder user license. See [Salesforce Add-on Pricing](https://www.salesforce.com/content/dam/web/en_us/www/documents/pricing/all-add-ons.pdf) for more information.

## Add Users

Add any team members who aren’t already users in the Code Builder org:

1. Log in to the Code Builder org.
2. From Setup, enter `Users` in the Quick Find box, then select **Users.**
3. Click **New User** or **Add Multiple Users**.
4. Select the appropriate license type and profile based on the user’s role.
5. Select the **Generate passwords and notify user via email** checkbox.
6. Click **Save**.

**Note**: This procedure generates an email inviting the new users into the org. But until you’re finished setting up Code Builder, there’s not much for them to do in the org. We recommend that you let your team know that you’re setting up Code Builder and to wait until they hear from you before logging in.

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
