---
title: SOQL Builder (Beta)
lang: en
---

SOQL Builder is a VS Code extension that eliminates the guesswork when building SOQL queries. With SOQL Query Builder, anyone can visually build, run, and explore results from queries. Build queries using clicks in a visual editor, then save and extend the queries using a text editor. You can instantly view query results, and then save the results to a `.csv` or `.json` file.

> **NOTICE:** SOQL Builder is currently in beta. If you find any bugs or have feedback, open a [GitHub issue](https://github.com/forcedotcom/soql-tooling/issues/new/choose). See our [Roadmap](https://github.com/forcedotcom/salesforcedx-vscode/wiki/Roadmap) for more information.

During beta, you can build simple query statements that include:

- FROM clause for only one sObject type
- SELECT clause to pick fields from the selected sObject, or COUNT() to perform an aggregation of the results
- WHERE clause to filter your data
- ORDER BY clause with support for ASC, DESC, NULLS FIRST, and NULLS LAST
- LIMIT clause

  To dig deeper regarding SOQL syntax or to build more complex queries in the text editor, see the [SOQL and SOSL Reference guide](https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/sforce_api_calls_soql_sosl_intro.htm).

**Beta Limitations:**

- You can still run complex queries in SOQL Builder even if you see the Unsupported Syntax informational message.
- WHERE clauses can be quite complex. SOQL Builder supports simple WHERE expressions. You can combine conditions using AND or OR, but not both.

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
1. Click on the `.soql` file.
1. Click the **Switch Between SOQL Builder and Text Editor** icon.

![Click the Switch Between SOQL Builder and Text Editor button to open the .soql file in SOQL Builder](./images/soql-builder-open.gif)

You can also open a `.soql` file in SOQL Builder from the VS Code menu. Right-click the file name, select **Open With**, then **SOQL Builder**.

### Launch SOQL Builder and Create a Query

1. From the command palette, run **SFDX: Create Query in SOQL Builder**.
1. Click **File > Save** to save the query. Make sure to retain the `.soql` file extension.

## Build a Query

As you build your query, watch SOQL Builder display the query syntax while it simultaneously updates the `.soql` file. After you’re done building your statements, click **Run Query** to view the output.

You can select objects and fields from the drop-down list, or type to narrow the list results. You can select an object or a field only once. If a value is already selected, it doesn't appear in the drop-down or search results.

![Build your query](./images/soql-builder-build-a-query.gif)

### Filter with the LIKE Operator

When filtering your results, you can narrow and target those results even further by using the LIKE operator using wildcards to match partial text strings. This query returns only last names that start with with `mc`.

```
SELECT AccountId, FirstName, lastname
FROM Contact
WHERE lastname LIKE 'mc%'
```

You can build your own filter using LIKE, or you can select one of these pre-built options.

- starts with
- ends with
- contains

### View COUNT Results

Because COUNT() is an aggregate function, all other selected fields are removed. If you didn't intend to select COUNT, you can undo the action from the main menu. You can further refine the results by adding filters (WHERE clauses). When you run the query, the number of returned rows corresponds to the total number of records. In this example, the COUNT is 3.

![Total number of records is the COUNT](./images/soql-builder-count.png)

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

![Split your screen to see both SOQL Builder and Text Editor](./images/soql-builder-split-panels.gif)

## Save Query Results

<!-- ekapner, 2/25, update, moved section closer to graphic that shows the save icons  -->

Click one of the Save icons to save the query results in a `.csv` or `.json` file in the location of your choice. Include any paths to saved files in the `.gitignore` file so that you don’t deploy it to your org or include it in source control.

## Switch Between SOQL Builder and Text Editor

You can easily toggle between viewing your SOQL statements in SOQL Builder and the text editor.

![Click the Switch Between SOQL Builder and Text Editor icon to toggle views](./images/soql-toggle.png)

## Known Issues

### Can’t Use SOQL Builder If Authentication to Default Org Has Expired

**Description:** If the authentication token has expired for your default org, or your default scratch org has expired, SOQL Builder isn’t usable.

**Workaround:** Authorize a default org, then reopen the file in SOQL Builder. If that doesn’t work, restart VS Code.
