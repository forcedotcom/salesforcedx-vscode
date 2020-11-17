---
title: SOQL Builder (Beta)
lang: en
---

SOQL Builder is a VS Code extension that eliminates the guesswork when building SOQL queries. With SOQL Query Builder, anyone can visually build, run, and explore results from queries. Build queries using clicks in a visual editor, then save and extend the queries using a text editor. You can instantly view query results, and then save the results to a `.csv` or `.json` file.

> Note: As a beta feature, SOQL Builder is a preview and isn’t part of the “Services” under your master subscription agreement with Salesforce. Use this feature at your sole discretion, and make your purchase decisions only on the basis of generally available products and features. Salesforce doesn’t guarantee general availability of this feature within any particular time frame or at all, and we can discontinue it at any time. This feature is for evaluation purposes only, not for production use. It’s offered as is and isn’t supported, and Salesforce has no liability for any harm or damage arising out of or in connection with it. All restrictions, Salesforce reservation of rights, obligations concerning the Services, and terms for related Non-Salesforce Applications and Content apply equally to your use of this feature. You can provide feedback and suggestions for SOQL Builder in the Salesforce Extensions for VS Code [GitHub issues repo](https://github.com/forcedotcom/salesforcedx-vscode/issues/new/choose).

During beta, you can build simple query statements that include:
* FROM clause for only one sObject type
* SELECT clause to pick fields from the selected sObject
* ORDER BY clause with support for ASC, DESC, NULLS FIRST, and NULLS LAST
* LIMIT clause

## Install the SOQL Builder Extension

Install and configure the required [Salesforce developer tooling](https://developer.salesforce.com/tools/vscode/en/getting-started/install) on your computer.
* Visual Studio Code
* Salesforce CLI
* Salesforce Extensions for VS code extension pack
* Java Platform, Standard Edition Development Kit

Next, install the SOQL Builder extension from [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-soql).

## Launch SOQL Builder

Launch SOQL Builder from within a Salesforce DX project.

### Prerequisites
* In VS Code, open a Salesforce DX project.
* Authorize the org whose objects you want to query.

DX projects have a sample `accounts.soql` file in the `<project-folder>/scripts/soql` directory. However, you can create and store your `.soql` files in any directory.

1. (If necessary) Create a `.soql` file.
1. Right-click the file name, select **Open With**, then **SOQL Builder**.

## Build a Query

As you build your query, watch SOQL Builder display the query syntax while it simultaneously updates the `.soql` file. After you’re done building your statements, click **Run Query** to view the output.

&&& PUT JONNY'S GIF HERE

**Beta Limitations:**
* SOQL Builder currently supports interactively building simple queries. We plan to add more functionality soon. However, you can still open a more complex `.soql` file and run the query from within SOQL Builder, but you must use a text editor to update it.
* The Run Query button gives no indication of status while it’s building the results. It can take several minutes to build a large result set. Try to resist the urge to click Run Query again.
* When selecting fields, you can select (click) only one at a time.
* Every time you click Run Query, a SOQL Query Results tab appears. There’s no way to associate the results with the specific query statements. The SOQL Builder editor reflects your most-recent updates.
* If you manually update the `.soql` file using a text editor, we don’t currently support any of the syntax validation that comes with the Apex Language Server. 

**Next**
* Save the `.soql` (text) file to avoid losing your updates.
* Save the query results output to a `.csv` or `.json` file.

## Save Query Results

You can save the query results in a `.csv` or `.json` file. The file is saved in `<project-dir>/scripts/soql/query-results` with a `.csv` or `.json` extension. This path is included in the `.gitignore` file so that you don’t deploy it to your org or include it in source control.  

### Beta Limitations

You can’t select the file name or where the query results file is saved. However, you can move it afterward.

If you click the **Save .csv** or **Save .json** button again, the previous file is overwritten. To avoid overwriting the file, save it to a different file name or move it to a different location.

## Known Issues

**Can’t Use SOQL Builder If Authentication to Default Org Has Expired**

**Description:** If the authentication token has expired for your default org, or your default scratch org has expired, SOQL Builder isn’t usable.

**Workaround:** Authorize a default org, then re-open the file in SOQL Builder. If that doesn’t work, restart VS Code.

**Switching Back to .soql File in Text Editor View Opens It in SOQL Builder**

**Description:** Let’s say you open a `.soql` file in SOQL Builder, and then open it in a text editor. If you click the SOQL Builder tab, then go back and click the text editor tab, the text editor switches to the SOQL Builder view.

**Workaround:** Reopen the `.soql` file in the text editor. 
