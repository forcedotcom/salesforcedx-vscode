# Salesforce Development Tools for Visual Studio Code 

[![Build Status Linux and macOS](https://travis-ci.org/forcedotcom/salesforcedx-vscode.svg?branch=develop)](https://travis-ci.org/forcedotcom/salesforcedx-vscode)
[![Build status Windows](https://ci.appveyor.com/api/projects/status/n0ef03jpdl95jugj/branch/develop?svg=true)](https://ci.appveyor.com/project/guw/salesforcedx-vscode/branch/develop)
[![Dev Dependencies](https://david-dm.org/forcedotcom/salesforcedx-vscode/dev-status.svg)](docs/dependencies.md)

## Introduction

This repository contains the source code for Salesforce Development Tools for Visual Studio Code: the Visual Studio Code (VS Code) extensions for Salesforce DX.

This release contains a beta version of Salesforce Development Tools for Visual Studio Code, which means it’s a high-quality feature with known limitations. Salesforce Development Tools for Visual Studio Code isn’t generally available unless or until Salesforce announces its general availability in documentation or in press releases or public statements. We can’t guarantee general availability within any particular time frame or at all. Make your purchase decisions only on the basis of generally available products and features. You can provide feedback and suggestions for Salesforce Development Tools for Visual Studio Code in the [Salesforce DX Beta](https://success.salesforce.com/_ui/core/chatter/groups/GroupProfilePage?g=0F93A000000HTp1) group in the Success Community.

Currently, we have the following extensions:

* [salesforcedx-vscode](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode)  
   A top-level [extension pack](https://code.visualstudio.com/docs/extensionAPI/extension-manifest#_extension-packs) that automatically installs the following extensions for you.  
* [salesforcedx-vscode-core](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-core)  
   This extension interacts with the Salesforce CLI to provide basic Salesforce DX functionality.
* [salesforcedx-vscode-apex](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-apex)  
   This extension uses the Apex Language Server to provide features such as syntax highlighting and code completion.
* [salesforcedx-vscode-lightning](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-lightning)  
   This extension supports Lightning component bundles. It uses the HTML language server from VS Code.
* [salesforcedx-vscode-visualforce](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-visualforce)  
   This extension supports Visualforce pages and components. It uses the HTML language server from VS Code. 

## Getting Started

If you are interested in contributing, please take a look at the [CONTRIBUTING](CONTRIBUTING.md) guide.

If you are interested in building the extensions locally, please take a look at the publishing [doc](docs/publishing.md).

You can find more information about developing Salesforce Development Tools for Visual Studio Code in the [docs](docs) folder. If the docs don’t cover what you are looking for, please feel free to open an issue. 

For information about using the extensions, consult the README.md file for each package.
