---
title: Migrate from Force.com IDE to Salesforce Extensions for VS Code
lang: en
---

You can develop against any org using the same workflows you are accustomed to using with Force.com IDE. This article walks through two techniques for migrating your existing project from Force.com IDE to VS Code.

## Why You Need to Migrate

Before you begin your migration, it’s important to understand the difference between the project structure of a Force.com IDE project and a VS Code project. There are two primary differences that affect you: the Salesforce DX project file and the format of your local source.

### 1. Project File

Every Salesforce project in VS Code must include a `sfdx-project.json` file. This file specifies various project-level options, such as which type of org you are working against (production, sandbox, etc.) and where your source code is stored on your local workstation. For information about the `sfdx-project.json` file, see [Salesforce DX Project Configuration](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_config.htm) in the _Salesforce DX Developer Guide_.

### 2. Source Format

Salesforce projects use a new format and directory structure for local metadata called [source format](./en/user-guide/source-format). This format is optimized for working with version control. It has characteristics such as objects that are expanded into multiple directories and files, and the ability to work directly with static resources. However, this also means you can’t just open your existing project in VS Code and expect it to work. You need to convert it to the new format.

## Decide Which Migration Process to Use

There are two ways you can perform your migration from Force.com IDE to VS Code. The first, and most simple, is to use your existing `package.xml` file and create a new project from scratch. This technique is recommended if the following conditions are true:

1. Your project is reasonably small (not thousands and thousands of files).
2. All of your code is already saved to your org.
3. You don’t use version control (or don't mind losing your source history).

The second approach, which allows you to convert existing projects, is more complicated. But it can be used on larger projects and allows you to retain version control history.

## Migrate Using a Manifest (`package.xml`) File (easy)

If you already have a `package.xml` file in your Force.com IDE project, you can easily move that project to a new VS Code project in just a few steps. Before you begin, ensure that you have your machine configured correctly for [Salesforce Development with VS Code](./en/getting-started/install).

1. Open VS Code and create a project. From the start screen of VS Code, press Ctrl+Shift+P (Windows or Linux) or Cmd+Shift+P (macOS) to bring up the command palette. To search for the project-creation command, start typing `SFDX: Create Project with Manifest`. Press Enter when you’ve selected the command.

   ![Create Project With Manifest](./images/create-project-with-manifest.png)

1. Select the location of your project and click `Create Project`.
1. Next, copy the contents of the `package.xml` file that you used in your Force.com IDE project.
1. In VS Code, expand the `manifest` directory and open the `package.xml` file.
1. Replace the contents of the `package.xml` file with the contents you copied from the Force.com IDE project’s file.
1. Next, authorize your org. Using the command palette (Ctrl+Shift+P on Windows or Linux, or Cmd+Shift+P on macOS), select the command **SFDX: Authorize an Org**. This command opens the Salesforce login page. Log in and accept the prompt.

   > NOTICE: If you typically connect to sandbox orgs, edit your `sfdx-project.json` file to set `sfdcLoginUrl` to `https://test.salesforce.com` before you authorize the org.

1. Close the browser tab and return to VS Code.
1. In the VS Code editor, right-click inside the `package.xml` file and select **SFDX: Retrieve Source in Manifest from Org**.
1. The source downloads into the directory specified in the `sfdx-project.json` file. The default is `force-app/main/default`.

Your project is now migrated from Force.com IDE to VS Code. You can continue to work as normal using your new code editor. For more information about this process, see [Org Development Model](./en/user-guide/org-development-model).

## Migrate by Conversion (advanced)

The second option for migrating your project is an in-place conversion. This option is a bit more complex, but it doesn’t require you to download all your metadata and it provides the option of preserving version control history. Before you begin, ensure you have your machine configured correctly for [Salesforce Development with VS Code](./en/getting-started/install)

1. To begin, let’s assume your project is in the following format.

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

1. As a first step, you need to add several files (some required, some optional) to support the new project format. The most important is the `sfdx-project.json`. The easiest way to create these files is to create a temporary project to copy them from. Run the following command to do so.

   ```bash
   $ sfdx force:project:create -n ../tempproj --template standard
   ```

1. Next, copy the following from the temp project into your project.

   ```bash
   $ mv ../tempproj/sfdx-project.json ./sfdx-project.json
   $ mv ../tempproj/config ./config
   ```

   > NOTICE: If you are using source control, you’ll likely want to make commits at various steps along the way.

1. The default `sfdx-project.json` file assumes that your source code is in the `force-app` directory. You can use this default option, but in our case the source files live in `src`. To store your files in the `src` directory, change the following in the `sfdx-project.json`.

   ```json
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

1. Now that you’ve set up your project, it’s time to convert your metadata to [source format](./en/user-guide/source-format). To convert, run the following command.


    ```bash
    $ sfdx force:mdapi:convert --rootdir ./src_old --outputdir ./src
    ```

1. Finally, delete the old source.

   ```bash
   $ rm -rf ./src_old
   ```

1. Your metadata is now in the source format.

### Version Control Considerations

One thing worth noting when you are converting your metadata to source format is that your version control system might require some configuration or scripting to follow the mass renames. Git, for example, tracks only a small number of file renames at a time by default. To fix this, change the following setting.

```bash
$ git config merge.renameLimit 999999
```

When you are done with your rename and have everything committed, you can restore Git to the default config.

```bash
$ git config --unset merge.renameLimit
```

Additionally, you can do the moving or renaming in chunks. For more information, see [this blog post](https://ntotten.com/2018/05/11/convert-metadata-to-source-format-while-maintain-git-history/).
