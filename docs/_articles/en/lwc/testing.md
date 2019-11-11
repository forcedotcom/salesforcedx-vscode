---
title: Test Lighting Web Components
lang: en
---

Install [`sfdx-lwc-jest`](https://developer.salesforce.com/docs/component-library/documentation/lwc/lwc.unit_testing_using_jest_installation) so that you have the Jest test runner for Lightning Web Components ready.

## Explore Your LWC Tests

The LWC Tests sidebar provides a central location for you to run tests on the code you write. You can run one test case, the test cases in one file, or all your tests. You can also view the results of the last tests run and navigate to the corresponding lines of code directly from the tests. To access the test sidebar, click the beaker icon (hover text: Test) in the View bar. If you don't see this icon, make sure the project you have open in VS Code contains an sfdx-project.json file in its root directory.

To run selected tests, hover over the name of a test case or file to reveal a play icon from the LWC test view. Click the play icon (hover text: SFDX: Run Lightning Web Component Test Case, SFDX: Run Lightning Web Component Test File) to run a test case or all the test cases in a file. To run all of tests in the view, click the larger play icon at the top of the LWC Tests view (hover text: SFDX: Run All Lightning Web Component Tests).

Test results are noted as follows: green for passing tests, red for failing tests, or orange for skipped tests.

To jump to a test file, or a test case, click the test name in the sidebar.

To clear your test results, click the refresh icon at the top of the sidebar (hover text: SFDX: Refresh Lightning Web Component Test Explorer).

## Run, Debug or Watch Jest Tests from Within a File

You can run or debug Jest unit tests in contextual actions within the file, or by clicking buttons from the menu bar in the top right corner of the editor window. View test results in the Terminal panel.

#### Run Jest Tests

To run individual Jest test cases, navigate to the `.test.js` file and click **Run Test** above the definition of a Jest test case.

To run all test cases in a Jest test file, click the play icon on the menu bar in the top right corner of the editor window.

#### Debug Jest Tests

To debug individual Jest test cases, navigate to the `.test.js` file and click **Debug Test** above the definition of a Jest test case.

To debug all test cases in a Jest test file, click the debug icon on the menu bar in the top right corner of the editor window.

VS Code's built-in debugger launches for you to debug the test in VS Code. You can set [Breakpoints](https://code.visualstudio.com/docs/editor/debugging#_breakpoints), control the debugging session by [Debug Actions](https://code.visualstudio.com/docs/editor/debugging#_debug-actions) or use [Debug Console](https://code.visualstudio.com/docs/editor/debugging#_debug-console-repl) to evaluate expressions.

#### Watch Jest Tests

To watch a Jest test file, click the eye icon on the menu bar in the top right corner of the editor window. Toggle the icon to stop watching. When watching a Jest test file, the test file will rerun if you edit the Jest test file or the LWC JavaScript files that the Jest test file is testing against.
