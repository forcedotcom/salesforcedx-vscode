---
title: Overview
lang: ja
---

## Salesforce Functions

Use the Salesforce Functions features in VS Code to build event-driven, elastically scalable apps and experiences. You can create and test functions against sample payloads locally in VS Code.

### Create Function

Run `SFDX: Create Function` to create a Salesforce Function in Javascript or Java in a Salesforce DX project.

This command creates a new directory named after your Function name and all the supporting files.

- VS Code creates the basic scaffolding that contains files with some rudimentary, boilerplate code and supporting metadata.
- The `package.json` file contains information about dependencies.

![Create Function](./images/vs_code_create_func.gif)

### Start Function

Run `SFDX: Start Function` to run the function locally.

### Invoke Function

The Salesforce extensions add the `Invoke` and `Debug Invoke` CodeLens to a file that is in the correct format to send test events to a Function that is running locally. With one click, you can test a function that is running, by invoking it with a mock payload. You can also debug the function against the payload.

A sample `payload.json` file that can invoke a function:

![Invoke Debug ](./images/vscode_func_payload.png)

### Stop Function

Stop a function by running `SFDX: Stop Function`, which simply kills the local process.

### Resources

For more information see [Get Started with Salesforce Functions](https://developer.salesforce.com/docs/platform/functions/guide/index.html).
