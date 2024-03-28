---
title: Test Case Generation
lang: en
---

## Overview

Unit tests must cover at least 75% of your Apex code, and all of those tests must complete successfully for your code to be deployed or packaged for the Salesforce AppExchange. Use Einstein for Developers to quickly generate unit tests for your Apex classes. Test case generation is enabled by default.

![Test Case Generation](./images/einstein-tcg.gif)


## Generate your First Unit Test

Use Einstein for Developers to quickly generate Apex unit tests.

1. From within a method in an Apex class, right-click and select **Einstein: Generate A Test** or click the beaker icon on the top right.
2. Select the method for which you want to generate unit tests.
3. When prompted, choose to create a new test class file or select an existing test class to which to add the test.
   If you choose to create a new file, the command uses the naming convention, `<ApexClassFileName>Test.cls` for the new file. The command adds the test method to the new file.
4. Review the generated unit test method and choose to `Accept`, `Try Again`, or `Clear`.
5. To generate another test method, right-click within the class file or the test class file and again select **Einstein: Generate A Test**.
6. Select method(s) for which you want to generate a test. 
Einstein uses the context of existing tests to create new tests that do not duplicate the code that you already have. Select only the tests you want to inform Einstein for Developers about, and then click **OK**.
8. Again review the generated unit test method and choose to `Accept`, `Try Again`, or `Clear`.

## Hotkeys

You can generate a test using one of the following keyboard shortcuts:

| Operating System | Generate Test |
| ---------------- | ------------- |
| macOS            | ⌥ ⌘ T         |
| Windows          | ⌥ ⌘ T         |
| Linux            | ⌥ ⌘ T         |

## Known Issues
*  It's important that you accurately select existing related tests in your project when you generate additional tests. This gives Einstein additional context to work with. Not doing this can cause the AI to generate duplicate test methods.
*  Currently, selecting too many tests can throw an `exceeding token budget` error. Selecting fewer tests might cause generation of duplicate test methods. We are aware of this issue and are actively working on a fix.
* Currently test data isn’t generated alongside a test generation.

