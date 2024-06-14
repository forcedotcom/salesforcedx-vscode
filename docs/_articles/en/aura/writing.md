---
title: Overview
lang: en
---

The Aura Components Extension for VS Code leverages the editor's built-in code navigation and language features so that you can efficiently build Aura components.

Take advantage of the following Aura Components Extension for VS Code features:

- [Code Completion](./en/aura/writing#code-completion)
- [View Documentation on Hover](./en/aura/writing#view-component-documentation-on-hover)
- [Linting](./en/aura/writing#linting)
- [Code Navigation](./en/aura/writing#code-navigation)
- [Outline view](./en/aura/writing#outline-view)

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

> NOTE: The linter throws an error when you include templating code inside of a CSS `style` tag. For example, this code sample will throw an error `<div style="{# 'background-image:url(' + v.url+ ')'}"> ... </div>`. The linter tries to validate the templating code as CSS. This is a known issue in the Aura LSP, and you can ignore the error.

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
