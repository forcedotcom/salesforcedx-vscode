---
title: SOQL Tasks
lang: en
---

This repository contains sample SOQL tasks that you can complete in Code Builder or VS Code using the Salesforce Extensions. We constantly add to this list, so make sure you visit this topic often.

## Create a Query That Lists Accounts with a New York State Address

1. From the Command Palette, run **SFDX: Create Query in SOQL Builder** to open SOQL Query Builder.
2. Click **File > Save** to save the file. Make sure to retain the .soql file extension.
3. Click the Switch Between SOQL Builder and Text Editors icon (<img src="./images/go-to-file.svg">) to reopen the SOQL Query Builder.
4. In the `From` field, search object, and select the `Account` object.
5. In `Fields`, select `Name`, `BillingState`, and `BillingCountry`.
6. In the `Filter` field, select `AND`, and set:
   `BillingCountry = USA`
   `AND`
   `BillingState = NY`
7. Click **Run Query**.

A Query Result tab pops up. You can then save the result in `csv` or `json` formats.

## Resources

- [Example SELECT Clauses](https://developer.salesforce.com/docs/atlas.en-us.236.0.soql_sosl.meta/soql_sosl/sforce_api_calls_soql_select_examples.htm)
- [Salesforce Object Query Language (SOQL)](https://developer.salesforce.com/docs/atlas.en-us.236.0.soql_sosl.meta/soql_sosl/sforce_api_calls_soql.htm)

Trailhead
– [Write SOQL Queries](https://trailhead.salesforce.com/content/learn/modules/apex_database/apex_database_soql)
