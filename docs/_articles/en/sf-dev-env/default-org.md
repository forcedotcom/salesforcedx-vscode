---
title: Change or Open Your Default Org
lang: en
---

Salesforce Extensions for VS Code runs commands against the org that you’ve set as your default org for development. In the [package development model](./en/user-guide/development-models#package-development-model), your default org is typically a scratch org. In the [org development model](./en/user-guide/development-models#org-development-model), it’s typically a sandbox, a Developer Edition (DE) org, or a Trailhead Playground.

To set or change the org that you’re developing against, in the VS Code footer, click the org’s name or the plug icon ({% octicon plug %}). Then, select a different org, or choose **SFDX: Set a Default Org** to authorize a new org. Or, open the Command Palette and run **SFDX: Authorize an Org** or **SFDX: Create a Default Scratch Org**.

To open your default org so that you can test your changes or use declarative tools, click the browser icon ({% octicon browser %}) in the footer. Or, open the Command Palette and run **SFDX: Open Default Org**.

To log out of the default org run **SDFX: Log Out from Default Org**.
