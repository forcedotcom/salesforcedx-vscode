---
title: Test Case Generation
lang: en
---

## Overview

Unit tests must cover at least 75% of your Apex code, and all of those tests must complete successfully for your code to be deployed or packaged for the Salesforce AppExchange. Use Einstein for Developers to quickly generate unit tests for your Apex classes.

![Test Case Generation](./images/einstein-tcg.gif)

## Enable or Disable Test Case Generation

To enable or disable the test case generation feature:

1. Select **File** > **Preferences** > **Settings** (Windows or Linux) or **Code** > **Preferences** > **Settings** (macOS).
2. Under **Einstein for Developers**, select **Enable Test Case Generation**.

Test case generation is enabled by default.

## Generate your First Unit Test

Use Einstein for Developers to quickly generate Apex unit tests.

1. From within a method in an Apex class, right-click and select **Einstein: Generate A Test**.
2. Select the method for which you want to generate unit tests.
3. When prompted, choose to create a new test class file or select an existing test class to which to add the test.
   If you choose to create a new file, the command uses the naming convention, `<ApexClassFileName>Test.cls` for the new file. The command adds the test method to the new file.
4. Review the generated unit test method and choose to `Accept`, `Try Again`, or `Clear`.
5. To generate another test method, right-click within the class file or the test class file and again select **Einstein: Generate A Test**. Select method(s) for which you want to generate a test. Then select the tests you want to inform Einstein for Developers about, and then click **OK**.
6. Again review the generated unit test method and choose to `Accept`, `Try Again`, or `Clear`.

## Hotkeys

You can generate a test using one of the following keyboard shortcuts:

| Operating System | Generate Test |
| ---------------- | ------------- |
| macOS            | ⌥ ⌘ T         |
| Windows          | ⌥ ⌘ T         |
| Linux            | ⌥ ⌘ T         |

## Known Issues

- Triggering a test from an Apex file could generate the same test over and over again. Generate subsequent tests from the test file to avoid this issue.
- Currently test data isn’t generated alongside a test generation.
