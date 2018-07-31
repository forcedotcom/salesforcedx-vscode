# Salesforce Extensions for Visual Studio Code  
This extension bundle includes tools for developing on the Salesforce platform using the Salesforce DX development flow in the lightweight, extensible VS Code editor. These tools provide features for working with scratch orgs, Apex, Lightning components, and Visualforce.

![GIF showing Apex code completion, pushing source to a scratch org, and running Apex tests](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode/images/overview.gif)  

##  Prerequisites
Before you set up Salesforce Extensions for VS Code, make sure that you have these essentials.

* **Salesforce CLI and a Salesforce DX project**  
  Before you use Salesforce Extensions for VS Code, [set up the Salesforce CLI](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup) and [create a Salesforce DX project](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_workspace_setup.htm).  
  Open your Salesforce DX project in a directory that contains an `sfdx-project.json` file. Otherwise, some features don’t work.  
* **Java 8 Platform, Standard Edition Development Kit**  
  Some features in Salesforce Extensions for VS Code depend upon the Java 8 Platform, Standard Edition Development Kit (JDK).  
  If you don’t already have the JDK installed, install the latest version of the Java 8 JDK from [Java SE Development Kit 8 Downloads](http://www.oracle.com/technetwork/java/javase/downloads/jdk8-downloads-2133151.html).  
* **[Visual Studio Code](https://code.visualstudio.com/download) v1.23 or later**  

## Documentation for Included Extensions  
To use Salesforce Extensions for VS Code, install all the extensions in this extension pack. Each extension has its own documentation.
* [salesforcedx-vscode-core](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-core)  
   This extension interacts with the Salesforce CLI to provide basic Salesforce DX functionality.
* [salesforcedx-vscode-apex](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-apex)  
   This extension uses the Apex Language Server to provide features such as syntax highlighting and code completion.
* [salesforcedx-vscode-apex-debugger](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-apex-debugger)  
   This extension enables VS Code to use the real-time Apex Debugger with your scratch orgs.
* [salesforcedx-vscode-apex-replay-debugger](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-apex-replay-debugger)  
   This extension enables VS Code to replay Apex execution from Apex debug logs.
* [salesforcedx-vscode-lightning](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-lightning)  
   This extension supports Lightning component bundles. It uses the HTML language server from VS Code.
* [salesforcedx-vscode-visualforce](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-visualforce)  
   This extension supports Visualforce pages and components. It uses the Visualforce Language Server and the HTML language server from VS Code.  

For tips and tricks for working with Salesforce Extensions for VS Code, visit our [GitHub wiki](https://github.com/forcedotcom/salesforcedx-vscode/wiki/Tips-and-Tricks).  
   
## Bugs and Feedback
To report issues with Salesforce Extensions for VS Code, open a [bug on GitHub](https://github.com/forcedotcom/salesforcedx-vscode/issues/new?template=Bug_report.md). If you would like to suggest a feature, create a [feature request on Github](https://github.com/forcedotcom/salesforcedx-vscode/issues/new?template=Feature_request.md).

## Resources
* Trailhead: [Get Started with Salesforce DX](https://trailhead.salesforce.com/trails/sfdx_get_started)
* _[Salesforce DX Setup Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup)_
* _[Salesforce DX Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev)_
* Dreamforce ’17 Session Video: [Getting Started In VS Code With Salesforce DX](https://www.salesforce.com/video/1768045/)
* Dreamforce ’17 Session Video: [Visual Studio Code for Eclipse Users](https://www.salesforce.com/video/1774284/)
* GitHub: [salesforcedx-vscode](https://github.com/forcedotcom/salesforcedx-vscode)  
* GitHub wiki for salesforcedx-vscode: [Tips and Tricks](https://github.com/forcedotcom/salesforcedx-vscode/wiki/Tips-and-Tricks)
* GitHub wiki for salesforcedx-vscode: [Troubleshooting](https://github.com/forcedotcom/salesforcedx-vscode/wiki/Troubleshooting)

---
Currently, Visual Studio Code extensions are not signed or verified on the Microsoft Visual Studio Code Marketplace. Salesforce provides the Secure Hash Algorithm (SHA) of each extension that we publish. Consult [Manually Verify the salesforcedx-vscode Extensions’ Authenticity](https://developer.salesforce.com/media/vscode/SHA256.md) to learn how to verify the extensions.  

---
