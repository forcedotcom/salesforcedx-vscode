---
title: Custom Code Templates
lang: en
---

## Overview
Want your own code to appear in source files when you create a metadata object such as an Apex class? You can now use custom templates to do just that.

Templates are essentially folders with files that contain your custom code. This [git repo](https://github.com/forcedotcom/salesforcedx-templates/tree/main/src/templates) contains a collection of official Salesforce templates for metadata components. Simply clone this repo, keeping the same folder structure, then update relevant template files with your code. Remove the files that you don’t wish to override.

**Note:** Only updates made to the files listed here show up in source files in VS Code. There’s no such restriction when you use the CLI to specify templates for metadata objects.

| Template Folder        | Default Template Files           |
| ------------- |:-------------:|
| apexclass     | DefaultApexClass.cls <br>_class.cls-meta.xml
|apextrigger    | ApexTrigger.trigger <br> _trigger.trigger-meta.xml
|Lightningapp   |DefaultLightningApp.app <br> DefaultLightningController.js <br> DefaultLightningCss.css <br> DefaultLightningHelper.js <br> DefaultLightningRenderer.js <br> DefaultLightningSVG.svg <br> DefaultLightningAuradoc.auradoc <br>auradefinitionbundle.app-meta.xml
|Lightningcomponent |aura/default/default.cmp <br> aura/default/default.cmp-meta.xml <br> aura/default/defaultController.js <br> aura/default/defaultHelper.js <br> aura/default/defaultRenderer.js <br> aura/default/default.svg <br> aura/default/default.design <br> aura/default/default.css <br> aura/default/default.auradoc <br> lwc/default/default.js<br> lwc/default/default.html <br> lwc/default/default.js-meta.xml |
|Lightningevent | defaultLightningEvt.evt <br> auradefinitionbundle.evt-meta.xml
|Lightninginterface | DefaultLightningIntf.intf <br> auradefinitionbundle.intf-meta.xml
|Lightningtest | DefaultLightningTest.resource
|Project | Any file in the project folder
|Staticresource | empty.resource <br> empty.js <br> empty.json <br> empty.css <br> empty.txt <br> _staticresource.resource-meta.xml
|visualforcecomponent| DefaultVFComponent.component <br> _component.component-meta.xml
|visualforcepage | DefaultVFPage.page <br> _page.page-meta.xml

## Clone the Repo
See GitHub documentation for instructions on how to clone repos.

## Set Default Template Location
1. Open the `sfdx-config.json` config file in your `<project-folder>/.sfdx` folder
2. Add the parameter `customOrgMetadataTemplates` and set its value to the templates folder in your cloned repo. For example:
```
{
  "customOrgMetadataTemplates": "https://github.com/mygitrepo/salesforcedx-templates/tree/main/packages/templates/src/templates"
}
```

or the location of a local copy:

```
{
  ""customOrgMetadataTemplates": "/Users/mydrive/github/devtools/salesforcedx-templates/packages/templates/src/templates"
}
```

**Note:** You can also use the CLI to set this parameter. See [CLI Runtime Configuration Values](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_dev_cli_config_values.htm) for more information.

## Create a Apex Class with Custom Code
1. Clone the sample GitHub repo.
2. Delete all folders except the `apexclass` folder. Also delete all the files except the `DefaultApexClass.cls` file from the `apexclass` folder.
3. Edit the `DefaultApexClass.cls` file with your custom code:

```
public with sharing class <%= apiName %> {
    		public <%= apiName %>(String prop) {
			this.prop = prop;
    		}

		@AuraEnabled public String prop { get;set; }
	}
``` 
**Note:** If you edit the file locally, remember to push changes to your repo. You can also choose to make changes directly in your repo. 

4. Update the `sfdx-config.json` file to point to your cloned repo (or local directory).
5. Run the `SFDX: Create Apex Class` command from the Command Palette.
6. Enter `ApexClass` for filename.
7. Accept the default directory location.
8. Confirm that the `ApexClass.cls` file contains your custom code:
```
public with sharing class ApexClass {
    		public ApexClass(String prop) {
			this.prop = prop;
    		}

		@AuraEnabled public String prop { get;set; }
	}
```
9. Share your config file with your teammates so that you’re all using the same config setting.  

## Make an Update to a Template
VS Code downloads the template files locally (`~/.sfdx/custom-templates` on macOS/Linux or `%USERPROFILE%\.sfdx\custom-templates` on Windows) the first time the template repository is accessed. To use updated templates, clear the local cached files to download the template files again.
