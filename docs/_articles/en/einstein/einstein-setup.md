---
title: Einstein for Developers Setup
lang: en
---

## Set Up Overview

Einstein for Developers (Beta) is available in the [VS Code](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-einstein-gpt) and [Open VSX](https://open-vsx.org/extension/salesforce/salesforcedx-einstein-gpt) marketplaces as a part of the [Salesforce Expanded Pack](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-expanded). Any developer with access to a Salesforce org can use the extension to generate Apex code from natural language instructions, get coding suggestions using line autocomplete, or generate Apex unit tests to quickly accomplish required code coverage goals.


### Required Editions

**Available in**: Developer, Enterprise, Partner Developer, Performance and Unlimited Editions.

**Inoperable in**: Group, Professional, and Essentials Editions.

**Not Available in**: EU Operating Zone. EU Operating zone is a special paid offering that provides an enhanced level of data residency commitment. Einstein for Developers is supported in orgs in the EU that aren’t part of EU OZ, per standard product terms and conditions.


**Enhanced Domain Enabled**
Your Einstein for Developers org must have Enhanced Domain enabled. See [Enable Enhanced Domains](https://help.salesforce.com/s/articleView?id=sf.domain_name_enhanced_enable.htm&type=5) for more information.

### Visual Studio Code Version

VS Code releases a new version each month with new features and important bug fixes. You must be on VS Code Version 1.82.0 or higher to run the Einstein for Developers extension. You can manually check for updates from **Help** **> Check for Updates** on Linux and Windows or **Code > Check for Updates** on macOS.

### Interaction with other AI-enabled Extensions

- You may run into some unexpected generated code outcomes if you have multiple AI-enabled extensions installed in VS Code. We recommend you disable all other AI-enabled extensions when working with Einstein for Developers:
  1. Click the Extensions icon in the Activity Bar, search for the extension to disable by name.
  2. Click **Disable** in the extension's marketplace page.
  3. Repeat for all installed AI-enabled extensions.


## Enable or Disable Einstein For Developers in VS Code

You can enable or disable Einstein for Developers from within Visual Studio Code or Code Builder. Click the Einstein icon in the status bar to open the command palette, then click enable or disable.
The Einstein for Developers status icon in the bottom panel of the Visual Studio Code window indicates whether Einstein for Developers is enabled or disabled. When enabled, the background color of the icon will match the color of the status bar. When disabled, the background color of the icon is brown.

![einstein icon](./images/einstein-icon.png)

## Disable or Uninstall Einstein for Developers Extension

You can disable or uninstall the Einstein for Developers extension at any time. Bring up the Extensions view by clicking on the Extensions icon in the Activity Bar on the side of VS Code or the **View: Show Extensions** command (⇧⌘X). Search for "Einstein for Developers" in installed extensions list, and then select **Disable** or **Uninstall**.

### Use Einstein for Developers in Code Builder

Einstein for Developers is disabled by default in new Code Builder environments. To enable this extension in a new environment, go to **Settings** > **Application** > **Telemetry** and set the dropdown value to `all`, and then enable the extension. Telemetry can be disabled once the extension is enabled. 

### Use Einstein for Developers in a Scratch Org

Einstein for Developers is only available in scratch org editions that can author Apex:

- Developer Edition
- Enterprise Edition

To use Einstein for Developers in a scratch org:

1. Enable Einstein for Developers in the Dev Hub.
2. Use the **SFDX: Authorize a Dev Hub** command to log into the Dev Hub.
3. Activate Einstein for Developers by turning on the `EinsteinGPTForDevelopers` scratch org feature:

Edit the `config/project-scratch-def.json` file in your DX project and add the “`EinsteinGPTForDevelopers`” feature to your existing feature list and save your changes. For example:

```
   {
   "orgName": "Acme Company",
   "edition": "Developer",
   "features":["Communities", "ServiceCloud", "EinsteinGPTForDevelopers"]
   }
```

Create a scratch org using the `SFDX: Create a Default Scratch Org...` command referencing the scratch org definition that you previously updated.

## Show Einstein Console View

Run **Einstein: Show Prompt History** from the Command Palette to open the console. When opened, you can view a running history of your prompts and associated responses.

## Keyboard Shortcuts for Einstein for Developers

You can use the default keyboard shortcuts in Visual Studio Code when using Einstein for Developers. You can rebind the shortcuts in the Keyboard Shortcuts editor using your preferred keyboard shortcuts for each specific command. For more information see [Key Bindings for Visual Studio Code](https://code.visualstudio.com/docs/getstarted/keybindings).

You can search for each keyboard shortcut by command name in the Keyboard Shortcuts editor.

| Command                   | Key Binding |
| ------------------------- | ----------- |
| Accept                    | ⌘Enter      |
| Accept                    | Tab         |
| Clear                     | Escape      |
| Einstein:Generate Code    | ⇧⌘R         |
| Trigger Inline Suggestion | ⌥\          |
