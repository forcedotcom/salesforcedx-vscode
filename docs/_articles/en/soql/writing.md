---
title: Write SOQL Queries
lang: en
---

You can use the SOQL query snippet to see code completion suggestions for your SOQL queries.

To learn about how to use the Salesforce Object Query Language (SOQL), see [SOQL and SOSL Reference](https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/sforce_api_calls_soql.htm).

> NOTICE: The SOQL Language Server is currently in beta. If you find any bugs or have feedback, [open a GitHub issue](./en/bugs-and-feedback). See our [Roadmap](https://github.com/forcedotcom/salesforcedx-vscode/wiki/Roadmap) for more information.

## Develop with the SOQL Language Server

To develop with the SOQL language server, create a `.soql` file. We recommend that the `soql` file is located outside the directories registered in your `sfdx-project.json` because this is not a file to deploy to your org. The purpose of the `.soql` file is to provide a way to build and test SOQL query before you import it to your Apex code.

## View Code Completion Suggestions

You must refresh the SObject definitions so that the SOQL language server can provide code completion suggestions. Run `SFDX: Refresh SObject Definitions` from the Command Palette.

- To see code completion suggestions, press Ctrl+space when you’re working in a `.soql` file.
- To navigate between the suggestions, use the arrow keys.
- To auto-complete from the suggestion, press Enter.

![Animation showing code completion for a basic SOQL query](./images/soql-completion.gif)
