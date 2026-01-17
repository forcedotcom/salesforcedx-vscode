/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { HumanReporter, TestResult } from '@salesforce/apex-node';
import * as vscode from 'vscode';
import { FAIL_RESULT, PASS_RESULT, SKIP_RESULT } from '../constants';
import { getTestName, isMethod } from './testItemUtils';

/**
 * Parses a stack trace string and returns a Location if the class and line number can be determined
 */
export const parseStackTrace = (
  stackTrace: string,
  classItems: Map<string, vscode.TestItem>
): vscode.Location | undefined => {
  // Try to parse line number from stack trace
  const lineMatch = stackTrace.match(/line (\d+)/);
  if (lineMatch) {
    const lineNumber = parseInt(lineMatch[1], 10) - 1; // Convert to 0-based
    // Try to find the file from the stack trace
    const fileMatch = stackTrace.match(/((?:[^.\n]+\.)*[^.\n]+)\.([^.\n]+):/);

    if (fileMatch) {
      const fullClassName = fileMatch[1]; // e.g., "namespace.MyTestClass" or "MyTestClass"

      // Try to find the class item by matching the full class name (with namespace)
      let classItem = Array.from(classItems.values()).find(item => item.label === fullClassName);

      // If not found, try matching just the last part (class name without namespace)
      // This handles cases where the classItems map only has the class name without namespace
      if (!classItem && fullClassName.includes('.')) {
        const classNameWithoutNamespace = fullClassName.split('.').pop();
        if (classNameWithoutNamespace) {
          classItem = Array.from(classItems.values()).find(item => item.label === classNameWithoutNamespace);
        }
      }

      if (classItem?.uri) {
        return new vscode.Location(classItem.uri, new vscode.Range(lineNumber, 0, lineNumber, 0));
      }
    }
  }
  return undefined;
};

type UpdateTestRunResultsOptions = {
  result: TestResult;
  run: vscode.TestRun;
  testsToRun: vscode.TestItem[];
  methodItems: Map<string, vscode.TestItem>;
  classItems: Map<string, vscode.TestItem>;
  codeCoverage?: boolean;
};

/** Updates test run results in the Test Explorer UI */
export const updateTestRunResults = ({
  result,
  run,
  testsToRun,
  methodItems,
  classItems,
  codeCoverage = false
}: UpdateTestRunResultsOptions): void => {
  const humanOutput = new HumanReporter().format(result, codeCoverage, false);
  if (humanOutput) {
    // Split by lines and add each line separately with \r\n to ensure newlines are preserved
    // This is important for table formatting in VS Code's Test Results panel
    const lines = humanOutput.split('\n');
    for (const line of lines) {
      run.appendOutput(`${line}\r\n`);
    }
  } else {
    // Fallback if HumanReporter returns empty - at least show summary
    run.appendOutput(
      `Test execution completed. Tests ran: ${result.summary.testsRan ?? 0}, Passed: ${result.summary.passing ?? 0}, Failed: ${result.summary.failing ?? 0}\r\n`
    );
  }

  // Build a map of test names to test items from all available items
  // This ensures we can match results even if the suite wasn't expanded
  const testMap = new Map<string, vscode.TestItem>();

  // Add all method items to the map (keyed by full name: Class.Method)
  for (const [methodName, methodItem] of methodItems) {
    testMap.set(methodName, methodItem);
  }

  // Also add items from testsToRun (for methods that might not be in methodItems yet)
  for (const test of testsToRun) {
    if (isMethod(test.id)) {
      const testName = getTestName(test);
      testMap.set(testName, test);
    }
  }

  // Update results from TestResult
  for (const testResult of result.tests) {
    const { name, namespacePrefix } = testResult.apexClass;
    const apexClassName = namespacePrefix ? `${namespacePrefix}.${name}` : name;
    const fullTestName = `${apexClassName}.${testResult.methodName}`;

    const testItem = testMap.get(fullTestName);
    if (testItem) {
      const outcomeStr = testResult.outcome.toString();
      if (outcomeStr === PASS_RESULT) {
        run.passed(testItem, testResult.runTime);
      } else if (outcomeStr === FAIL_RESULT) {
        // Format the error message with both message and stack trace
        const errorMessage = testResult.message ?? '';
        const stackTrace = testResult.stackTrace ?? '';
        const fullMessage =
          errorMessage && stackTrace ? `${errorMessage}\n\n${stackTrace}` : errorMessage || stackTrace || 'Test failed';

        const message = new vscode.TestMessage(fullMessage);

        // Set location for clickable link - this makes the stack trace line clickable in the Test Results panel
        // When you click on a failed test, the location appears as a clickable link
        if (stackTrace) {
          const location = parseStackTrace(stackTrace, classItems);
          if (location) {
            message.location = location;
          }
        }

        run.failed(testItem, message, testResult.runTime);
      } else if (outcomeStr === SKIP_RESULT) {
        run.skipped(testItem);
      }
    } else {
      // Test result doesn't match any known test item
      // This can happen if the test was run as part of a suite but isn't in our tree
      console.debug(`Test result for ${fullTestName} doesn't match any test item. Available items: ${testMap.size}`);
    }
  }
};
