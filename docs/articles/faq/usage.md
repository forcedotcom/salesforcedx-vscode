---
title: 'FAQ: Using the Extensions'
---

## How do I retrieve a single metadata type from an org?

Currently, there is not an easy way to do this. We are working on adding functionality that will allow you to select metadata from a list to pull from the server, but it is not available in the product today. Instead, you can create a `package.xml` file and use that to retrieve the metadata.

For example, if you want to pull a single custom field, create a manifest like this:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>OpportunityTeamMember.TeamMemberRole</members>
        <name>CustomField</name>
    </types>
    <version>37.0</version>
</Package>
```

Save the file to the `manifest` directory. You can then right-click the newly created `package.xml` file and select **SFDX: Retrieve from Org**. The metadata specified in the manifest file is pulled into the default folder.

For more information about manifest files [see the documentation](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/manifest_samples.htm).

Alternatively, you can run the command `sfdx force:source:retrieve --metadata ...` from a terminal. For example, you could run `sfdx force:source:retrieve --metadata CustomField:OpportunityTeamMember__c.TeamMemberRole__c`. For details, see the _[Salesforce CLI Command Reference](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference_force_source.htm)_.
