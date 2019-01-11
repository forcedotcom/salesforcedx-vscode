---
title: Apex Debugger
---

# Introduction

Apex Debugger allows customers to debug their Apex code on sandbox instances (including in scratch orgs), in real time, using VS Code as the client. You can use it to:

- Set breakpoints in Apex classes and triggers.
- View variables, including sObject types, collections, and Apex System types.
- View the call stack, including triggers activated by Apex Data Manipulation Language (DML), method-to-method calls, and variables.
- Interact with global classes, exceptions, and triggers from your installed managed packages. (When you inspect objects that have managed types that aren’t visible to you, only global variables are displayed in the variable inspection pane.)
- Complete standard debugging actions, including step into, over, and out, and run to breakpoint.
- Output your results to the Debug Console.

# Installation

We recommend that you install the Salesforce Extensions for VS Code extension pack from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode). The extension pack includes the Apex Debugger.

# Usage

See the [README](https://github.com/forcedotcom/salesforcedx-vscode/tree/develop/packages/salesforcedx-vscode-apex-debugger). The same content is provided in the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-apex-debugger), and in VS Code's Extensions view when you select **Apex Debugger for Visual Studio Code**.

# Troubleshooting

### How do I know whether the Apex Debugger extension is installed?

In the VS Code menu bar, select **View** > **Extensions**. If the extension is installed, the list on the left includes "Apex Debugger for Visual Studio Code."

There is an unofficial debugger extension that will conflict with ours: https://marketplace.visualstudio.com/items?itemName=chuckjonas.apex-debug. Please disable that extension while using ours.

### What is required on my computer and in my Dev Hub org?

Make sure that you have all the [prerequisites](https://github.com/forcedotcom/salesforcedx-vscode/tree/develop/packages/salesforcedx-vscode-apex-debugger#prerequisites).

### How do I configure my scratch org so I can use the Apex Debugger?

See these [instructions](https://github.com/forcedotcom/salesforcedx-vscode/tree/develop/packages/salesforcedx-vscode-apex-debugger#set-up-the-apex-debugger).

### How do I see errors from the Apex Debugger extension?

Add `"trace": "all"` in your `launch.json` file. Then, re-run your scenario to view debugger log lines in VS Code's Debug Console.
