# Salesforce Extensions for Visual Studio Code

This extension pack includes tools for developing on the Salesforce platform in the lightweight, extensible VS Code editor. These tools provide features for working with development orgs (scratch orgs, sandboxes, and DE orgs), Apex, Aura components, and Visualforce.

![GIF showing Apex code completion, pushing source to a scratch org, and running Apex tests](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode/images/overview.gif)

## Prerequisites

Before you set up Salesforce Extensions for VS Code, make sure that you have these essentials.

- **Salesforce CLI**
  Before you use Salesforce Extensions for VS Code, [set up Salesforce CLI](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup).
- **A Salesforce DX project**
  Open your Salesforce DX project in a directory that contains an `sfdx-project.json` file. Otherwise, some features don’t work.
  If you don't already have a Salesforce DX project, create one with the **SFDX: Create Project** command (for development against scratch orgs) or the **SFDX: Create Project with Manifest** command (for development against sandboxes or DE orgs). Or, see [create a Salesforce DX project](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_workspace_setup.htm) for information about setting up a project using Salesforce CLI.
- **Java Platform, Standard Edition Development Kit**
  Some features in Salesforce Extensions for VS Code depend upon the Java Platform, Standard Edition Development Kit (JDK). You need to have either version 8 or version 11 of the JDK installed.

  If you don’t already have version 8, 11, or 17 of the JDK installed, you can install the latest version of the Java 8 JDK from [Java 8 Downloads](https://www.oracle.com/java/technologies/downloads/#java8) or the latest version of the Java 11 JDK from [Java 11 Downloads](https://www.oracle.com/java/technologies/downloads/#java11), or Java 17 from [Java 17 Downloads](https://www.oracle.com/java/technologies/downloads/#java17).

  If you also use other versions of the JDK, set your VS Code user setting `salesforcedx-vscode-apex.java.home` to point to the location where you installed Java 8, 11, or 17.

- **[Visual Studio Code](https://code.visualstudio.com/download) v1.26 or later**

## Documentation

For documentation, visit the [Salesforce Extensions for Visual Studio Code](https://developer.salesforce.com/tools/vscode) documentation site.

## Open Source

- [Roadmap](https://github.com/forcedotcom/salesforcedx-vscode/wiki/Roadmap)
- [GitHub Repository](https://github.com/forcedotcom/salesforcedx-vscode)

## Bugs and Feedback

To report issues with Salesforce Extensions for VS Code, open a [bug on GitHub](https://github.com/forcedotcom/salesforcedx-vscode/issues/new?template=Bug_report.md). If you would like to suggest a feature, create a [feature request on GitHub](https://github.com/forcedotcom/salesforcedx-vscode/issues/new?template=Feature_request.md).

## Included Extensions

The Salesforce Extension Pack extension installs these extensions.

- [Salesforce CLI Integration](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-core)
   This extension (`salesforcedx-vscode-core`) interacts with Salesforce CLI to provide core functionality.
- [Apex](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-apex)
   This extension (`salesforcedx-vscode-apex`) uses the Apex Language Server to provide features such as syntax highlighting and code completion.
- [Apex Interactive Debugger](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-apex-debugger)
   This extension (`salesforcedx-vscode-apex-debugger`) enables VS Code to use the real-time Apex Debugger with your scratch orgs or to use ISV Customer Debugger for your subscribers’ orgs.
- [Apex Replay Debugger](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-apex-replay-debugger)
   This extension (`salesforcedx-vscode-apex-replay-debugger`) enables VS Code to replay Apex execution from Apex debug logs.
- [Lightning Web Components](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-lwc)
   This extension supports Lightning web component bundles. It uses the HTML language server from VS Code.
- [Aura Components](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-lightning)
   This extension (`salesforcedx-vscode-lightning`) supports Aura component bundles. It uses the HTML language server from VS Code.
- [Visualforce](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-visualforce)
   This extension (`salesforcedx-vscode-visualforce`) supports Visualforce pages and components. It uses the Visualforce Language Server and the HTML language server from VS Code.
- [SOQL](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-soql)
   This extension (`salesforcedx-vscode-soql`) enables you to interactively build a SOQL query via a form-based visual editor, view the query as you build, and save the output to a .csv or .json file.
- [Salesforce Lightning Design System (SLDS) Validator](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforce-vscode-slds)
   This extension (`salesforcedx-vscode-slds`) simplifies working with the Salesforce Lightning Design System (SLDS). It provides code completion, syntax highlighting and validation with recommended tokens and utility classes.

---

Currently, Visual Studio Code extensions are not signed or verified on the Microsoft Visual Studio Code Marketplace. Salesforce provides the Secure Hash Algorithm (SHA) of each extension that we publish. Consult [Manually Verify the salesforcedx-vscode Extensions’ Authenticity](https://developer.salesforce.com/media/vscode/SHA256.md) to learn how to verify the extensions.

---
