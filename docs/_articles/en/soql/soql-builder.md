---
title: SOQL Builder (Beta)
lang: en
---

SOQL Builder is a VS Code extension that eliminates the guesswork when building SOQL queries. With SOQL Query Builder, anyone can visually build, run, and explore results from queries. Build queries using clicks in a visual editor, then save and extend the queries using a text editor. You can instantly view query results, and then save the results to a `.csv` or `.json` file.

> **NOTICE:** SOQL Builder is currently in beta. If you find any bugs or have feedback, open a [GitHub issue](https://github.com/forcedotcom/soql-tooling/issues/new/choose). See our [Roadmap](https://github.com/forcedotcom/salesforcedx-vscode/wiki/Roadmap) for more information.

During beta, you can build simple query statements that include:

- FROM clause for only one sObject type
- SELECT clause to pick fields from the selected sObject
- WHERE clause to filter your data
- ORDER BY clause with support for ASC, DESC, NULLS FIRST, and NULLS LAST
- LIMIT clause

**Beta Limitations:**

- You can still run complex queries in SOQL Builder even if you see the Unsupported Syntax informational message.
- WHERE clauses can be quite complex. SOQL Editor supports simple WHERE expressions. You can combine conditions using AND or OR, but not both. SOQL Editor supports only one level of nesting.

## Install the SOQL Builder Extension

Install and configure the required [Salesforce developer tooling](https://developer.salesforce.com/tools/vscode/en/getting-started/install) on your computer.

- Visual Studio Code
- Salesforce CLI
- Salesforce Extensions for VS code extension pack
- Java Platform, Standard Edition Development Kit

Next, install the SOQL Builder extension from [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-soql).

## Launch SOQL Builder

Launch SOQL Builder from within a Salesforce DX project. How you launch SOQL Builder depends on if you have an existing `.soql` file or if you plan to create one.

### Prerequisites

- In VS Code, open a Salesforce DX project.
- Authorize the org whose objects you want to query.

### Open an Existing SOQL File in SOQL Builder

DX projects have a sample `accounts.soql` file in the `<project-folder>/scripts/soql` directory. However, you can create and store your `.soql` files in any directory.

1. (If necessary) Create a `.soql` file.
1. Right-click the file name, select **Open With**, then **SOQL Builder**.

![Right-click to open SOQL Builder](./images/soql-builder-open.gif)

### Launch SOQL Builder and Create a Query

1. From the command palette, run **SFDX: Create Query in SOQL Builder**.
1. Click **File > Save** to save the query. Make sure to retain the `.soql` file extension.

## Build a Query

As you build your query, watch SOQL Builder display the query syntax while it simultaneously updates the `.soql` file. After you’re done building your statements, click **Run Query** to view the output.

You can select objects and fields from the drop-down list, or type to narrow the list results. You can select an object or a field only once. If a value is already selected, it doesn't appear in the drop-down or search results.

![Build your query](./images/soql-builder.gif)

<!-- **Tip:** If using the text editor to build your query, you can validate your syntax by turning on the SOQL Editor Remote Checks setting. ekapner update, 2/2/2021: this setting not ready for GA-->

**Beta Limitations:**

- SOQL Builder currently supports interactively building simple queries. We plan to add more functionality soon. However, you can still open a more complex `.soql` file and run the query from within SOQL Builder, but you must use a text editor to update it.
- When selecting fields, you can select (click) only one at a time.
- Every time you click Run Query, a SOQL Query Results tab appears. There’s no way to associate the results with the specific query statements. The SOQL Builder editor reflects your most-recent updates.

**Next:**

- Save the `.soql` (text) file to avoid losing your updates.
- Save the query results output to a `.csv` or `.json` file.

## View Your Query in Both SOQL Builder and the Text Editor

Split your view to see your query in both SOQL Builder and the text editor.

1. Right-click the tab, then select one of the Split options.
1. Right-click on the new tab, select **Reopen Editor With**, then select **Text Editor**.

![Split your screen to see both SOQL Builder and Text Editor](./images/split-panels.gif)

## Switch Between SOQL Builder and Text Editor

You can easily toggle between viewing your SOQL statements in SOQL Builder and the text editor.

![Click the Switch Between SOQL Builder and Text Editor icon to toggle views](./images/soql-toggle.png)

## Save Query Results

You can save the query results in a `.csv` or `.json` file. The file is saved in `<project-dir>/scripts/soql/query-results` with a `.csv` or `.json` extension. This path is included in the `.gitignore` file so that you don’t deploy it to your org or include it in source control.

**Beta Limitations:**

- You can’t select the file name or where the query results file is saved. However, you can move it afterward.
- If you click the **Save .csv** or **Save .json** button again, the previous file is overwritten. To avoid overwriting the file, save it to a different file name or move it to a different location.

## Known Issues

### Syntax Error Message Blocks SOQL Builder Interface

**Description:** Sometimes, a popup error message blocks the SOQL Builder interface. Unfortunately, you can't continue editing the query. Until we fix this or provide a way to dismiss the window, the only option is to close the query without saving it.

### Can’t Use SOQL Builder If Authentication to Default Org Has Expired

**Description:** If the authentication token has expired for your default org, or your default scratch org has expired, SOQL Builder isn’t usable.

**Workaround:** Authorize a default org, then reopen the file in SOQL Builder. If that doesn’t work, restart VS Code.
