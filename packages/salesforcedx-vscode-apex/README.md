# Apex Code Editor for Visual Studio Code
View outlines of Apex classes and triggers, see code-completion suggestions, and find syntactic errors in your code. This extension is powered by the [Apex Language Server](https://github.com/forcedotcom/salesforcedx-vscode/wiki/Apex-Language-Server).

For best results, use this extension with the other extensions in the [salesforcedx-vscode](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode) bundle.  

##  Prerequisites
Before you set up this extension, make sure that you have these essentials.

* **Java 8 Platform, Standard Edition Development Kit**  
  Some features in Salesforce Extensions for VS Code depend upon the Java 8 Platform, Standard Edition Development Kit (JDK).  
  If you don’t already have the JDK installed, install the latest version of the Java 8 JDK from [Java SE Development Kit 8 Downloads](http://www.oracle.com/technetwork/java/javase/downloads/jdk8-downloads-2133151.html).  
* **[Visual Studio Code](https://code.visualstudio.com/download) v1.23 or later**  
* **[Salesforce Extensions for VS Code](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode)**  
  Code smartness for sObjects in Apex code is powered by the [salesforcedx-vscode-core](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-core) extension. We suggest that you install all extensions in the [salesforcedx-vscode](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode) extension pack.

## View Code-Completion Suggestions
To see code-completion suggestions, press Ctrl+space when you’re working in a `.cls` or `.trigger` file. To navigate between the suggestions, use the arrow keys. To auto-complete a suggestion from the list, press Enter.  
![Animation showing code completion of a System.debug() statement](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-apex/images/apex_completion.gif)

## Insert Code Snippets
To see available Apex code snippets when you’re working in a `.cls` or `.trigger` file, run **Insert Snippet**. Snippets are available for class and interface definitions, a variety of statements, and much more. These code snippets are also available as code-completion suggestions.

## View or Jump to Definitions
You can preview, view, or go to definitions of:  
* User-defined Apex  
  * Classes (from definitions of extending classes)  
  * Constructors  
  * Interfaces (from definitions of implementing classes)  
  * Methods  
  * Properties  
  * Variables (local and class variables)  
* Standard objects  
  * Fields (standard and custom fields)
  * Object definitions
* Custom objects
  * Fields  
  * Object definitions  

(See the "Enable Code Smartness for SObjects" section of this README for information on working with standard and custom objects.)

To preview a definition, hold down Cmd (macOS) or Ctrl (Windows or Linux) and hover over the item whose definition you want to see.  

To view a definition, right-click the item and select **Peek Definition**, or press Alt+F12.

To jump to the location of a definition, right-click the item and select **Go to Definition**, or press F12.  
![Previewing, viewing, and jumping to a definition](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-apex/images/apex_go_to_definition.gif)

## Find All References
You can find all references to user-defined Apex:  
* Classes  
* Class variables  
* Enums  
* Interfaces  
* Methods  
* Properties  

To find references to an item, right-click the item and select **Find All References**, or press Shift+F12.

## Check Syntax Errors in Your Code
If you leave out a `;`, `}`, or `)`, the syntax error is marked with a red squiggly line in the editor.  

The Problems view in the bottom pane also lists the syntax errors. Double-click the problem to go to the source file.  
![Problems view, showing a missing semicolon in an Apex class](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-apex/images/apex_problems.png)

## View an Outline of Your Apex Class or Trigger
The Apex outline view shows the structure of the Apex class or trigger that’s open in the editor. For a list of the symbols in your file, press Cmd+Shift+O (macOS) or Ctrl+Shift+O (Windows or Linux). To jump to one of the symbols, select it in the list.  
![Outline view, showing the symbols in an Apex class](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-apex/images/apex_outline.png)

## Enable Code Smartness for SObjects
To activate this extension’s code smartness features for standard and custom objects and their fields, including for custom fields on standard objects, press Cmd+Shift+P (macOS) or Ctrl+Shift+P (Windows or Linux), and then select **SFDX: Refresh SObject Definitions** from the command palette. 

When you refresh your sObject definitions, VS Code uses your default scratch org to generate faux Apex classes. These faux classes represent the standard and custom objects that the admin user of your default scratch org has access to. The classes are stored in a hidden directory on your local workstation. Don’t edit the faux classes! They are deleted and regenerated each time that you refresh your sObject definitions. To modify your sObjects, either modify the objects’ `.object-meta.xml` and `.field-meta.xml` files (and then run **SFDX: Push Source to Default Scratch Org**), or make changes declaratively in your scratch org (and then run **SFDX: Pull Source from Default Scratch Org**). The scratch org’s admin user doesn’t automatically gain access to new custom objects, so be sure to assign new permissions to the user as necessary. To assign permissions from the command line, run `sfdx force:user:permset:assign -n YourPermSetName`. 

After you add or edit standard or custom objects or their fields, be sure to rerun **SFDX: Refresh SObject Definitions**.  

## Monitor Apex Language Server Output
The Apex Language Server is an implementation of the [Language Server Protocol](https://github.com/Microsoft/language-server-protocol) 3.0 specification. The Language Server Protocol allows a tool (in this case, VS Code) to communicate with a language smartness provider (the server). VS Code uses the Apex Language Server to show outlines of Apex classes and triggers, code-completion suggestions, and syntactic errors. To see all diagnostic information from the Apex Language Server, select **View** > **Output**, then choose **Apex Language Server** from the dropdown menu. The diagnostic information gives you insights into the progress of the language server and shows the problems  encountered.  

## Troubleshooting
Salesforce Extensions for VS Code functions properly only if the root directory of your open project contains an `sfdx-project.json` file. This extension bundle is designed for the Salesforce DX workflow. If you’re not using Salesforce DX, use the classic version of [Force.com IDE](https://developer.salesforce.com/docs/atlas.en-us.eclipse.meta/eclipse) or a different Salesforce development tool.  

If you’re not seeing the Apex completion suggestions that you expect, your Apex database might need to be rebuilt. Quit VS Code, and then delete the `.sfdx/tools/apex.db` file from your project. Then relaunch VS Code, and open an Apex class or trigger. The Apex database rebuilds within about 5 seconds (up to 30 seconds for very large code bases).

## Bugs and Feedback
To report issues with Salesforce Extensions for VS Code, open a [bug on GitHub](https://github.com/forcedotcom/salesforcedx-vscode/issues/new?template=Bug_report.md). If you would like to suggest a feature, create a [feature request on Github](https://github.com/forcedotcom/salesforcedx-vscode/issues/new?template=Feature_request.md).

## Resources
* Trailhead: [Get Started with Salesforce DX](https://trailhead.salesforce.com/trails/sfdx_get_started)
* _[Salesforce DX Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev)_
* _[Apex Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode)_
* Dreamforce ’17 session video: [Building Powerful Tooling For All IDEs Through Language Servers](https://www.salesforce.com/video/1765282/)
* GitHub: [Language Server Protocol](https://github.com/Microsoft/language-server-protocol)
* GitHub: [salesforcedx-vscode-apex](https://github.com/forcedotcom/salesforcedx-vscode/tree/develop/packages/salesforcedx-vscode-apex)
* GitHub wiki for salesforcedx-vscode: [Apex Language Server](https://github.com/forcedotcom/salesforcedx-vscode/wiki/Apex-Language-Server)

---
Currently, Visual Studio Code extensions are not signed or verified on the Microsoft Visual Studio Code Marketplace. Salesforce provides the Secure Hash Algorithm (SHA) of each extension that we publish. Consult [Manually Verify the salesforcedx-vscode Extensions’ Authenticity](https://developer.salesforce.com/media/vscode/SHA256.md) to learn how to verify the extensions.    

---
