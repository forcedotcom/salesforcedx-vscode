---
title: Quick Start LWC Development
lang: en
---

## Overview

Create an LWC component called `contactList` that displays contact names and phone numbers in your app. You’ll get the contact information to display from an Apex class called `ContactController`.

Before you start, install [Salesforce Extensions for Desktop](./en/vscode-desktop/install) or [Set Up Code Builder](./en/codebuilder/cb-setup)

### Add an Apex Class that Queries Contacts

1. In VS Code, run the command **SFDX: Create Project** from the Command Palette to create a Salesforce DX project if you don’t have one.
2. Log in to the org to which you want to add the LWC.
3. Run the **SFDX: Refresh SObject Definitions** command from the Command Palette to get completion suggestions for your SObjects related code.
4. From the Command Palette, run **SFDX: Create Apex Class** and create a class called `ContactController`.

Next let's add a method called `getContacts` to this class. Make this method both public and static. Because it’s a static method, you don't need to create an instance of the class to access the method—you can just use the name of the class followed by a dot (`.`) and the name of the method. This method queries a set of fields on the contact object. Paste this code into `ContactController.cls`:

```
public with sharing class ContactController {
    @AuraEnabled(cacheable=true)
    public static List<Contact> getContacts() {
        return [
SELECT
Id,
Name,
Email,
Phone
FROM Contact
WITH SECURITY_ENFORCED
LIMIT 10
];
    }
}

```

Next, add the LWC component that displays queried fields.

### Create an LWC Component that Displays Contact Information

1. From the Command Palette, run **SFDX: Create Lightning Web Component** and create a component called `contactList` in the default location.
2. In the `contactList.html` file, cut and paste the following code, then save the file:

```
<template>
    <lightning-card title="Contact List">
        <template if:true={contacts.data}>
            <template for:each={contacts.data} for:item="contact">
                <div class="slds-var-p-horizontal_medium" key={contact.Id}>
                    <p>{contact.Name}, {contact.Phone}</p>
                </div>
            </template>
        </template>
        <template if:true={contacts.error}>
            <p>{contacts.error}</p>
        </template>
    </lightning-card>
</template>

```

3. In the `contactList.js` file, cut and paste this code and save:

```
import { LightningElement, wire } from 'lwc';
import getContacts from '@salesforce/apex/ContactController.getContacts';

export default class ContactList extends LightningElement {
    @wire(getContacts) contacts;
}
```

4. Cut and paste the following code in the `contactList.js-meta.xml` file and save:

```
<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
 	<apiVersion>57.0</apiVersion>
 	<isExposed>true</isExposed>
 	<targets>

   		<target>lightning__HomePage</target>
 	</targets>
</LightningComponentBundle>

```

5. Right-click the default folder under `force-app/main` and run **SFDX: Deploy Source to Org** to deploy your code to the org.

### Add the New Component to Your App in Lightning Experience

1. In Visual Studio Code, open the Command Palette and run **SFDX: Open Default Org**.
   This opens your org in a separate browser.
2. Open **Setup** through the **Setup** gear
3. Navigate to Feature Settings > Home and deactivate **Advanced Seller Home**
5. From the **App Launcher** find and select **Sales**.
6. Click **Setup** gear then select **Edit Page**.
7. Drag the `contactList` Lightning web component from the Custom area of the Lightning Components list to the top of the Page Canvas.
8. Click **Save**.
9. Click **Activate**.
10. Click **Assign as Org Default**.
11. Click **Save**.
12. Click **Save** again, then click **Back** arrow to return to the page.
13. Refresh the page to view your new component.

![PNG showing LWC component](./images/contact_lwc.png)
