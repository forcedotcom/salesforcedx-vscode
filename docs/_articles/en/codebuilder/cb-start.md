---
title: Get Started with Code Builder
lang: en
---

## Overview

Complete this Quick Start to become familiar with the Code Builder interface and perform some simple tasks in your Code Builder environment. Before you start, see [Code Builder Overview](./en/codebuilder/about) for more information and important considerations.

### Don’t Forget to Save Your Work

Working in the cloud has its advantages. However, unlike working on a desktop where you save your files to a local machine, you must either deploy your changes to your org or commit them to source control to save your work somewhere permanent. Work saved in your Code Builder environment will be there when you return, but Code Builder is not suited for permanent-long-term storage. We recommend saving your work before you close the Code Builder tab.

**Note**:  We may delete your Code Builder environment if its been inactive for longer than 60 days. 

## Create Your Code Builder Environment

1. From the App Launcher, find and open **Code Builder Dashboard**.

**Note:** If you don't see Code Builder Dashboard as an option, contact your admin to make sure you have the correct license and permission set assigned to you.

2. Click **Launch** to launch your Code Builder environment. A new environment is created for you the first time to launch. We've also created an empty Salesforce DX project to help you get started. Note that it takes a few minutes for a new environment to be created and loaded. You know everything is ready when you see “Welcome to Salesforce Code Builder”.

![Code Builder Dashboard](./images/cb_dashboard.png)

**Tip**: Once you have created your Code Builder environment, launch it from the dashboard at any time, or bookmark it for fast access.

**Note**: The `.bashrc`,`.profile` and `.bash_logout` files are overwritten every time you launch your Code Builder enviroment. We recommend that you do not edit these files because your changes will be lost. Create new `.bashrc.local`,`.profile.local` and `.bash_logout.local` files to store your Dotfile customizations.

## Connect to a Salesforce Org

Next, connect an org to your Code Builder environment. During the course of development, you'll use different types of orgs for different stages. For example, it's common to use a Developer sandbox or Developer Edition org during the development phase, and move to other sandbox types for integration, testing, and staging. Eventually, you'll deploy your changes to a production org. You can connect Code Builder to any of these orgs to deploy or retrieve metadata.

To connect to an org the first time you launch Code Builder:

1. In your Code Builder environment, click **Connect an Org** to connect to the Salesforce org you want to work in.
2. Enter the login URL or select the org you want to log into.
3. Enter an alias for the org, for example, dev_pro_sandbox or my_playground.
4. A code is displayed in a text box. Click **Connect**.
5. Log in with the relevant username and password. Click **Allow**.
6. Click **Continue**. You’re now connected to an org, and its name is visible in the status bar at the bottom in the Code Builder tab.

You can change the org you are connected to by clicking on the name of the current org to bring up the Command Palette and run **SFDX: Authorize an Org** again.

**Note**: After you authorize an org, we take care of future authorizations so you don't have to continually log in. Just click the org’s name and then choose the org from the list.

## Let's Take A Quick Tour

You’re now in your developer environment in Code Builder. Code Builder has a rich IDE and it gives you access to cool Salesforce-specific development tools through the expanded Salesforce Extension pack. Let’s take a quick tour and get to know the lay of the land. Your screen looks something like this:

![code_builder_ui](./images/code_builder_ga_ui_dark.jpg)

The Code Builder user interface is divided into five main areas.

**Activity Bar**: Located on the left-hand side, it contains iconic buttons to switch between different views. In our example, the Explorer view is active.

**Side Bar**: Contains different views to assist you while working on your project. For example, you can see the Explorer view in our example. It lists the files in DX project structure in your project.

**Editors**: The main areas to edit your files. You can open as many editors as you like side by side, vertically and horizontally.

**Panel**: Shows output or debug information, errors and warnings, or an integrated terminal. You can choose the output to display.

**Status Bar**: Shows information about the opened project and the files you’re editing. The Status Bar displays the org that you're connected to.

## Get To Know Your Org – Use the Org Browser

Take a closer look at the activity bar and notice a cloud icon. This icon represents the Org Browser. It’s a part of the Salesforce Extension pack. It helps you browse and retrieve metadata from your org without having to use a manifest file. Use Org Browser to retrieve the metadata source into your local project.

