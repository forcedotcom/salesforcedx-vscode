---
title: Test Lighting Web Components
lang: en
---

Install [`sfdx-lwc-jest`](https://developer.salesforce.com/docs/component-library/documentation/lwc/lwc.unit_testing_using_jest_installation) so that you have the Jest test runner for Lightning Web Components ready.

## Explore Your LWC Tests

The LWC Tests sidebar provides several features. Here, you can see all your LWC tests at a glance. You can run one test method, the test methods in one file, or all your tests. You can view the results of your last test run. And you can jump from those results to the corresponding lines in your code. To access this sidebar, click the beaker icon (hover text: Test) in the view bar on the left side of the VS Code window. (If you don’t see this icon, make sure that the project you have open in VS Code contains an sfdx-project.json file in its root directory.)
To run selected tests, in the LWC Tests view, hover over the name of a test case or file to reveal a play icon. Click the play icon (hover text: SFDX: Run Lightning Web Component Test Case, SFDX: Run Lightning Web Component Test File) to run a test case or all the test cases in a file. To run all your tests, click the larger play icon at the top of the LWC Tests view (hover text: SFDX: Run All Lightning Web Component Tests).
After you run tests, the blue icons next to your classes and methods change to green icons (for passing tests), or red icons (for failing tests), or orange icons (for skipped tests).
To jump to the test file, or a test case, click its name in the sidebar.
To clear your test results, click the refresh icon at the top of the sidebar (hover text: SFDX: Refresh Lightning Web Component Test Explorer).

## Run or Debug Jest Tests from Within a File

You can run or debug Jest unit tests in contextual actions within your file.

To run Jest tests, in your `.test.js` file, click **Run Test** above the definition of a Jest test case.
Results from your test run display in the Terminal panel.

To debug Jest tests, in your `.test.js` file, click **Debug Test** above the definition of a Jest test case.
VS Code's built-in debugger will launch and you can debug your test inside VS Code. You can set [Breakpoints](https://code.visualstudio.com/docs/editor/debugging#_breakpoints), control the debugging session by [Debug Actions](https://code.visualstudio.com/docs/editor/debugging#_debug-actions) or use [Debug Console](https://code.visualstudio.com/docs/editor/debugging#_debug-console-repl) to evaluate expressions.

## Run, Debug or Watch Jest Tests from Menu Bar

TODO
