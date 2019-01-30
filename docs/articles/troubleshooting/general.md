---
title: Troubleshooting Common Issues
---

Here’s some information on how to get past roadblocks that you might encounter while using Salesforce Extensions for VS Code.

## SFDX Commands Aren’t Available

If you don’t see any SFDX commands in the command palette, make sure that you’re working on a Salesforce DX project and that you have the latest version of Salesforce CLI.

1. Make sure that the root directory you have open in VS Code contains an `sfdx-project.json` file. If you haven’t set up a Salesforce DX project, check out [Project Setup](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_workspace_setup.htm) in the _Salesforce DX Developer Guide_.
2. [Update Salesforce CLI](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_update_cli.htm), as described in the _Salesforce DX Setup Guide_.

## Other Resources

For Apex Debugger troubleshooting information, [Apex Interactive Debugger](../apex/interactive-debugger).

For general information about VS Code, see the [Visual Studio Code docs](https://code.visualstudio.com/docs).

## Monitor Apex Language Server Output

The Apex Language Server is an implementation of the [Language Server Protocol](https://github.com/Microsoft/language-server-protocol) 3.0 specification. The Language Server Protocol allows a tool (in this case, VS Code) to communicate with a language smartness provider (the server). VS Code uses the Apex Language Server to show outlines of Apex classes and triggers, code-completion suggestions, and syntactic errors. To see all diagnostic information from the Apex Language Server, select **View** > **Output**, then choose **Apex Language Server** from the dropdown menu. The diagnostic information gives you insights into the progress of the language server and shows the problems encountered.
