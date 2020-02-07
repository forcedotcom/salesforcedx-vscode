---
title: Overview
lang: en
---

The Aura Components Extension for VS Code leverages the editor's built-in code navigation and language features so that you can efficiently build Aura components. 

Take advantage of the following Aura Components Extension for VS Code features:

* [Code Completion](./en/aura/write-aura#code-completion)
* [Linting](./en/aura/write-aura#linting)
* [View Documentation on Hover](./en/aura/write-aura#view-documentation-on-hover)
* [Code Navigation](./en/lwc/write-lwc#code-navigation)

## Code Completion

The Aura Components Extension builds on VS Code's language features for [HTML](https://code.visualstudio.com/docs/languages/html) and [JavaScript](https://code.visualstudio.com/docs/languages/javascript), including syntax highlighting, bracket matching, and language-specific code completions with IntelliSense. The extension provides code completion for the following Lightning Web Components resources.

### Tags

![Aura Tag Completion](./images/vscode_aura_tag_completion.png)

- **Note:** If you have any Lightning Web Components in your workspace, those components will also appear in the list of suggested completions. The Lightning Web Component suggestions will be displayed with the proper Aura syntax.

### Attributes

![Aura Attribute Completion](./images/vscode_aura_attr_completion.png)

## View Component Documentation on Hover

Hovering over a component name or attribute shows component documentation in the editor, as well as links to the Component Library. You can see reference documentation for Aura components and Lightning web components nested within Aura components.

Here's reference documentation for the `lightning:card` component.
![Aura Component Reference](./images/vscode_aura_doc_on_hover.png)

## Linting 

Linting provides errors about malformed or suspicious-looking code while you edit. VS Code enforces Salesforce's ESLint rules. To activate ESLint, install it from the command line. See the [Lightning Web Components ESLint Plugin](https://github.com/salesforce/eslint-plugin-lwc) and [Lightning Web Components ESLint Config](https://github.com/salesforce/eslint-config-lwc) repositories for instructions. 

> NOTE: The linter throws an error when you include templating code inside of a CSS `style` tag. For example, this code sample will throw an error `<div style="{# 'background-image:url(' + v.url+ ')'}"> ... </div>`. The linter tries to validate the templating code as CSS. This is a known issue in the Aura LSP we are working to solve.

## Code Navigation


VS Code provides shortcuts to preview or jump to definitions within your code without losing track of the code you're currently working on. Learn more in the [Code Navigation](https://code.visualstudio.com/docs/editor/editingevolved) section of the VS Code documentation.

To preview a definition, hold down **Ctrl** (Windows or Linux) or **Command** (macOS) and hover over the item whose definition you want to see. This example shows a preview of the source of a `c` namespace component.

Here is a preview of the Lightning web components definition for `AuraPubSub` that is referenced in the Aura pubsub component. 
![View source of a c namespace component](./images/vscode_aura_goto.png)

To view a definition, right-click the item and select **Peek Definition**, or press **Alt+F12**.

To jump to the location of a definition, right-click the item and select **Go to Definition**, or press **F12**.


## Outline view

Outline view allows you to see the outline of your component—i.e. its HTML tags and JavaScript properties. Invoke it with Ctrl+Shift+O on Windows and Linux and Cmd+Shift+O on Mac.

![List of symbols in a .js file from an Aura bundle](./images/vscode_aura_outline.png)

## Lightning Explorer (Beta)

> NOTE: This feature is currently in beta. If you find any bugs or have feedback, [open a GitHub issue](./en/bugs-and-feedback).

Lightning Explorer lets you view reference documentation for both Aura components and Lightning web components. To enable it, go to **Preferences > Settings**. Enter `lightning explorer` in the search bar. Then, click the checkbox next to **salesforcedx-vscode-lightning:Show Lightning Explorer**.

![Show Lightning Explorer](./images/vscode_aura_lightning_explorer.png)

To use Lightning Explorer, click the lightning bolt icon on the left hand side of the screen. Click a namespace to see all of the available components. Lightning web components and Aura have different lightning icons.

![Click Lightning Explorer](./images/vscode_aura_explorer_example.png)
Under the c namespace, we've selected the Lightning web component `c-wire-get-object-info`. When you click on the name of the component, its corresponding file shows up in the main code panel.

Here's the Aura component `force:inputField`. The blue icon to the right of the component name opens your browser to the component reference in the Component Library.
![Open Component Library](./images/vscode_aura_explorer_docs.png)
Your custom Aura components and documentation are also available in the Aura Components extension. To learn more about writing documentation for your Aura components, see the [Lightning Aura Components Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/components_documentation.htm).
