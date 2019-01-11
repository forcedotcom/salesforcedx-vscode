---
title: Org Development Model with VS Code
---

The latest release of the Salesforce Extensions for VS Code and the Salesforce CLI added an open beta of basic support for developing against non-scratch orgs. This means you can now use VS Code with your `package.xml` file against Scratch Orgs, Developer Edition Orgs, etc.

![Demo](/images/changeset-demo.gif)

## Getting Started

First, Open VS Code and create a project. To create a project with a manifest run the command `SFDX: Create Project with Manifest`.

![Create project](/images/create-project-with-manifest.png)

> Alternatively you can use the CLI to create the project.

```
sfdx force:project:create --projectname myproject --manifest
cd mychangeset
code .
```

Next, you will need to authorize the org you will be working with.

If you want to connect to a sandbox org, edit your `sfdx-project.json` file to set `sfdcLoginUrl` to `https://test.salesforce.com` before you authorize the org.

To start the login process, run the command `SFDX: Authorize an Org`.

![Authorize an Org](/images/authorize-org-command.png)

Your browser will open and you can login to your Sandbox, Developer Edition, trial, etc. Once you have authenticated, you can close the browser and return to VS Code.

The new project you created came with a default manifest file located at `manifest/package.xml`. Right-click this file and select the command `SFDX: Retrieve Source from Org`

![Retrieve source from org](/images/retrieve-source-from-org.png)

After you make code changes, you can deploy these changes to your org by running the `SFDX: Deploy to Org` command on either:

1. A manifest file.
2. A folder
3. A file

![Deploy source to org](/images/deploy-source-to-org.png)

## Source Format

Note, that the format of the source code is in the new "source" format. This means that you cannot open your existing code from Force.com IDE in VS Code. You either need to convert your code to source format or create a new project and retrieve the code from your org using your existing manifest (`package.xml`) file.

For information on converting to source format and maintaining git history see [this blog post](https://ntotten.com/2018/05/11/convert-metadata-to-source-format-while-maintain-git-history/).

## Bugs and Feedback

To report issues with these features or for anything else related to the Salesforce Extensions for VS Code, open a [bug on GitHub](https://github.com/forcedotcom/salesforcedx-vscode/issues/new?template=Bug_report.md). If you would like to suggest a feature, create a [feature request on Github](https://github.com/forcedotcom/salesforcedx-vscode/issues/new?template=Feature_request.md).
