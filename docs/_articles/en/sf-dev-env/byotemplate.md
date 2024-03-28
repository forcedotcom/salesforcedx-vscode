---
title: Custom Code Templates
lang: en
---

## Overview
Use custom templates to quickly add your own code template to source files when you create a metadata object such as an Apex class in VS Code. Templates are files that contain your custom code. You can use custom templates to -
- Add default copyright information to new files in your project.
- Add default code to Aura or LWC to enable a new Apex class, and so on.

**Note**:
This [git repo subdirectory](https://github.com/forcedotcom/salesforcedx-templates/tree/main/src/templates) contains a collection of official Salesforce templates for metadata components. Only updates made to the files listed in this directory show up in source files in VS Code. You can clone this subdirectory, or replicate it locally. You must keep the same folder structure. Just update relevant template files with your code, and remove the files that you don’t wish to override.

## Set Default Template Location
 You can store template files in a local directory, or in a GitHub project. Set the ``org-custom-metadata-templates`` configuration variable to your custom template location:
1. Run ``sf config set org-custom-metadata-templates <GitHub repo or local template directory>`` command from the terminal inside VS Code. 
2. Run ``sf config list`` to confirm that the configuration setting is updated. 

**Note:** The `sfdx-config.json` config file in your `<project-folder>/.sfdx` folder is updated with a new entry in the format `` "customOrgMetadataTemplates": "<GitHub repo or local template directory>"``.

 See [CLI Runtime Configuration Variables](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_dev_cli_config_values.htm) for more information about configuration settings.

## Set Template Location Examples
-  ``sf config set org-custom-metadata-templates https://github.com/vscodeuser/salesforcedx-templates/tree/main/src/templates/`` sets the ``org-custom-metadata-templates`` configuration variable to a directory on user ``vscodeuser``'s GitHub repo.
-  ``sf config set org-custom-metadata-templates /Users/vscodeuser/CustomTemplateProject/MyCustomTemplates`` sets the ``org-custom-metadata-templates`` configuration variable to the ``MyCustomTemplates`` directory on a local machine.

## Use Custom Templates On GitHub
1. Clone this [git repo subdirectory](https://github.com/forcedotcom/salesforcedx-templates/tree/main/src/templates).
2. In your cloned repo, delete all folders except the folders that contains the templates you want to use. 
3. Make updates to the custom templates in your repo.
4. Check that ``org-custom-metadata-templates`` points to this repo.

## Use Local Custom Templates
The Salesforce Extensions require your templates to follow the exact folder structure and nomenclature as this repo. There’s no such restriction when you use the CLI to specify templates for metadata objects.

1. Create a folder in your VS Code project directory to hold your custom templates. Name the folder something intuitive, for example "MyCustomTemplates".
2. Carefully check folder and file names in this [git repo](https://github.com/forcedotcom/salesforcedx-templates/tree/main/src/templates), and create sub-folders of the same names that contain the files you wish to customize. For example, create a sub-folder named ``lightningapp`` and add a file named ``DefaultLightningController.js`` to customize the default lightning controller JavaScript file, and a sub-folder named ``apexclass`` and add a file named ``DefaultApexClass.cls`` to add custom code to an Apex class. 
3. Make updates to your custom template files.
4. Check that ``org-custom-metadata-templates `` points to your custom templates directory.

## Make an Update to a Remote Template in GitHub
VS Code downloads the template files locally (`~/.sfdx/custom-templates` on macOS/Linux or `%USERPROFILE%\.sfdx\custom-templates` on Windows) the first time the template repository is accessed. To use updated templates, clear the local cached files to download the template files again.

## Make an Update to a Local Template
If your template location is on your machine, any changes that you make to the template are ready for use immediately after save. If you're not seeing an immediate change, refresh your VS Code window to clear the VS Code cache to then see the changes reflected.
