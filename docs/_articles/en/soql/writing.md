---
title: Write SOQL Queries
lang: en
---

Utilize the SOQL query snippet and see code-completion suggestions for your SOQL queries.

> NOTICE: The SOQL Language Server is currently in beta. If you find any bugs or have feedback, [open a GitHub issue](./en/bugs-and-feedback). See our [Roadmap](https://github.com/forcedotcom/salesforcedx-vscode/wiki/Roadmap) for more information.

## Developing with the SOQL Language Server

Before you can use the SOQL language server, you will first need to create a `.soql` file. It's recommended that this file live outside of the directories registered in your sfdx-project.json. The `.soql` file will not be something that you can deploy to your org. This `.soql` file is meant to be a temporary way for you to build and test your SOQL query prior to importing it into your Apex code.

## View Code-Completion Suggestions

Before you begin, run `SFDX: Refresh SObject Defintions` from the command palette. To see code-completion suggestions, press Ctrl+space when you’re working in a `.soql` file. To navigate between the suggestions, use the arrow keys. To auto-complete a suggestion from the list, press Enter.
![Animation showing code completion for a basic SOQL query](./images/soql-completion.gif)
