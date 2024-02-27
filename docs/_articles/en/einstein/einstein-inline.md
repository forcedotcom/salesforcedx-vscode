---
title: Automatic Inline Completions
lang: en
---

## Overview

Use AI-based autocomplete to accept suggestions for code as you write it right inside your editor. Inline autocompletions can currently be triggered in Apex, Javascript and HTML files.

## Enable or Disable Inline Autocomplete

To enable or disable the Inline autocomplete feature:

1. Select **File** > **Preferences** > **Settings** (Windows or Linux) or **Code** > **Preferences** > **Settings** (macOS).
2. Under **Einstein for Developers**, select **Enable Einstein Auto Completions** then select the language for which to enable the feature.

Inline autocomplete is enabled by default.

## Receive your First Inline Completions

Einstein for Developers automatically generates code and suggests completions for you as you type. When writing apex code, you are often doing things like assigning variable values to an `Sobject` such as `Account.name = abc`, or `Account.type = Business`. Pause the cursor after the variable value and watch Einstein for Developers complete your code for you and fill out the remaining fields.

![Inline Suggestions](./images/einstein-inline-create-account.png)

To accept an entire suggestion, press Tab. If you have VS Code's **Inline Suggest** enabled, you can accept the next word of the suggestion using one of the following keyboard shortcuts:

| Operating System | Accept Next Word |
| ---------------- | ---------------- |
| macOS            | ⌘→               |
| Windows          | ⌥→               |
| Linux            | ⌥→               |

**Note**: If you don't see a suggestion, make sure Einstein Auto Completions are enabled. Also, you can always trigger inline suggestions even if you don't have the Auto Completions enabled using the Option (⌥)\ hotkeys to manually generate autocomplete suggestions.
