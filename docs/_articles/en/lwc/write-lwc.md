---
title: Write Lightning Web Components
lang: en
---

The Lightning Web Components Extension for VS Code leverages the editor's built-in code navigation and language features so that you can efficiently build Lightning web components. 

Take advantage of the following Lightning Web Components Extension for VS Code features:

Syntax highlighting and bracket matching // TODO 
[Smart code completions (IntelliSense)](#code-completion)
[Linting and corrections](#linting)
Code navigation (Go to Definition, Find All References) //TODO
[View Documentation on Hover](#view-documentation-on-hover)


## Code Completion

The Lightning Web Components Extension builds on VS Code's code completion capabilities by completing resource names in HTML and JavaScript files. 

VS Code completes static resources. In this example, it completes the `chartjs` object in the `libChartjs` component. `libChartjs` refers to the third-party JavaScript library [chartjs](https://www.chartjs.org/). Include it in your code by importing `loadScript` from the Lightning Web Components `platformResourceLoader` module. Then, add the statement `import chartjs from '@salesforce/resourceUrl/chart';`. Here, VS Code fills in the resource's name when we add it in the import statement.

![Static Resource Completion](./images/vscode_lwc_staticresource.png)

VS Code completes Lightning web components imports from the lwc module, as well the Lightning Web Components framework's reactive properties and wire service (add links to the LWC dev guide for both). Here, it completes `LightningElement`. When hovered over, `LightningElement` displays information about the `LightningElement` class. 

![LWC Module Completion](./images/vscode_lwc_js.png)

Code completion is also provided for HTML tags and attributes for components in the `lightning` and `c` namespaces. Here, with `c-view-source`, VS Code completes its source attribute.

![HTML Attribute Completion](./images/vscode_lwc_html_attr.png)

To view the source of a `c` namespace component, press **command** + **click**. 

![View Source of c Namespace](./images/vscode_lwc_viewsource.png)

## View Documentation on Hover

VS Code displays documentation when you hover over a standard Lightning web component in the `lightning` namespace as well as the `c` namespace, if you provide documentation for your custom components. Here is the documentation that displays for `lightning-layout`. The dropdown also provides a link to view the component in the Component Library.

![Documentation on Hover](./images/vscode_lwc_hover.png)

## Linting 

Linting provides errors about malformed or suspicious-looking code while you edit. VS Code enforces Salesforce's ESLint rules. To activate ESLint, install it from the command line. See the [github/salesforce/eslint-plugin-lwc] and [github/salesforce/eslint-config-lwc] repositories for instructions. 

In this example, when hovering over `onpress`, the linter reports that you cannot name an API property starting with "on."

![Linter Example with Hover](./images/vscode_lwc_linting_press.png)

Clicking **Peek Problem** on the error message highlights the line where the linter found the error. If the message says there is more than one error, click the down arrow in the message's upper right corner to see the others.

![Linter Example with Peek](./images/vscode_lwc_peek.png)

Clicking **Quick Fix** provides options to disable the warning on valid API names in the line or in the file, and links to the documentation. You can see these same options by clicking on the yellow lightbulb icon next to `@api onpress;`.

![Linter Example with Quick Fix](./images/vscode_lwc_quickfix.png)

File and compiler errors display on hover. Here, when `@track` is hovered over, the error message says that the use of track is invalid because it was not imported from `'lwc'`.

![Documentation on Hover](./images/vscode_lwc_compiler_error.png)


