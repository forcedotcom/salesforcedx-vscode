---
title: Source Format
---

The commands that Salesforce Extensions for VS Code uses to push, pull, deploy, and retrieve your source assume that your files are in source format (rather than metadata format). Source format is optimized for working with version control systems. For details, see [Salesforce DX Project Structure and Source Format](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_source_file_format.htm) in the _Salesforce DX Developer Guide_.

Because legacy tools such as, Force.com IDE used the metadata format, you can’t directly open your such projects in VS Code. You must either convert your metadata to source format (using `sfdx force:mdapi:convert`) or create a new project and then retrieve the metadata from your org using the manifest (`package.xml` file) that you used in your previous IDE.

## Convert Metadata to Source Format and Maintain Git History

If you have a Salesforce project that is in metadata format and tracked in Git, a bulk convert to the new source format loses all the revision history. This is because Git has built in limits and it fails to detect the enormous amount of changes that happen at the same time. The solution is to convert the project to source format in smaller chunks so that you can maintain the revision history. Let’s take the [dreamhouse](https://github.com/dreamhouseapp/dreamhouse-sfdx) project as example to follow the conversion steps.

Here is a snapshot of the code structure in metadata format in the `./metadata` folder.

```text
.
├── README.md
└─── metadata
├── objectTranslations
├── objects
│ ├── Bot_Command\_\_c.object
│ └── ...
├── package.xml
├── pages
├── pathAssistants
├── permissionsets
├── quickActions
├── remoteSiteSettings
├── reports
├── staticresources
│ ├── leaflet.resource
│ ├── leaflet.resource-meta.xml
│ └── ...
├── tabs
├── triggers
└── workflows
```

Follow these steps to convert the project from metadata to source format, without losing the Git history:

1. Create a temporary SFDX project outside of the Git repo. This temporary project has the structure and a configuration file as required by a Salesforce project.

   `$ sfdx force:project:create -n tempproj`

1. Convert the project in metadata into a temporary project.

   `$ sfdx force:mdapi:convert --rootdir ./project/metadata --outputdir ./tempproj`

   Now you have two copies of the project, one in the original location and the other in the new directory `temproj`, where the project files after converting them to the source format are stored.

1. Move the `sfdx-project.json` file and the `config` folder. The `sfdx-project.json` file identifies the directory as a Salesforce project.

   `$ mv ./tempproj/sfdx-project.json ./project/sfdx-project.json`

   `$ mv ./tempproj/confg ./project/config`

1. Commit these changes to the repo.

   `$ git add -A`

   `$ git commit -m "Created sfdx-project.json and config"`

1. Create the new folder structure as required by a Salesforce project.

   `$ mkdir ./project/force-app`

   `$ mkdir ./project/force-app/main`

   `$ mkdir ./project/force-app/main/default`

With the folder structure in place, you can now start converting the metadata format to source format.

## Convert Simple Metadata Types

If the metadata type is composed of one or two files (a source file and a metadata.xml file or only a single xml file), you can:

1. Copy the entire folder (for example, triggers) of the converted source from the temporary project to the appropriate new folder.

   `$ mv ./tempproj/force-app/main/default/triggers`
   `./project/force-app/main/default/triggers`

1. Delete the old metadata.

   `$ rm -rf ./project/metadata/triggers`

1. Commit your changes.

   `$ git add -A`

   `$ git commit -m "Converted triggers to source format"`

Repeat these steps to convert for all the files or folders that contain simple metadata format.

If the changes are not detected correctly, the metadata folder may have too many files. In such cases, setting rename detection limit for merge allows all renames in a single commit. Use the [merge.renameLimit](https://git-scm.com/docs/git-config/1.5.6.5#git-config-mergerenameLimit) variable to set this rename limit. Note that this option doesn’t work for custom objects.

These commands set the rename detection limit and convert to source format in a single commit.

```text
`$ git config merge.renameLimit 999999`

`$ sfdx force:mdapi:convert -r src -d src2`

`$ rm -rf src`

`$ mv src2 src`

`$ git add -A`

`$ git commit -m "Converted from metadata to source format"`

`$ git config --unset merge.renameLimit # Return the git config option to the default`
```

## Convert Metadata with Expanded Source

If the new format is of expanded source type where a single metadata item is split into multiple files (for example, Custom Objects), a good approach to convert:

1. Create the folder structure as required by a Salesforce project.

   `$ mkdir ./project/force-app/main/default/objects`

   `$ mkdir ./project/force-app/main/default/objects/MyObject__c`

1. Move the metadata format file to the source format location.

   `$ mv ./project/metadata/objects/MyObject__c.object /`
   `./project/force-app/main/default/objects/MyObject__c/MyObject__c.object-meta.xml`

1. Commit the change.

   `$ git add -A`

   `$ git commit -m "Moved MyObject to source format location"`

1. Move the source formatted files to the source format location and also overwrite the old metadata formatted version in that location.

   `$ mv -f ./tempproj/force-app/main/default/objects/MyObject__c/**/*.* ./project/force-app/main/default/objects/MyObject__c`

1. Commit the change.

   `$ git add -A`

   `$ git commit -m "Converted MyObject to source format"`

Repeat these steps to convert all the metadata items that are split into multiple files.
