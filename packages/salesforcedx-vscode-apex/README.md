# salesforcedx-vscode-apex
View outlines of Apex classes and triggers, see code-completion suggestions, and find syntactic errors in your code. This extension is powered by the [Apex Language Server](https://developer.salesforce.com/docs/atlas.en-us.sfdx_ide2.meta/sfdx_ide2/sfdx_ide2_build_app_apex_language_server_protocol.htm).

For best results, use this extension with the other extensions in the [salesforcedx-vscode](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode) bundle.  

## View Code-Completion Suggestions
To see code-completion suggestions, press Ctrl+space when you’re working in a `.cls` or `.trigger` file. To navigate between the suggestions, use the arrow keys. To auto-complete a suggestion from the list, press Enter.  
![Animation showing code completion of a System.debug() statement](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-apex/images/apex_completion.gif)

## View or Jump to Definitions
You can preview, view, or go to definitions of Apex methods, properties, constructors, and local and class variables.  

To preview a definition, hold down Cmd (macOS) or Ctrl (Windows or Linux) and hover over the item whose definition you want to see.  

To view a definition, right-click the item and select **Peek Definition**, or press Alt+F12.

To jump to the location of a definition, right-click the item and select **Go to Definition**, or press F12.  
![Previewing, viewing, and jumping to a definition](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-apex/images/apex_go_to_definition.gif)

## Check Syntax Errors in Your Code
If you leave out a `;`, `}`, or `)`, the syntax error is marked with a red squiggly line in the editor.  

The Problems view in the bottom pane also lists the syntax errors. Double-click the problem to go to the source file.  
![Problems view, showing a missing semicolon in an Apex class](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-apex/images/apex_problems.png)

## View an Outline of Your Apex Class or Trigger
The Apex outline view shows the structure of the Apex class or trigger that’s open in the editor. For a list of the symbols in your file, press Cmd+Shift+O (macOS) or Ctrl+Shift+O (Windows or Linux). To jump to one of the symbols, select it in the list.  
![Outline view, showing the symbols in an Apex class](https://raw.githubusercontent.com/forcedotcom/salesforcedx-vscode/develop/packages/salesforcedx-vscode-apex/images/apex_outline.png)

## Monitor Apex Language Server Output
The Apex Language Server is an implementation of the [Language Server Protocol](https://github.com/Microsoft/language-server-protocol) 3.0 specification. The Language Server Protocol allows a tool (in this case, VS Code) to communicate with a language smartness provider (the server). VS Code uses the Apex Language Server to show outlines of Apex classes and triggers, code-completion suggestions, and syntactic errors. To see all diagnostic information from the Apex Language Server, select **View** > **Output**, then choose **Apex Language Server** from the dropdown menu. The diagnostic information gives you insights into the progress of the language server and shows the problems  encountered.  

## Troubleshooting
Salesforce Extensions for VS Code functions properly only if the root directory of your open project contains an `sfdx-project.json` file. This extension bundle is designed for the Salesforce DX workflow. If you’re not using Salesforce DX, use the classic version of [Force.com IDE](https://developer.salesforce.com/docs/atlas.en-us.eclipse.meta/eclipse) or a different Salesforce development tool.  

If you’re not seeing the Apex completion suggestions that you expect, your Apex database might need to be rebuilt. Quit VS Code, and then delete the `.sfdx/tools/apex.db` file from your project. Then relaunch VS Code, and open an Apex class or trigger. The Apex database rebuilds within about 5 seconds (up to 30 seconds for very large code bases).

## Resources
* Trailhead: [Get Started with Salesforce DX](https://trailhead.salesforce.com/trails/sfdx_get_started)
* _[Salesforce DX Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev)_
* _[Apex Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode)_
* GitHub: [salesforcedx-vscode-apex](https://github.com/forcedotcom/salesforcedx-vscode/tree/develop/packages/salesforcedx-vscode-apex)

---
Currently, Visual Studio Code extensions are not signed or verified on the Microsoft Visual Studio Code Marketplace. Salesforce provides the Secure Hash Algorithm (SHA) of each extension that we publish. Consult [Manually Verify the salesforcedx-vscode Extensions’ Authenticity](https://developer.salesforce.com/media/vscode/SHA256.md) to learn how to verify the extensions.    

---