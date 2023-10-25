---
title: Einstein for Developers Setup
lang: en
---

## Set Up Overview

A Salesforce admin or user with the appropriate permissions can enable Einstein for Developers in a supported Salesforce org. A developer with access to the org can then:

1.  Install the extension in VS Code.
2.  Connect to an org with Einstein for Developers enabled.
3.  Use the extension to generate Apex code from natural language instructions.

### Required Editions

**Available in**: Developer, Enterprise, Partner Developer, Performance and Unlimited Editions.

**Inoperable in**: Group, Professional, and Essentials Editions

**Not Available in**: EU Operating Zone. EU Operating zone is a special paid offering that provides an enhanced level of data residency commitment. Code Builder is supported in orgs in the EU that aren’t part of EU OZ, per standard product terms and conditions.

### Required User Permissions

To configure Einstein for Developers (beta): Customize Application AND Modify All Data

### Enhanced Domain Enabled

Your Einstein for Developers org must have Enhanced Domain enabled. See [Enable Enhanced Domains](https://help.salesforce.com/s/articleView?id=sf.domain_name_enhanced_enable.htm&type=5) for more information.

## Enable Einstein for Developers

When you enable Einstein for Developers in a supported Salesforce org, all users in the org have access to the feature.

1. From Setup, in the Quick Find box, enter `Einstein for Developers`, and then select **Einstein for Developers**.

**Tip:** If you don’t see Einstein for Developers as an option under Setup in your Developer Edition org, the org was probably created before Einstein for Developers was introduced, so it doesn’t have the correct permissions. Create another Developer Edition org and then retry this step.

2. Turn on Einstein for Developers.

![Einstein Terms and Toggle](./images/einstein-terms.png)

**Important**: We encourage you to thoroughly review the license agreement and review all terms and conditions. Then accept to enable Einstein for Developers.

Einstein for Developers is activated in the org.

### Add Users to the Org

An admin can add additional users to the org as needed:

1. From Setup, in the Quick Find box, enter `Users`, and then select **Users**.
2. Click **New User** or **Add Multiple Users**.
3. Select the appropriate license type and profile based on the user’s role.
4. Select **Generate passwords and notify user via email**.
5. Click **Save**.
   This procedure generates an email inviting the new users into the org.

### Visual Studio Code Version

VS Code releases a new version each month with new features and important bug fixes. You must be on VS Code Version 1.76 or higher to run the Einstein for Developers extension. You can manually check for updates from **Help** **> Check for Updates** on Linux and Windows or **Code > Check for Updates** on macOS.

## Install Einstein for Developers Extensions

Install Einstein for Developers:

- If you’re using VS Code on your desktop, install [Einstein for Developers](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-einstein-gpt) from the Visual Studio Code marketplace.

- If you are using Code Builder, click the Extensions icon in the Activity Bar in Code Builder, search for “Einstein for Developers” and click **Install**.

**Note**: To use Einstein for Developers locally, you must have the [Salesforce Extensions pack]() installed in your VS Code for desktop application. See [Install Salesforce Extensions](https://developer.salesforce.com/tools/vscode/en/vscode-desktop/install) for more information.

## Connect to an Org

The Einstein for Developers tool is run in the context of a Salesforce org, in a Salesforce DX project. To use this tool:

1. Go to **File** > **Open Folder** in the menu and open an existing Salesforce DX project in VS Code, or create one.

2. Run the **SFDX: Authorize an Org** command to connect to the Salesforce sandbox org or scratch org that has Einstein for Developers enabled. Pick default options to connect to your org.

The Einstein logo on the activity bar and in the status bar confirms that the extension is installed. Open the command palette and run `View: Show Einstein Developer Sidebar` to open the sidebar.

![einstein installed](./images/einstein-installed.png)

### Use Einstein for Developers in a Scratch Org

Einstein for Developers is only available in scratch org editions that can author Apex:

- Developer Edition
- Enterprise Edition

To use Einstein for Developers in a scratch org:

1. Enable Einstein for Developers in the Dev Hub.
2. Use the `SFDX: Authorize a Dev Hub` command to log into the Dev Hub.
3. Activate Einstein for Developers by turning on the `EinsteinGPTForDevelopers` scratch org feature:

Edit the `config/project-scratch-def.json` file in your DX project and add the “`EinsteinGPTForDevelopers`” feature to your existing feature list and save your changes. For example:

```
   {
   "orgName": "Acme Company",
   "edition": "Developer",
   "features":["Communities", "ServiceCloud", "EinsteinGPTForDevelopers"]
   }
```

Create a scratch org using the `SFDX: Create a Default Scratch Org...` command referencing the scratch org definition that you previously updated.

## Show Einstein Feedback Console View

Run **Einstein: Show Prompt History** from the Command Palette to open the Feedback console. When opened, you can view a running history of your prompts and associated responses. Use 👍, 👎, and comments for each response to provide us with feedback about the quality of the generated code. Your feedback during this beta is key to helping us improve AI model quality and overall product.

![feedback panel](./images/einstein-feedback.png)
