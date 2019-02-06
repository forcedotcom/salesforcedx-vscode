# Lightning Web Components for Visual Studio Code

This extension provides code-editing features for the Lightning Web Components programming model, which is part of the Lightning Component framework. It uses the default HTML language server from VS Code to provide syntax highlighting, code completion, an outline view of your files, and a Salesforce Lightning Design System (SLDS) linter.

**Currently, this extension is not included in the [Salesforce Extension Pack](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode).**

## Prerequisites

Before you set up this extension

* Make sure that you have [Visual Studio Code](https://code.visualstudio.com/download) v1.26 or later.

* Install the [Salesforce Extension Pack](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode) to get all the required dependencies.

## Features Provided by This Extension

* Notification of HTML and JavaScript file errors or compiler warnings

* ESLint configuration for Lightning web components
    * See errors and warnings appear in JavaScript files
    * Hover over code to display warning messages
    * Click the displayed message for available code actions
  
* Auto-completion for resources in JavaScript files
    * Static resources
    * Custom label imports
    * Lightning web components imports from the core `lwc` module

* Auto-completion for resources in HTML files
    * Tags and attributes for standard `lightning` namespace Lightning web components
    * Tags and attributes for custom `c` namespace Lightning web components
    * Lightning web components directives in related HTML files
  
* Help documentation when you hover over standard `lightning` namespace Lightning web components or attributes

* Click navigation from HTML files to the main JavaScript file for custom `c` namespace Lightning web components and attributes
  

## Bugs and Feedback

To report issues with Salesforce Extensions for VS Code, open a [bug on GitHub](https://github.com/forcedotcom/salesforcedx-vscode/issues/new?template=Bug_report.md). If you would like to suggest a feature, create a [feature request on Github](https://github.com/forcedotcom/salesforcedx-vscode/issues/new?template=Feature_request.md).

## Resources

- Doc: [Lightning Web Components Developer Guide](https://component-library-dev.herokuapp.com/docs/component-library/documentation/lwc)
- Trailhead: [Lightning Web Components Quick Start](https://trailhead.salesforce.com/content/learn/projects/quick-start-lightning-web-components/)
- Trailhead: [Get Started with Salesforce DX](https://trailhead.salesforce.com/trails/sfdx_get_started)
- Doc: [Salesforce DX Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev)
- Doc: [Salesforce CLI Command Reference](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/)


---

Currently, Visual Studio Code extensions are not signed or verified on the Microsoft Visual Studio Code Marketplace. Salesforce provides the Secure Hash Algorithm (SHA) of each extension that we publish. Consult [Manually Verify the salesforcedx-vscode Extensions’ Authenticity](https://developer.salesforce.com/media/vscode/SHA256.md) to learn how to verify the extensions.

---
