---
title: Migrate from Force.com IDE to Visual Studio Code
---

With the latest release of the Salesforce Extensions for Visual Studio Code, you can now develop against any org using the same workflows you are used to with the Force.com IDE. This article walks through two techniques for migrating your existing project from Force.com IDE to VS Code.

### Table of Contents

1. [Determining Which Migration Process to Use](#determining-which-migration-process-to-use)
1. [Migrate using Package.xml (easy)](#migrate-using-packagexml-easy)
1. [Migrate by Conversion (advanced)](#migrate-by-conversion-advanced)

> NOTICE: The features mentioned in this article are in beta. If you find any bugs or have feedback please open a GitHub issue.

## Why You Need to Migrate

Before you begin your migration it is important to understand the difference between the project structure of a Force.com IDE project and a VS Code project. There are several differences that you will need to handle.

### 1. Project File

Every Salesforce project in VS Code must include a `sfdx-project.json` file. This file specifies various project-level options such as which type of organization you are working against (production, sandbox, etc.) and where your source code is stored on the disk. You can read more about the details of the `sfdx-project.json` file in the [documentation](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_config.htm).

### 2. Source Format

Salesforce projects in VS Code use a new format and directory structure for storing metadata. This is called the [source format](Source-Format). This format does things like expand objects into multiple directories and files as well as allow you to work directly with static resources. However, this also means you cannot just open your existing project in VS Code and expect it to work. It will need to be converted to the new format.

## Determining Which Migration Process to Use

There are two ways you can perform your migration from Force.com IDE to VS Code. The first, and most simple, is to use your existing package.xml file and basically create a new project from scratch. This technique is recommended if the following conditions are true:

1. Your project is reasonably small - not thousands and thousands of files.
2. All of your code is already saved to your org.
3. You don't use version control (or don't mind losing your source history).

The second approach, which allows you to convert existing projects, is more complicated but can be used on larger projects and allows you to retain version control history.

## Migrate using Package.xml (easy)

If you already have a `package.xml` file in your Force.com IDE project, you can easily move that project to a new VS Code project in just a few steps. Before you begin, ensure you have your machine configured correctly for [Salesforce Development with VS Code](Computer-Setup)

1. Open VS Code and create a new project. To create a project, from the start screen of VS Code, type `Command+Shift+P` to bring up the command bar and start typing `SFDX: Create Project with Manifest` to search for the command. Click enter when you have selected the command.

   ![Create Project With Manifest](/images/create-project-with-manifest.png)

1. Select the location of your project and click `Create Project`.
1. Next, copy the contents of your existing `package.xml` file that you had used in the Force.com IDE project.
1. Inside of VS Code, open the `package.xml` file inside the `manifest` folder.
1. Replace the contents of the file with the contents you had copied from the Force.com IDE project.
1. Now that you have the `package.xml` moved over, you will need to authorize your org. Using the command pallet (`Command+Shift+P`) select the command `SFDX: Authorize an Org`. This will open the Salesforce login page. Login and accept the prompt.

   > NOTICE: If you want to connect to a sandbox org, edit your `sfdx-project.json` file to set `sfdcLoginUrl` to `https://test.salesforce.com` before you authorize the org.

1. Close the browser tab and return to VS Code.
1. Right-click inside of the `package.xml` file and click the command `SFDX: Retrieve This Source From Org`
1. The source will now be downloaded into the folder specified in the `sfdx-project.json` file. The default is `force-app/main/default`.

Your project is now migrated from Force.com IDE to VS Code. You can continue to work like normal using your new code editor. For more information about this process see the document on [Org Development Model](org-development-model).

## Migrate by Conversion (advanced)

The second option for migrating your project is to do an in-place convert. This option is a little more complex but will save you from having to download all of your metadata and it provides the option of preserving version control history. Before you begin, ensure you have your machine configured correctly for [Salesforce Development with VS Code](Computer-Setup)

1. To begin, let's assume our project is in the following format.

   ```text
   .
   ├── salesforce.schema
   └─── src
       ├── objectTranslations
       ├── objects
       │   ├── Bot_Command__c.object
       │   └── ...
       ├── pages
       ├── pathAssistants
       ├── permissionsets
       ├── quickActions
       ├── remoteSiteSettings
       ├── reports
       ├── staticresources
       ├── tabs
       ├── triggers
       └── package.xml
   ```

1. As a first step, you need to add several files that are required (or optional) in the new project format. The most important is the `sfdx-project.json`. The easiest way to create these files is to create a temporary project to copy them from. Run the following command to do so.

   ```bash
   $ sfdx force:project:create -n ../tempproj
   ```

1. Next, copy the following from the temp project into your project.

   ```bash
   $ mv ../tempproj/sfdx-project.json ./sfdx-project.json
   $ mv ../tempproj/config ./config
   ```

   > NOTICE: If you are using source control you will likely want to make commits at various steps along the way.

1. The default `sfdx-project.json` assumes your source code is in the `force-app` folder. You can use this, but in our case we are assuming `src`. You will need to change the following in the `sfdx-project.json`.

   ```
   {
    "packageDirectories": [
        {
            "path": "src",
            "default": true,
        }
    ],
   ```

1. Next, move your current source into a new folder.

   ```bash
   $ mv ./src ./src_old
   ```

1. Create a folder structure for the new source.

   ```bash
   $ mkdir ./src
   $ mkdir ./src/main
   $ mkdir ./src/main/default
   ```

1. Now you have your project setup it is time to convert the metadata to the new [source format](Source-Format). To convert, run the following command.


    ```bash
    $ sfdx force:mdapi:convert --rootdir ./src --outputdir ./tmpsrc
    ```

1. With the source in the new format and the folder structure set up, you can copy the new metadata into the correct place.

   ```bash
   $ mv ./tmpsrc ./src/main/default
   ```

1. Finally, delete the old source.

   ```bash
   $ rm -rf ./tmpsrc
   ```

### Version Control Considerations

One thing worth noting when you are converting your metadata to the new format is that your version control system may require some configuration or scripting in order to follow the massing renames. Git, for will only track a small number of file renames at once by default. In order to fix this, change the following setting.

```bash
$ git config merge.renameLimit 999999
```

When you are done with your rename and have everything committed you can restore git to the default config.

```bash
$ git config --unset merge.renameLimit
```

Additionally, you may even have to do the moving/renaming in chunks. For more information see [this blog post](https://ntotten.com/2018/05/11/convert-metadata-to-source-format-while-maintain-git-history/).
