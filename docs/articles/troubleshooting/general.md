---
title: Troubleshooting Common Issues
---

Here’s some information on how to get past roadblocks that you might encounter while using Salesforce Extensions for VS Code.

## SFDX Commands Aren’t Available

If you don’t see any SFDX commands in the command palette, make sure that you’re working on a Salesforce DX project and that you have the latest version of Salesforce CLI.

1. Make sure that the root directory you have open in VS Code contains an `sfdx-project.json` file. If you haven’t set up a Salesforce DX project, check out [Project Setup](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_workspace_setup.htm) in the _Salesforce DX Developer Guide_.
2. [Update Salesforce CLI](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_update_cli.htm), as described in the _Salesforce DX Setup Guide_.

## Extensions Malfunction After Update

Sometimes, after an automatic or manual update of Salesforce Extensions for VS Code, one or more extensions stops working properly. The SFDX commands might disappear from the command palette, items might be missing from the UI, or features might not function as expected. You might see the error, `Please restart Code before reinstalling`.

VS Code doesn’t provide us with a way to specify which order the extensions update in, and if they update in the wrong order things can break. We believe the problem is related to [VS Code issue #26828](https://github.com/Microsoft/vscode/issues/26828#issuecomment-344589719). Here’s how to recover from this issue.

First, try reloading the Salesforce Extensions for VS Code extension pack.

1. Open the Extensions view.
1. Search for **Salesforce Extension Pack**.
1. If a **Reload** button is available, click it.

If a Reload button isn’t available, or if reloading the extension pack doesn’t solve your problem, try removing the `Code` folder that stores your application data.

1. Close VS Code.
1. Delete your `Code` folder.
   - On Linux, delete `~/.config/Code`.
   - On macOS, delete `~/Library/Application Support/Code`.
   - On Windows, delete `C:\Users\<yourUsername>\AppData\Roaming\Code`.
1. Relaunch VS Code. Your extensions reinstall automatically.

If neither of the previous solutions solves your problem, try to identify which extension in the extension pack is malfunctioning. Then, delete the problematic extension and reinstall it.

1. For a list of extensions in the extension pack, see [Salesforce Extension Pack](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode) on the Visual Studio Marketplace. Identify the extension (or extensions) whose features aren’t working properly.
1. Close VS Code.
1. To delete the malfunctioning extension, delete `~/.vscode/extensions/<folderOfProblematicExtension>`.
1. Relaunch VS Code.
1. Reinstall the extension that you deleted.

## Other Resources

For Apex Debugger troubleshooting information, see this wiki’s [Apex Debugger](https://github.com/forcedotcom/salesforcedx-vscode/wiki/Apex-Debugger) page.

For information on troubleshooting issues with code smartness for the Apex language, see this wiki’s [Apex Language Server](https://github.com/forcedotcom/salesforcedx-vscode/wiki/Apex-Language-Server) page.

For general information about VS Code, see the [Visual Studio Code docs](https://code.visualstudio.com/docs).

## Monitor Apex Language Server Output

The Apex Language Server is an implementation of the [Language Server Protocol](https://github.com/Microsoft/language-server-protocol) 3.0 specification. The Language Server Protocol allows a tool (in this case, VS Code) to communicate with a language smartness provider (the server). VS Code uses the Apex Language Server to show outlines of Apex classes and triggers, code-completion suggestions, and syntactic errors. To see all diagnostic information from the Apex Language Server, select **View** > **Output**, then choose **Apex Language Server** from the dropdown menu. The diagnostic information gives you insights into the progress of the language server and shows the problems encountered.
