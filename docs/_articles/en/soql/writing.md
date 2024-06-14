---
title: Write SOQL Queries
lang: en
---

You can use the SOQL query snippet to see code completion suggestions for your SOQL queries.

To learn about how to use the Salesforce Object Query Language (SOQL), see [SOQL and SOSL Reference](https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/sforce_api_calls_soql.htm).

> NOTICE: SOQL Language support is currently in beta. If you find any bugs or have feedback, [open a GitHub issue](./en/bugs-and-feedback). See our [Roadmap](https://github.com/forcedotcom/salesforcedx-vscode/wiki/Roadmap) for more information.

## SOQL Files

VS Code supports writing SOQL in both Apex files and standalone `.soql` files. When writing `.soql` files, we recommend that the file is located outside the directories registered in your `sfdx-project.json` because this is not a file to deploy to your org. The purpose of the `.soql` file is to provide a way to build and test a SOQL query before you import it to your Apex code. By default, a new project has a folder `scripts/soql` that contains an example `accounts.soql` file. You can use this folder to save all of your SOQL queries.

## Code Completions

VS Code supports code completions for SOQL embedded in Apex files and `.soql` files. To use this feature, you must refresh the SObject definitions so that the SOQL language server can provide code completion suggestions. Run `SFDX: Refresh SObject Definitions` from the Command Palette.

- To navigate between the suggestions, use the arrow keys.
- To auto-complete from the suggestion, press Enter.

![Animation showing code completion for a basic SOQL query](./images/soql-completion.gif)

## Use SOQL Builder to Build and Run Queries
Use SOQL Builder to build and run your SOQL queries. See [SOQL Builder](https://developer.salesforce.com/tools/vscode/en/soql/soql-builder#build-a-query).

## Execute SOQL Text

To execute SOQL you can simply select the text and run the command `SFDX: Execute SOQL Query with Currently Selected Text`. You can choose to execute your query against the REST or Tooling APIs.

![SFDX: Execute SOQL Query with Currently Selected Text](./images/soql_text.png)

After the query is executed the results display in the output pane.

![SFDX: Execute SOQL Query with Currently Selected Text](./images/soql_results.png)

## Execute SOQL Inline

To write a query and execute it without saving it to a file, you can use the command `SFDX: Execute SOQL Query...` and enter the SOQL directly into the command bar. The results display in the output pane.

![SFDX: Execute SOQL Query...](./images/soql_command.png)