**More Information**: You can find more information about the [Org Browser](https://developer.salesforce.com/tools/vscode/en/user-guide/org-browser) in the Salesforce Extension Pack documentation.

![org_browser_small](./images/org_browser_small.jpg)

Click Org Browser and scroll down to **Custom Objects**. The first object you see is Account. You can view the metadata of the **Account** object (and do a few more cool things, but we’ll get to those in a bit).

## Use SOQL Builder to Build and Run your First Query

Code Builder comes preloaded with everything you need to build and run a SOQL query.
Let’s build and run a simple SOQL query on the Account object:

1. Press Ctrl+Shift+P (⇧⌘P) to view the Command Palette.
2. Type “SOQL” in the search box and then select **SFDX: Create Query in SOQL Builder**.
3. Select the following:

   a. **Account** Object in **From** field.

   b. **BillingState** and **NumberofEmployees** in **Fields**.

   c. Press **Run Query** to run this simple SOQL Query on your org.

You’re prompted to save your changes if you close the untitled file.

5. Save the changes to a file using a “.soql” extension.
6. Let’s rerun the saved query – Right-click the file and select **Open With…** then select SOQL Builder.
   The file opens in SOQL Builder and you can rerun or edit the query as you wish.

For more information on building complex queries see the [SOQL Builder](https://developer.salesforce.com/tools/vscode/en/soql/soql-builder) in the Salesforce Extensions for Visual Studio Code documentation.

## Create, Retrieve, and Deploy a Custom Field

Let’s add a custom field to an object in our org and pull its metadata into our Code Builder project.

First let’s add a custom field –

1. From **Setup**, go to **Object Manager** and select **Account**.
2. Click **Fields & Relationships**.
3. Click **New**.
4. For data type, select **Date**, then click **Next**.
5. Fill out the following:
   - Field Label: Created On
   - Field Name: createdon
   - Description: Date of Account Creation
6. Click **Next** until you save the field.

Now let’s retrieve metadata for this new field –

1. Return to Code Builder and open Org Browser.
2. Scroll down to **Custom Objects** and navigate to **Account**.
3. Click the retrieve icon next to the Account component to run **SFDX: Retrieve Source from Org**.
4. From the Activity Bar, click the Explorer and navigate to `force-app/main/default/object/Account`.

Lo and behold, in the `fields` folder, a file named `createdon_c.field-meta.xml` contains metadata for your new custom field!

The metadata is here for your reference:

```
<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
   <fullName>createdon__c</fullName>
   <description>Date of Account Creation</description>
   <externalId>false</externalId>
   <label>Created On</label>
   <required>false</required>
   <trackFeedHistory>false</trackFeedHistory>
   <type>Date</type>
</CustomField>
```

We’ll now make a simple edit to this field and deploy our changes back to our org with a single click.

1. Edit `createdon_c.field-meta.xml` and change the `<required>` tag value to `true` to indicate that this custom field is required.
2. Right-click the `objects/Account` folder and click **SFDX: Deploy Source to Org**.
3. After the command has successfully run, go back to your org and check the details of the **Created On** custom field and confirm that it’s now a required field.

## Create and Deploy a New Lightning Web Component

For another exercise in deploying, let’s learn how to quickly create a simple Lightning Web Component in our Code Builder project. We’ll then deploy this component to our org using a single command. Here we go:

Let’s create a Lightning Web Component –

1. Press Ctrl+Shift+P (⇧⌘P) run **SFDX: Create Lightning Web Component** to create a New Lightning Web Component.
2. Give the component a name, say, `newCBComponent`.
3. Press **Enter** to accept the default file location (`force-app/main/default/lwc`).
4. Press **Enter**.

Three new files are created in the `force-app/main/default/lwc/newCBComponent` folder.

Update the files –

In `newCBComponent.html`, copy and paste the following code:

```
<template>
    <p>Hello, {greeting}!</p>
    <lightning-input label="Name" value={greeting} onchange={handleChange}></lightning-input>
</template>
```

In `newCBComponent.js`, copy, and paste the following code:

```
import { LightningElement } from 'lwc';

export default class NewCBComponent extends LightningElement {
   greeting = 'Great going learning Code Builder!';
   changeHandler(event) {
       this.greeting = event.target.value;
   }
}

```

In `newCBComponent.js-meta.xml`, copy and paste the following code:

<!-- prettier-ignore -->
```html

<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
   <apiVersion>54.0</apiVersion>
   <isExposed>true</isExposed>
   <targets>
   <target>lightning__AppPage</target>
   <target>lightning__RecordPage</target>
   <target>lightning__HomePage</target>
 </targets>
</LightningComponentBundle>

```

Save all the files.

Let’s deploy this new component to our org –

Right-click the `force-app/main/default/lwc/newCBComponent` folder and click **SFDX: Deploy Source to Org**.

Your output window shows this message:

```

=== Deployed Source
STATE    FULL NAME       TYPE                      PROJECT PATH
───────  ──────────────  ────────────────────────  ────────────────────────────────────────────────────────────────────
Created  newCBComponent  LightningComponentBundle  force-app/main/default/lwc/newCBComponent/newCBComponent.html
Created  newCBComponent  LightningComponentBundle  force-app/main/default/lwc/newCBComponent/newCBComponent.js
Created  newCBComponent  LightningComponentBundle  force-app/main/default/lwc/newCBComponent/newCBComponent.js-meta.xml

10:22:27.340 ended SFDX: Deploy Source to Org

```

2. Select **SFDX: Open Default Org** to log into your org.
3. Navigate to **Setup:Lightning Components** to confirm that a new Lightning Web Component named `newCBComponent` is now available in your org.

Congratulations on successfully creating and deploying a new Lightning Web Component.

## To Learn More

You can take your time and use these resources to learn more about what you can do in Code Builder:

- [Visual Studio Code User Interface](https://code.visualstudio.com/docs/getstarted/userinterface) to get to know the Visual Studio code user interface.
- [Salesforce Extensions](https://developer.salesforce.com/tools/vscode) to learn about all the powerful features of the Salesforce Extension for VS Code.
