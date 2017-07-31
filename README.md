# Salesforce Development Tools for Visual Studio Code 

[![Build Status Linux and macOS](https://travis-ci.org/forcedotcom/salesforcedx-vscode.svg?branch=develop)](https://travis-ci.org/forcedotcom/salesforcedx-vscode)
[![Build status Windows](https://ci.appveyor.com/api/projects/status/n0ef03jpdl95jugj/branch/develop?svg=true)](https://ci.appveyor.com/project/guw/salesforcedx-vscode/branch/develop)
[![Dev Dependencies](https://david-dm.org/forcedotcom/salesforcedx-vscode/dev-status.svg)](docs/dependencies.md)

## Introduction

This repository contains the source code for our Visual Studio Code (VS Code)
extensions for Salesforce DX.

These extensions are currently in beta, which means they are high-quality
feature with known limitations. Salesforce Development Tools for Visual Studio
Code isn’t generally available unless or until Salesforce announces its general
availability in documentation or in press releases or public statements.

Currently, we have the following extensions:

* salesforcedx-vscode - A top level [extension
   pack](https://code.visualstudio.com/docs/extensionAPI/extension-manifest#_extension-packs)
   that will automatically install the following extensions for you.
* salesforcedx-vscode-core - This extension interacts with the Salesforce CLI to
  provide basic Salesforce DX functionality.
* salesforcedx-vscode-apex - This extension uses the Apex Language Server to
  provide features such as syntax highlighting and code completion.
* salesforcedx-vscode-lightning - This extension supports Lightning component
  bundles. It uses the HTML language server from VS Code.
* salesforcedx-vscode-visualforce - This extension supports Visualforce pages
  and components. It uses the HTML language server from VS Code.

We will be publishing these beta extensions to the VS Code Marketplace shortly
and will make an announcement when they are available.

## Getting Started

If you are interested in contributing, please take a look at the
[CONTRIBUTING](CONTRIBUTING.md) guide.

If you are interested in building the extensions locally, please take a look at
the publishing [doc](docs/publishing.md).

You can also find more documentation on the [docs](docs) folder. If the docs do
not cover what you are looking for, please feel free to open an issue.
