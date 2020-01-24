---
title: Apex Language Server
lang: en
---

The Apex Language Server is an IDE-agnostic way for tools to access code-editing capabilities such as code completion, go to definition, find all usage, and refactoring. It provides a powerful way for Salesforce Extensions for VS Code to implement an Apex analyzer that’s also accessible to other IDEs.

The Apex Language Server is an implementation of the Language Server Protocol 3.0 [specification](https://github.com/Microsoft/language-server-protocol/blob/master/protocol.md). The Language Server Protocol allows a tool (in this case, VS Code) to communicate with a language smartness provider (the server). We built the Apex Language Server using this common specification to enable our tooling partners to improve the smartness of their tools.

For more information, watch the video of our Dreamforce ’17 presentation, [Building Powerful Tooling For All IDEs Through Language Servers](https://www.salesforce.com/video/1765282/).

[![Dreamforce '17 Presentation](./images/apex-language-server-presentation-dreamforce-17.png)](https://www.salesforce.com/video/1765282/)

## Installation

We recommend that you install the [Salesforce Extension Pack](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode) from the VS Code Marketplace. The extension pack includes the Apex Language Server and its integration with VS Code.

## Usage

See [Apex](./en/apex/writing).

## Clear the Cache

To clear the Apex Language Server's cache, delete the `PROJECT_DIR/.sfdx/tools/apex.db` file and restart VS Code.

## Integrate with the Apex Language Server

If you are a developer looking to integrate with the Apex Language Server, use the [apex-jorje-lsp.jar](https://github.com/forcedotcom/salesforcedx-vscode/blob/develop/packages/salesforcedx-vscode-apex/out/apex-jorje-lsp.jar) file.

See the [languageServer.ts](https://github.com/forcedotcom/salesforcedx-vscode/blob/develop/packages/salesforcedx-vscode-apex/src/languageServer.ts) file for an example of initializing and communicating with the Apex Language Server.

For more information, consult these resources:

- [Language Server Protocol Specification](https://github.com/Microsoft/language-server-protocol)
- [Language Server Protocol - Eclipse Newsletter May 2017](http://www.eclipse.org/community/eclipse_newsletter/2017/may/article1.php)
- [VS Code’s Implementation of the Language Server Protocol](https://github.com/Microsoft/vscode-languageserver-node)
- [Langserver.org - Information about other language servers and clients, e.g., Atom, Sublime, Vim, etc](http://langserver.org/)
