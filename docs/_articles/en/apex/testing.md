---
title: Apex Tests
lang: en
---

You can run Apex tests from within a file or from the Apex Tests sidebar. The sidebar provides other useful features for working with your tests.

## Explore Your Apex Tests

The Apex Tests sidebar provides several features. Here, you can see all your Apex tests at a glance. You can run one test method, the test methods in one class, or all your tests. You can view the results of your last test run. And you can jump from those results to the corresponding lines in your code. To access this sidebar, click the beaker icon (hover text: Test) in the view bar on the left side of the VS Code window. (If you don’t see this icon, make sure that the project you have open in VS Code contains an `sfdx-project.json` file in its root directory.)

To run selected tests, in the Apex Tests view, hover over the name of a test method or class to reveal a play icon. Click the play icon (hover text: Run Single Test) to run a test method or all the methods in a class. To run all your tests, click the larger play icon at the top of the Apex Tests view (hover text: Run Tests).

After you run tests, the blue icons next to your classes and methods change to green icons (for passing tests) or red icons (for failing tests). To see details about your test runs, hover over the name of a test class in the sidebar.

To jump to the definition of a test class, a test method that passed, or a method that you haven’t run yet, click its name in the sidebar. If you click the name of a failed test method, you jump to the assert statement that failed.

To clear your test results, click the refresh icon at the top of the sidebar (hover text: Refresh Tests).

## Run Apex Tests from Within a File

To run Apex tests, in your `.cls` file, click **Run Test** or **Run All Tests** above the definition of an Apex test method or class.  
![Running Apex tests using the Run Test and Run All Tests code lenses](./images/apex_test_run.gif)

Results from your test run display in the Output panel. The Failures section of the output lists stack traces for failed tests. To navigate to the line of code that caused a failure, press Ctrl (Windows or Linux) or Cmd (macOS) and click that stack trace.

After you run Apex tests, two new commands are available in the command palette: **SFDX: Re-Run Last Invoked Apex Test Class** and **SFDX: Re-Run Last Invoked Apex Test Method**.

To retrieve code coverage results when you run Apex tests, edit your workspace settings and set `salesforcedx-vscode-core.retrieve-test-code-coverage` to `true`.
