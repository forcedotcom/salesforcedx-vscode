---
title: Overview
lang: en
---

The Lightning Web Components Extension for VS Code leverages the editor's built-in code navigation and language features so that you can efficiently build Lightning web components.

Take advantage of the following Lightning Web Components Extension for VS Code features:

- [Code Completion](./en/lwc/writing#code-completion)
- [Linting](./en/lwc/writing#linting)
- [View Documentation on Hover](./en/lwc/writing#view-documentation-on-hover)
- [Code Navigation](./en/lwc/writing#code-navigation)

## Code Completion

The Lightning Web Components Extension builds on VS Code's language features for [HTML](https://code.visualstudio.com/docs/languages/html) and [JavaScript](https://code.visualstudio.com/docs/languages/javascript), including syntax highlighting, bracket matching, and language-specific code completions with IntelliSense. The extension provides code completion for the following Lightning Web Components resources.

### `@salesforce` Scoped Modules

Lightning components access Salesforce values via scoped modules. The Lightning Web Components Extension provides code completion for the following scoped modules:

- `@salesforce/resourceUrl`
- `@salesforce/contentAssetUrl`
- `@salesforce/apex`
- `@salesforce/user`

To learn more about `@salesforce` modules, see [`@salesforce` Modules](https://developer.salesforce.com/docs/component-library/documentation/lwc/lwc.reference_salesforce_modules) in the _Lightning Web Components Developer Guide_ for more information.

In this example, VS Code displays the possible static resource names to choose from when completing the `import` statement.

![Static Resource Completion](./images/vscode_lwc_staticresource_trailhead.png)

Here's what code completion looks like for `@salesforce/schema`.

![Schema Completion](./images/vscode_lwc_schema.png)

Here's an example of code completion for an Apex controller.

![Apex Completion](./images/vscode_lwc_apex.png)

### Lightning API

VS Code also completes Lightning API resources, such as `lightning/uiRecordApi` and `lightning/uiObjectInfoApi`. See the [`lightning/ui*Api` Wire Adapters and Functions](https://developer.salesforce.com/docs/component-library/documentation/lwc/lwc.reference_ui_api) in the _Lighting Web Components Developer Guide_ for more information.

![Lightning UI Completion](./images/vscode_lwc_lightningui.png)

### Lightning Web Components Syntax

VS Code completes the Lightning Web Components framework's reactive properties and wire service. See [Reactive Properties](https://developer.salesforce.com/docs/component-library/documentation/lwc/js_props_reactive) and [Use the Wire Service to Get Data](https://developer.salesforce.com/docs/component-library/documentation/lwc/lwc.data_wire_service_about) in the _Lightning Web Components Developer Guide_ for more information.

Here is an example of code completion for including the Apex function `getContactList` in the `@wire` decorator.

![Lightning @wire Completion](./images/vscode_lwc_wire.png)

### Namespace Completion in HTML Attributes and Tags

Code completion is also provided for HTML tags and attributes for components in the `lightning` and `c` namespaces. Here, with `c-view-source`, VS Code completes its `source` attribute.

![HTML Attribute Completion](./images/vscode_lwc_html_attr.png)

## View Documentation on Hover

VS Code displays documentation when you hover over a standard Lightning web component in the `lightning` namespace as well as the `c` namespace, if you provide documentation for your custom components. Here is the documentation that displays for `lightning-layout`. The dropdown also provides a link to view the component in the Component Library.

![Documentation on Hover](./images/vscode_lwc_hover.png)

## Linting

Linting provides errors about malformed or suspicious-looking code while you edit. VS Code enforces Salesforce's ESLint rules. To activate ESLint, install it from the command line. See the [Lightning Web Components ESLint Plugin](https://github.com/salesforce/eslint-plugin-lwc) and [Lightning Web Components ESLint Config](https://github.com/salesforce/eslint-config-lwc) repositories for instructions.

In this example, when hovering over `onpress`, the linter reports that you cannot name an API property starting with "on."

![Linter Example with Hover](./images/vscode_lwc_linting_press.png)

### Peek Problem and Quick Fix

VS Code has a range of actions to quickly address problems and refactor code, including Quick Fix and Peek Problem. To learn more, see [Refactoring](https://code.visualstudio.com/docs/editor/refactoring) in the VS Code documentation.

Clicking **Peek Problem** on the error message highlights the line where the linter found the error. If the message says there is more than one error, click the down arrow in the message's upper right corner to see the others.

![Linter Example with Peek](./images/vscode_lwc_peek.png)

Clicking **Quick Fix** provides options to disable the warning on valid API names in the line or in the file, and links to the documentation. You can see these same options by clicking on the yellow lightbulb icon next to `@api onpress;`.

![Linter Example with Quick Fix](./images/vscode_lwc_quickfix.png)

### Errors and Warnings

File and compiler errors display on hover. Here, when `@track` is hovered over, the error message says that it must be declared.

![Documentation on Hover](./images/vscode_lwc_track.png)

## Code Navigation

VS Code provides shortcuts to preview or jump to definitions within your code without losing track of the code you're currently working on. Learn more in the [Code Navigation](https://code.visualstudio.com/docs/editor/editingevolved) section of the VS Code documentation.

To preview a definition, hold down **Ctrl** (Windows or Linux) or **Command** (macOS) and hover over the item whose definition you want to see. This example shows a preview of the source of a `c` namespace component.

![View source of a c namespace component](./images/vscode_lwc_commandhover.png)

To view a definition, right-click the item and select **Peek Definition**, or press **Alt+F12**.

To jump to the location of a definition, right-click the item and select **Go to Definition**, or press **F12**.

## Supporting js-meta.xml

VS Code provides intellisense support through integrating XML VSCode extention by Red-hat for js-meta.xml. It supports features that comes out of the box by the extension, such as but not limited to auto suggestion, syntax error reporting, renaming support, automatic code generation and more.

![View suggestions for target in js-meta.xml](./images/vscode-lwc-jsmeta-intellisense.png)
