---
title: Write SOQL Queries
lang: en
---

You can use the SOQL query snippet to see code completion suggestions for your SOQL queries.

> NOTICE: The SOQL Language Server is currently in beta. If you find any bugs or have feedback, [open a GitHub issue](./en/bugs-and-feedback). See our [Roadmap](https://github.com/forcedotcom/salesforcedx-vscode/wiki/Roadmap) for more information.

## Develop with the SOQL Language Server

To develop with the SOQL language server, create a `.soql` file. We recommend that the `soql` file is located outside the directories registered in your `sfdx-project.json` because this is not a file to deploy to your org. The purpose of the `.soql` file is to provide a way to build and test SOQL query before you import it to your Apex code.

## View Code Completion Suggestions

Before you begin, run `SFDX: Refresh SObject Defintions` from the command palette. To see code-completion suggestions, press Ctrl+space when you’re working in a `.soql` file. To navigate between the suggestions, use the arrow keys. To auto-complete a suggestion from the list, press Enter.
![Animation showing code completion for a basic SOQL query](./images/soql-completion.gif)
