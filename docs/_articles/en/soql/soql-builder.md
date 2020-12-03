---
title: SOQL Builder (Beta)
lang: en
---

SOQL Builder is a VS Code extension that eliminates the guesswork when building SOQL queries. With SOQL Query Builder, anyone can visually build, run, and explore results from queries. Build queries using clicks in a visual editor, then save and extend the queries using a text editor. You can instantly view query results, and then save the results to a `.csv` or `.json` file.

> **NOTICE:** SOQL Builder is currently in beta. If you find any bugs or have feedback, open a [GitHub issue](https://github.com/forcedotcom/soql-tooling/issues/new/choose). See our [Roadmap](https://github.com/forcedotcom/salesforcedx-vscode/wiki/Roadmap) for more information.

During beta, you can build simple query statements that include:

- FROM clause for only one sObject type
- SELECT clause to pick fields from the selected sObject
- ORDER BY clause with support for ASC, DESC, NULLS FIRST, and NULLS LAST
- LIMIT clause

## Install the SOQL Builder Extension

Install and configure the required [Salesforce developer tooling](https://developer.salesforce.com/tools/vscode/en/getting-started/install) on your computer.

- Visual Studio Code
- Salesforce CLI
- Salesforce Extensions for VS code extension pack
- Java Platform, Standard Edition Development Kit

Next, install the SOQL Builder extension from [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-soql).

## Launch SOQL Builder

Launch SOQL Builder from within a Salesforce DX project.

### Prerequisites

- In VS Code, open a Salesforce DX project.
- Authorize the org whose objects you want to query.

DX projects have a sample `accounts.soql` file in the `<project-folder>/scripts/soql` directory. However, you can create and store your `.soql` files in any directory.

1. (If necessary) Create a `.soql` file.
1. Right-click the file name, select **Open With**, then **SOQL Builder**.

![Right-click to open SOQL Builder](./images/soql-builder-open.gif)

## Build a Query

As you build your query, watch SOQL Builder display the query syntax while it simultaneously updates the `.soql` file. After you’re done building your statements, click **Run Query** to view the output.

![Build your query](./images/soql-builder.gif)

**Beta Limitations:**

- SOQL Builder currently supports interactively building simple queries. We plan to add more functionality soon. However, you can still open a more complex `.soql` file and run the query from within SOQL Builder, but you must use a text editor to update it.
- The Run Query button gives no indication of status while it’s building the results. It can take several minutes to build a large result set. Try to resist the urge to click Run Query again.
- When selecting fields, you can select (click) only one at a time.
- Every time you click Run Query, a SOQL Query Results tab appears. There’s no way to associate the results with the specific query statements. The SOQL Builder editor reflects your most-recent updates.
- If you manually update the `.soql` file using a text editor, we don’t currently support any of the syntax validation that comes with the Apex Language Server.

**Next:**

- Save the `.soql` (text) file to avoid losing your updates.
- Save the query results output to a `.csv` or `.json` file.

## View Your Query in Both SOQL Builder and the Text Editor

Split your view to see your query in both SOQL Builder and the text editor.

1. Right-click the tab, then select one of the Split options.
1. Right-click on the new tab, select **Reopen Editor With**, then select **Text Editor**.

![Split your screen to see both SOQL Builder and Text Editor](./images/split-panels.gif)

## Save Query Results

You can save the query results in a `.csv` or `.json` file. The file is saved in `<project-dir>/scripts/soql/query-results` with a `.csv` or `.json` extension. This path is included in the `.gitignore` file so that you don’t deploy it to your org or include it in source control.

**Beta Limitations:**

- You can’t select the file name or where the query results file is saved. However, you can move it afterward.
- If you click the **Save .csv** or **Save .json** button again, the previous file is overwritten. To avoid overwriting the file, save it to a different file name or move it to a different location.

## Known Issues

### Can’t Use SOQL Builder If Authentication to Default Org Has Expired

**Description:** If the authentication token has expired for your default org, or your default scratch org has expired, SOQL Builder isn’t usable.

**Workaround:** Authorize a default org, then re-open the file in SOQL Builder. If that doesn’t work, restart VS Code.

### Switching Back to .soql File in Text Editor View Opens It in SOQL Builder

**Description:** Let’s say you open a `.soql` file in SOQL Builder, and then open it in a text editor. If you click the SOQL Builder tab, then go back and click the text editor tab, the text editor switches to the SOQL Builder view.

**Workaround:** Reopen the `.soql` file in the text editor.
