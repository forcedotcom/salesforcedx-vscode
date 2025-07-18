# Salesforce Extensions for VS Code

[![Dev Dependencies](https://img.shields.io/librariesio/github/forcedotcom/salesforcedx-vscode)](contributing/dependencies.md)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

## Introduction

This repository contains the source code for Salesforce Extensions for VS Code: the Visual Studio Code (VS Code) extensions for Salesforce DX.

Currently, we have the following extensions:

- [salesforcedx-vscode](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode)
  A top-level [extension pack](https://code.visualstudio.com/docs/extensionAPI/extension-manifest#_extension-packs) that automatically installs the following extensions for you.
- [salesforcedx-vscode-core](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-core)
  This extension interacts with the Salesforce CLI to provide basic Salesforce DX functionality.
- [salesforcedx-vscode-apex](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-apex)
  This extension uses the Apex Language Server to provide features such as syntax highlighting and code completion.
- [salesforcedx-vscode-apex-replay-debugger](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-apex-replay-debugger)
  This extension enables VS Code to replay Apex execution from Apex debug logs.
- [salesforcedx-vscode-lightning](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-lightning)
  This extension supports Aura component bundles. It uses the HTML language server from VS Code.
- [salesforcedx-vscode-visualforce](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-visualforce)
  This extension supports Visualforce pages and components. It uses the HTML language server from VS Code.
- [salesforcedx-vscode-soql](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-soql)
  This extension enables you to interactively build a SOQL query via a form-based visual editor, view the query as you build, and save the output to a .csv or .json file.
- [salesforcedx-vscode-slds](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforce-vscode-slds) This extension simplifies working with the Salesforce Lightning Design System (SLDS). It provides code completion, syntax highlighting, and validation with recommended tokens and utility classes.
- [salesforcedx-einstein-gpt](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-einstein-gpt) This extension uses generative AI to make Salesforce development in Visual Studio Code richer with features such as a Dev Assistant that helps with writing, documenting, and understanding code. It also provides inline autocompletion, and test case generation for Apex and LWC code.
- [sfdx-code-analyzer-vscode](https://marketplace.visualstudio.com/items?itemName=salesforce.sfdx-code-analyzer-vscode) This extension scans your code using multiple rule engines to produce lists of violations that you can use to improve your code. v5 also includes all the functionality of the ESLint and Apex PMD extensions. Now, the Salesforce Code Analyzer extension statically analyzes both your Apex and JavaScript code to quickly find problems.

## Be an Efficient Salesforce Developer with VS Code

Dreamforce 2018 session on how to use Visual Studio Code and Salesforce Extensions for VS Code:

[![Be An Efficient Salesforce Developer with VS Code](imgs/DF18_VSCode_Session_thumbnail.jpg)](https://www.youtube.com/watch?v=hw9LBvjo4PQ)

### Getting Started

If you are interested in contributing, please take a look at the [CONTRIBUTING](CONTRIBUTING.md) guide.

If you are interested in building the extensions locally, please take a look at the developing [doc](contributing/developing.md).

You can find more information about using the Salesforce Extensions for VS Code in the [public documentation](https://developer.salesforce.com/docs/platform/sfvscode-extensions/guide). If the docs don't cover what you are looking for, please feel free to open an issue.

For information about using the extensions, consult the README.md file for each package.

## Project Governance & Support

- [License (BSD-3-Clause)](LICENSE.txt)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [How to License](how_to_license.md)

For questions, issues, or support, please open an issue in this repository or refer to the documentation above.
