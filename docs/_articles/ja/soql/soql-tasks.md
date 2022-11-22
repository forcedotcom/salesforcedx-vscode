---
title: SOQL Task
lang: en
---

This is a repository of sample tasks using SOQL that you can complete in Code Builder or VS Code Extensions for desktop. We’ll keep adding to this list, so make sure you visit this topic often. 


## Use the SOQL Query Editor Create a Query That Lists Accounts with a New York State Address

1. From the command palette, run **SFDX: Create Query in SOQL Builder** to open SOQL Query Builder.
2. Click **File > Save** to save the query. Make sure to retain the .soql file extension.
3. Click the Switch Between SOQL Builder and Text Editors icon ({% octicon go-to-file %}) to reopen the SOQL Query Builder.
4. In the `From` field, search object, and select the `Account` object.
5. In `Fields`, select `Name`, `BillingState`, and `BillingCountry`.
6. In the `Filter` field, select `AND`, and set:
    `BillingCountry = USA`
    `AND`
    `BillingState = NY`
7.   Click **Run Query**.
A Query Result tab pops up. You can then save the result in `csv` or `json` formats.


## Resources
- [Example SELECT Clauses | SOQL and SOSL Reference | Salesforce Developers](https://developer.salesforce.com/docs/atlas.en-us.236.0.soql_sosl.meta/soql_sosl/sforce_api_calls_soql_select_examples.htm)
- [Salesforce Object Query Language (SOQL) | SOQL and SOSL Reference](https://developer.salesforce.com/docs/atlas.en-us.236.0.soql_sosl.meta/soql_sosl/sforce_api_calls_soql.htm)

Trailhead
 – [Write SOQL Queries](https://trailhead.salesforce.com/content/learn/modules/apex_database/apex_database_soql)
