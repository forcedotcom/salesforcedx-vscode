# Salesforce Extensions for Visual Studio Code

This extension pack includes tools for developing on the Salesforce platform in the lightweight, extensible VS Code editor. These tools provide features for working with development orgs (scratch orgs, sandboxes, and DE orgs), Apex, Lightning components, and Visualforce.

![GIF showing Apex code completion, pushing source to a scratch org, and running Apex tests](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode/images/overview.gif)

## Prerequisites

Before you set up Salesforce Extensions for VS Code, make sure that you have these essentials.

- **Salesforce CLI**  
  Before you use Salesforce Extensions for VS Code, [set up the Salesforce CLI](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup).
- **A Salesforce DX project**
  Open your Salesforce DX project in a directory that contains an `sfdx-project.json` file. Otherwise, some features don’t work.  
  If you don't already have a Salesforce DX project, create one with the **SFDX: Create Project** command (for development against scratch orgs) or the **SFDX: Create Project with Manifest** command (for development against sandboxes or DE orgs). Or, see [create a Salesforce DX project](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_workspace_setup.htm) for information about setting up a project using Salesforce CLI.
- **Java 8 Platform, Standard Edition Development Kit**  
  Some features in Salesforce Extensions for VS Code depend upon the Java 8 Platform, Standard Edition Development Kit (JDK).  
  If you don’t already have the JDK installed, install the latest version of the Java 8 JDK from [Java SE Development Kit 8 Downloads](http://www.oracle.com/technetwork/java/javase/downloads/jdk8-downloads-2133151.html).
- **[Visual Studio Code](https://code.visualstudio.com/download) v1.26 or later**

## Documentation & Resources

Documentation for each extension as well as additional resources are listed below.

### Extension Documentation

- [Salesforce CLI Integration](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-core)  
   This extension interacts with Salesforce CLI to provide core functionality.
- [Apex](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-apex)  
   This extension uses the Apex Language Server to provide features such as syntax highlighting and code completion.
- [Apex Interactive Debugger](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-apex-debugger)  
   This extension enables VS Code to use the real-time Apex Debugger with your scratch orgs or to use ISV Customer Debugger for your subscribers’ orgs.
- [Apex Replay Debugger](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-apex-replay-debugger)  
   This extension enables VS Code to replay Apex execution from Apex debug logs.
- [Lighting Component Framework](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-lightning)  
   This extension supports Lightning component bundles. It uses the HTML language server from VS Code.
- [Visualforce](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-visualforce)  
   This extension supports Visualforce pages and components. It uses the Visualforce Language Server and the HTML language server from VS Code.

### Additional Documentation

- Trailhead: [Get Started with Salesforce DX](https://trailhead.salesforce.com/trails/sfdx_get_started)
- Tutorial: [Develop Against Any Org](https://github.com/forcedotcom/salesforcedx-vscode/wiki/Develop-Against-Any-Org-in-Visual-Studio-Code)
- Tutorial: [Migrate From Forcecom IDE to Visual Studio Code](https://github.com/forcedotcom/salesforcedx-vscode/wiki/Migrate-From-Forcecom-IDE-to-Visual-Studio-Code)
- [Tips and Tricks](https://github.com/forcedotcom/salesforcedx-vscode/wiki/Tips-and-Tricks)
- [Troubleshooting](https://github.com/forcedotcom/salesforcedx-vscode/wiki/Troubleshooting)
- [Salesforce DX Setup Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup)
- [Salesforce DX Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev)
- [Recommended Extension](https://github.com/forcedotcom/salesforcedx-vscode/wiki/Recommended-Extensions)

### Dreamforce Session Videos

- [Salesforce Development with Visual Studio Code](https://www.youtube.com/watch?v=lQ-ZpCRKYM0)
- [Be An Efficient Salesforce Developer with VS Code](https://www.youtube.com/watch?v=hw9LBvjo4PQ)
- [Moving to Visual Studio Code for Force.com IDE Developers](https://www.youtube.com/watch?v=J-9ILFRqcwg)

### Open Source

- [Roadmap](https://github.com/forcedotcom/salesforcedx-vscode/wiki/Roadmap)
- [Github Repository](https://github.com/forcedotcom/salesforcedx-vscode)

## Bugs and Feedback

To report issues with Salesforce Extensions for VS Code, open a [bug on GitHub](https://github.com/forcedotcom/salesforcedx-vscode/issues/new?template=Bug_report.md). If you would like to suggest a feature, create a [feature request on Github](https://github.com/forcedotcom/salesforcedx-vscode/issues/new?template=Feature_request.md).

---

Currently, Visual Studio Code extensions are not signed or verified on the Microsoft Visual Studio Code Marketplace. Salesforce provides the Secure Hash Algorithm (SHA) of each extension that we publish. Consult [Manually Verify the salesforcedx-vscode Extensions’ Authenticity](https://developer.salesforce.com/media/vscode/SHA256.md) to learn how to verify the extensions.

---
