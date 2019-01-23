---
title: Create Your First Project
---

This guide helps Salesforce developers who are new to Visual Studio Code go from zero to a deployed app using Salesforce Extensions for VS Code.

## Part 1: Creating a Project

There are two types of developer processes or models supported in Salesforce Extensions for VS Code. These models are explained below. Each model offers pros and cons and is fully supported.

### Org Development Model

The first supported model is the model most developers are already familiar with today: Org Development Model. This model allows you to connect directly to your sandbox, Developer Edition (DE) org, Trailhead Playground, or even a production org to retrieve and deploy code directly. This is the type of development you have done in the past using tools such as Force.com IDE or MavensMate.

To start developing with this model, see [Org Development Model with VS Code](../user-guide/org-development-model).

If you are developing against non-source-tracked orgs (sandboxes, DE orgs, or Trailhead Playgrounds), you should use the command `SFDX: Create Project with Manifest` to create your project. If you used another command, you might want to start over with that command.

When working non-source-tracked orgs, use the commands `SFDX: Deploy Source to Org` and `SFDX: Retrieve Source from Org`. The `Push` and `Pull` commands work only on orgs with source tracking (scratch orgs).

### Package Development Model

The second supported model is called Package Development Model. This model allows you to create self-contained applications or libraries that are deployed to your org as a single package. These packages are typically developed against source-tracked orgs called scratch orgs. This model of development is geared toward a more modern type of software development process that uses org source tracking, source control, and continuous integration/deployment.

If you are starting a new project, we recommend that you consider the Package Development Model.

If you are developing against scratch orgs, you should use the command `SFDX: Create Project` to create your project. If you used another command, you might want to start over with that command.

When working source-tracked orgs, use the commands `SFDX: Push Source to Org` and `SFDX: Pull Source from Org`. Do not use the `Retrieve` and `Deploy` commands with scratch orgs.

### The `sfdx-project.json` File

The `sfdx-project.json` file contains useful configuration information for your project. See [Salesforce DX Project Configuration](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_config.htm) in the _Salesforce DX Developer Guide_ for details about this file.

The most important aspects of this file for getting started are the `packageDirectories` and `sfdcLoginUrl` settings.

The `sfdcLoginUrl` is used to specify which login URL to use when authorizing an org. For details, see [Authorize an Org](#authorize-an-org).

The `packageDirectories` file tells VS Code and Salesforce CLI where metadata files are stored. You need at least one package directory set in your file. The default setting is shown below. If you set the value of the `packageDirectories` property called `path` to `force-app`, by default your metadata will go in the `force-app` directory. If you want to change that directory to something like `src`, simply change the `path` value and make sure the directory you’re pointing to exists.

```json
"packageDirectories" : [
    {
      "path": "force-app",
      "default": true
    }
]
```

## Part 2: Working with Source

### Authorize an Org

After you set up your project, authorize an org to work against. You can authorize any type of org with the Visual Studio Code extensions.

> If you usually want to connect to sandbox orgs, edit your `sfdx-project.json` file to set `sfdcLoginUrl` to `https://test.salesforce.com` before you authorize an org.

To start the authorization process, open the command palette (press Ctrl+Shift+P on Windows or Linux, or Cmd+Shift+P on macOS) and then run the command `SFDX: Authorize an Org`.

![Authorize an Org](https://github.com/forcedotcom/salesforcedx-vscode/wiki/images/authorize-org-command.png)

Choose a login URL and give your org an alias. You will then be shown the Salesforce login page. Enter your credentials, then click **Allow** to authorize VS Code.

### Deploy and Retrieve Source Using a Manifest (`package.xml`) File

> NOTE: This section applies only when working with non-source-tracked orgs: sandboxes, DE orgs, or Trailhead Playgrounds. For information about working with scratch orgs, see [Working with Source-Tracked Orgs](#working-with-source-tracked-orgs).

If you are connected to a sandbox, DE org, or Trailhead Playground, the easiest way to retrieve all the metadata you want to work with from your org is by using a `package.xml` file. If you don’t already have one, create a `package.xml` file in the `manifests` directory.

Add the various metadata types you want to retrieve to this file. For information about the `package.xml` file, see in [Sample package.xml Manifest Files](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/manifest_samples.htm) in the _Metadata API Developer Guide_.

After you set up your `package.xml` file, right-click the file (either in the file tree or inside the contents of the file) and select `SFDX: Retrieve Source from Org`. This will download your metadata from the org and place it in the location specified in the `sfdx-project.json` file.

After you retrieve your metadata, your project structure will look something like this.

```text
my-app
├── README.md
├── sfdx-project.json
├── .sfdx
├── .vscode
│   ├── extensions.json
│   └── settings.json
├── force-app
|   └── main
|       └── default
|           ├── aura
|           ├── classes
|           └── objects
└── manifests
    └── package.xml
```

Similarly, you can deploy source by right-clicking the `manifest.xml` file (in the file tree or on its contents) and selecting the command `SFDX: Deploy Source to Org`.

### Retrieving or Deploying Individual Files or Folders

> NOTE: This section applies only when working with non-source-tracked orgs: sandboxes, DE orgs, or Trailhead Playgrounds. For information about working with scratch orgs, see [Working with Source-Tracked Orgs](#working-with-source-tracked-orgs).

When you don’t want to retrieve or deploy all the metadata listed in your `package.xml` file, you can deploy or retrieve individual folders or files. To deploy a file or the contents of a directory, right-click the file or directory (in the file tree or in the editor) and select `SFDX: Retrieve Source from Org` or `SFDX: Deploy Source to Org`.

> IMPORTANT: The retrieval or deployment will occur only on metadata that’s nested (in the file tree) under the item you select. For example, if you right-click the `classes` folder, all Apex classes that **currently exist in that directory** will be retrieved or deployed. Running a retrieve operation on a directory like `classes` will **NOT** retrieve all Apex classes on the org; it will retrieve updates only to classes that already exist in the folder. If you want to retrieve a new Apex class, you will need to add that class (or all Apex classes) to a `package.xml` file and retrieve your source using the manifest file. (Or, you can use a terminal to run `sfdx force:source:retrieve --metadata ApexClass:YourApexClass`.)

![Deploy Source to Org](https://github.com/forcedotcom/salesforcedx-vscode/wiki/images/deploy-source-to-org.png)

### Working with Source-Tracked Orgs

Scratch orgs support a feature called source tracking. This means that VS Code will only push and pull metadata to or from the org if the metadata has changed. You don’t need to run deploy or retrieve operations on individual files or folders, or even use a `package.xml` file. Just run `SFDX: Pull Source from Org` or `SFDX: Push Source to Org`, and any changed metadata files will be pulled or pushed.

## Part 3: Deploying to Production

You should not deploy your code to production directly from Visual Studio Code. The deploy and retrieve commands do not support transactional operations. This means that a deployment can fail in a partial state. Deployments should be done using [packaging](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_dev2gp.htm) or by [converting your source](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference_force_source.htm#cli_reference_convert) into metadata format and using the [metadata deploy command](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference_force_mdapi.htm#cli_reference_deploy).
