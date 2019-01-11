---
title: 'FAQ: Using the Extensions'
---

## How do I retrieve a single metadata object from an org?

Currently, there is not an easy way to do this. We are working on adding functionality that will allow you to select metadata from a list to pull from the server, but it is not available in the product today. The workaround at this time is to create a new pacakge.xml file and use that to retrieve the metadata.

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

Save the file to the `manifest` directory. You can then right click on the newly created file and select the command "SFDX: Retrieve from Org". The metadata specified in the manifest file will be pulled into the default folder.

For more information on manifest files [see the documentation](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/manifest_samples.htm).
