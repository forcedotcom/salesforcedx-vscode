---
title: Apex Tests
---

Apex extension allows you to run Apex tests to verify the functionality of your code. You can retrieve code coverage results for your Apex classes and triggers every time you run one or more tests. To do this, [edit your workspace settings](https://code.visualstudio.com/docs/getstarted/settings) and set `salesforcedx-vscode-core.retrieve-test-code-coverage` to **true**.

## Explore Your Apex Tests

The Test view in the Side Bar provides several features such as LWC Tests and Apex Tests. To access the Test view, click the beaker icon ({% octicon beaker %}) in the Activity Bar on the left side of the VS Code editor. If you don’t see this icon, make sure that the project contains an `sfdx-project.json` file in its root directory. If the Test view is empty, check if the [Java setup](../getting-started/java-setup) is configured correctly.

Use the Apex Tests feature to run one test method, test methods in one class, or all your Apex tests.

- Run Tests

  - Run a test for a single method: Hover over the name of a test method and click the play icon (hover text: Run Single Test).
  - Run tests for all the methods in a class: Hover over the name of a test class and click the play icon (hover text: Run Tests).
  - Run all tests: Hover over the Apex Tests view and click the play icon ({% octicon play %}).

After you run Apex tests, SFDX: Re-Run Last Invoked Apex Test Class and SFDX: Re-Run Last Invoked Apex Test Method commands are available in the Command Palette.

- View Test Results

  - For passing tests, the blue icons next to the classes and methods change to green icons.
  - For failing test, the icons turn red.

To see the details of your test runs, hover over the name of a test class in the Side Bar.

- Go to Test Class Definitions

To jump to the definition of a test class, a test method that passed, or a method that you haven’t run yet, click its name. If you click the name of a failed test method, you jump to the line where the failure occurred.

- Clear Test Results

To clear the test results, click the refresh icon at the top of the Apex Tests view (hover text: Refresh Tests).

- Refresh Apex Tests View

If you've added methods or classes since the last time the Test view was populated, click the refresh icon at the top of the Apex Tests view for the updated list.

## Run Apex Tests from Within a File

You can run Apex tests from the class file open in the editor window. Click **Run Test** above the definition of an Apex test method or **Run All Tests** above the definition of an Apex test class. You can view the test results in the Output panel and the Failures section of the output lists stack traces for failed tests. To navigate to the line of code that caused a failure, press Ctrl (Windows or Linux) or Cmd (macOS) and click that stack trace.

![Running Apex tests using the Run Test and Run All Tests code lenses](../../images/apex_test_run.gif)
