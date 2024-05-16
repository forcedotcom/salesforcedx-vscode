---
title: Automatic Inline Completions
lang: en
---

## Overview

Use AI-based autocomplete to accept suggestions for code as you write it right inside your editor. Inline autocompletions can currently be triggered in Apex and LWC (Javascript, CSS and HTML) files.

![Inline Autocomplete](./images/einstein-inline-autocomplete.gif)

## Enable or Disable Inline Autocomplete

Inline autocomplete is enabled by default. Click the Einstein icon in the status bar, or run **Einstein: Toggle Einstein Auto Completions** to toggle the feature off and on. Run the **Einstein: Toggle Einstein Auto Completions for Current File Type** command to toggle the feature off and on for the currently active specific file type.

To enable or disable the Inline Autocomplete feature from Settings:

1. Select **File** > **Preferences** > **Settings** (Windows or Linux) or **Code** > **Settings** > **Settings** (macOS).
2. Under **Einstein for Developers**, select **Enable Einstein Auto Completions** then select the language for which to enable the feature.

## Select Inline Completion Length

To select the length of generated inline autocompletions:

1. Select **File** > **Preferences** > **Settings** (Windows or Linux) or **Code** > **Settings** > **Settings** (macOS).
2. Under **Einstein for Developers**, go to **Autocompletion Length** and select **Short** or **Long** from the dropdown.

Note that longer completions can span multiple lines. Short completions typically span only a single line. 


## Receive your First Inline Completions

Einstein for Developers automatically generates code and suggests completions for you as you type. When writing code, you're often doing things like assigning variable values to an `SObject` such as `Account.name = abc`, or `Account.type = Business` in Apex. Pause the cursor after the variable value and watch Einstein for Developers complete your code for you and fill out the remaining fields. The Einstein icon in the status bar keeps you updated about completion progress.

![Inline Suggestions](./images/einstein-inline-create-account.png)

To accept an entire suggestion, press Tab. If you have VS Code's **Inline Suggest** enabled, you can accept the next word of the suggestion using one of the following keyboard shortcuts:

| Operating System | Accept Next Word |
| ---------------- | ---------------- |
| macOS            | ⌘→               |
| Windows          | ⌥→               |
| Linux            | ⌥→               |

**Note**: If you don't see a suggestion, make sure Einstein Auto Completions are enabled. Run **Einstein: Toggle Einstein Auto Completions** to toggle the feature off and on. Also, you can always trigger inline suggestions even if you don't have the Auto Completions enabled using the Option (⌥)\ hotkeys to manually generate autocomplete suggestions.

## Known Issues

- The completions that you receive are sometimes not formatted correctly. Run [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) once you've accepted the suggestions.
- Completions sometime populate piecemeal. Accept the partial suggestion and the remainder will populate.
- Suggested completions from multiple providers will all appear as ghost text if you have multiple AI-based Inline Completion extensions enabled. Scroll through them to find the Einstein for Developer specific suggestion, or disable competing extensions as described in [setup](https://developer.salesforce.com/tools/vscode/en/einstein/einstein-setup).
