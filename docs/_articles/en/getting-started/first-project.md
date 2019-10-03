---
title: Create Your First Project
lang: en
---

This guide helps Salesforce developers who are new to Visual Studio Code go from zero to a deployed app using Salesforce Extensions for VS Code.

## Part 1: Creating a Project

There are two types of developer processes or models supported in Salesforce Extensions for VS Code. These models are explained below. Each model offers pros and cons and is fully supported.

### Org Development Model

The org development model allows you to connect directly to your sandbox, Developer Edition (DE) org, Trailhead Playground, or even a production org to retrieve and deploy code directly. This model is similar to the type of development you have done in the past using tools such as Force.com IDE or MavensMate.

To start developing with this model, see [Org Development Model with VS Code](../user-guide/org-development-model).

If you are developing against non-source-tracked orgs (sandboxes, DE orgs, or Trailhead Playgrounds), use the command `SFDX: Create Project with Manifest` to create your project. If you used another command, you might want to start over with that command.

When working with non-source-tracked orgs, use the commands `SFDX: Deploy Source to Org` and `SFDX: Retrieve Source from Org`. The `Push` and `Pull` commands work only on orgs with source tracking (scratch orgs).

### Package Development Model

The second supported model is called the package development model. This model allows you to create self-contained applications or libraries that are deployed to your org as a single package. These packages are typically developed against source-tracked orgs called scratch orgs. This development model is geared toward a more modern type of software development process that uses org source tracking, source control, and continuous integration and deployment.

If you are starting a new project, we recommend that you consider the package development model. To start developing with this model, see [Package Development Model with VS Code](../user-guide/package-development-model).

If you are developing against scratch orgs, use the command `SFDX: Create Project` to create your project. If you used another command, you might want to start over with that command.

When working with source-tracked orgs, use the commands `SFDX: Push Source to Org` and `SFDX: Pull Source from Org`. Do not use the `Retrieve` and `Deploy` commands with scratch orgs.

## The `sfdx-project.json` File

The `sfdx-project.json` file contains useful configuration information for your project. See [Salesforce DX Project Configuration](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_config.htm) in the _Salesforce DX Developer Guide_ for details about this file.

The most important parts of this file for getting started are the `sfdcLoginUrl` and `packageDirectories` properties.

The `sfdcLoginUrl` specifies the default login URL to use when authorizing an org.

The `packageDirectories` filepath tells VS Code and Salesforce CLI where the metadata files for your project are stored. You need at least one package directory set in your file. The default setting is shown below. If you set the value of the `packageDirectories` property called `path` to `force-app`, by default your metadata goes in the `force-app` directory. If you want to change that directory to something like `src`, simply change the `path` value and make sure the directory you’re pointing to exists.

```json
"packageDirectories" : [
    {
      "path": "force-app",
      "default": true
    }
]
```

## Part 2: Working with Source

For details about developing against scratch orgs, see [Package Development Model with VS Code](../user-guide/package-development-model).

For details about developing against orgs that don’t have source tracking, see [Org Development Model with VS Code](../user-guide/org-development-model).

## Part 3: Deploying to Production

Don’t deploy your code to production directly from Visual Studio Code. The deploy and retrieve commands do not support transactional operations, which means that a deployment can fail in a partial state. Also, the deploy and retrieve commands don’t run the tests needed for production deployments. Deploy your changes to production using [packaging](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_dev2gp.htm) or by [converting your source](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference_force_source.htm#cli_reference_convert) into metadata format and using the [metadata deploy command](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference_force_mdapi.htm#cli_reference_deploy).
