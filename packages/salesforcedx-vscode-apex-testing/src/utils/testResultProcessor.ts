/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { HumanReporter, TestResult } from '@salesforce/apex-node';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { FAIL_RESULT, PASS_RESULT, SKIP_RESULT } from '../constants';
import { nls } from '../messages';
import { getTestName, isClass, isMethod, isSuite } from './testItemUtils';

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

      const items = Array.from(classItems.values());
      // Try to find the class item by matching the full class name (with namespace);
      // if not found, fall back to matching just the last part (class name without namespace).
      // This handles cases where the classItems map only has the class name without namespace.
      const classNameWithoutNamespace = fullClassName.includes('.') ? fullClassName.split('.').pop() : undefined;
      const classItem =
        items.find(item => item.label === fullClassName) ??
        (classNameWithoutNamespace ? items.find(item => item.label === classNameWithoutNamespace) : undefined);

      if (classItem?.uri) {
        return new vscode.Location(classItem.uri, new vscode.Range(lineNumber, 0, lineNumber, 0));
      }
    }
  }
  return undefined;
};

/**
 * Updates test run results in the Test Explorer UI
 */
export const updateTestRunResults = (params: {
  result: TestResult;
  run: vscode.TestRun;
  testsToRun: vscode.TestItem[];
  methodItems: Map<string, vscode.TestItem>;
  classItems: Map<string, vscode.TestItem>;
  codeCoverage?: boolean;
  concise?: boolean;
}): void => {
  const { result, run, testsToRun, methodItems, classItems, codeCoverage = false, concise = false } = params;
  const humanOutput = new HumanReporter().format(result, codeCoverage, concise);
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

  // Add all method items keyed by stripped name (Class.Method) for result matching
  for (const [, methodItem] of methodItems) {
    testMap.set(getTestName(methodItem), methodItem);
  }

  // Also add items from testsToRun (for methods that might not be in methodItems yet)
  // Recursively collect all method items under suites/classes to ensure results propagate
  const collectMethods = (item: vscode.TestItem): void => {
    if (isMethod(item.id)) {
      const testName = getTestName(item);
      testMap.set(testName, item);
    } else {
      // Recursively traverse children to find all method items
      item.children.forEach(child => collectMethods(child));
    }
  };

  for (const test of testsToRun) {
    collectMethods(test);
  }

  // Track results per class for proper aggregation
  const classResults = new Map<string, { passed: number; failed: number; skipped: number; duration: number }>();

  // Update results from TestResult
  for (const testResult of result.tests) {
    const { name, namespacePrefix } = testResult.apexClass;
    const apexClassName = namespacePrefix ? `${namespacePrefix}.${name}` : name;
    const fullTestName = `${apexClassName}.${testResult.methodName}`;

    const testItem = testMap.get(fullTestName);
    if (testItem) {
      const outcomeStr = testResult.outcome.toString();
      const runTime = testResult.runTime ?? 0;

      // Track results per class for aggregation
      if (!classResults.has(apexClassName)) {
        classResults.set(apexClassName, { passed: 0, failed: 0, skipped: 0, duration: 0 });
      }
      const classResult = classResults.get(apexClassName)!;

      if (outcomeStr === PASS_RESULT) {
        run.passed(testItem, runTime);
        classResult.passed++;
        classResult.duration += runTime;
      } else if (outcomeStr === FAIL_RESULT) {
        // Format the error message with both message and stack trace
        const errorMessage = testResult.message ?? '';
        const stackTrace = testResult.stackTrace ?? '';
        const fullMessage =
          errorMessage && stackTrace
            ? `${errorMessage}\n\n${stackTrace}`
            : errorMessage || stackTrace || nls.localize('apex_test_failed_no_details_message');

        const message = new vscode.TestMessage(fullMessage);

        // Set location for clickable link - this makes the stack trace line clickable in the Test Results panel
        // When you click on a failed test, the location appears as a clickable link
        if (stackTrace) {
          const location = parseStackTrace(stackTrace, classItems);
          if (location) {
            message.location = location;
          }
        }

        run.failed(testItem, message, runTime);
        classResult.failed++;
        classResult.duration += runTime;
      } else if (outcomeStr === SKIP_RESULT) {
        run.skipped(testItem);
        classResult.skipped++;
      }
    } else {
      // Test result doesn't match any known test item
      // This can happen if the test was run as part of a suite but isn't in our tree
      Effect.runSync(
        Effect.logDebug(`Test result for ${fullTestName} doesn't match any test item`, { availableItems: testMap.size })
      );
    }
  }

  // Aggregate totals across all classes for parent items (suites, classes)
  const totals = Array.from(classResults.values()).reduce(
    (acc, classResult) => ({
      passed: acc.passed + classResult.passed,
      failed: acc.failed + classResult.failed,
      skipped: acc.skipped + classResult.skipped,
      duration: acc.duration + classResult.duration
    }),
    { passed: 0, failed: 0, skipped: 0, duration: 0 }
  );

  // Helper to recursively update all class items under a suite
  const updateClassItemsUnderSuite = (suiteItem: vscode.TestItem): void => {
    suiteItem.children.forEach(classItem => {
      const className = classItem.label;
      const classResult = classResults.get(className);

      if (classResult) {
        // Update the class item with aggregate results
        if (classResult.failed > 0) {
          run.failed(
            classItem,
            new vscode.TestMessage(nls.localize('apex_test_aggregate_failed_message', String(classResult.failed))),
            classResult.duration
          );
        } else if (classResult.passed > 0) {
          run.passed(classItem, classResult.duration);
        } else if (classResult.skipped > 0) {
          run.skipped(classItem);
        }
      }

      // Recursively update any nested items
      classItem.children.forEach(child => {
        if (isMethod(child.id)) {
          const testName = getTestName(child);
          const testItem = testMap.get(testName);
          // Results should already be applied, but ensure they're in the tree
          if (testItem && testItem !== child) {
            // If the method item in the map is different, we may need to update the child
            // VS Code should handle this, but we ensure the child is updated
          }
        }
      });
    });
  };

  // Update parent items (suites, classes) that were originally selected
  // This ensures the checkmark appears on the suite/class, not just the methods
  for (const test of testsToRun) {
    if (isSuite(test.id)) {
      // For suites, aggregate results only for classes that belong to THIS suite
      const suiteChildren: vscode.TestItem[] = [];
      test.children.forEach(child => suiteChildren.push(child));

      const suiteTotals = suiteChildren.reduce(
        (acc, child) => {
          // Try matching by label directly (e.g., "Class1"); if not found, try matching with
          // namespace prefix (className ends with .child.label, e.g. "namespace.Class1" -> "Class1").
          const childResult =
            classResults.get(child.label) ??
            Array.from(classResults).find(
              ([className]) => className === child.label || className.endsWith(`.${child.label}`)
            )?.[1];

          return childResult
            ? {
                passed: acc.passed + childResult.passed,
                failed: acc.failed + childResult.failed,
                skipped: acc.skipped + childResult.skipped,
                duration: acc.duration + childResult.duration
              }
            : acc;
        },
        { passed: 0, failed: 0, skipped: 0, duration: 0 }
      );

      // Mark the suite based on its own aggregate results
      if (suiteTotals.failed > 0) {
        run.failed(
          test,
          new vscode.TestMessage(nls.localize('apex_test_aggregate_failed_message', String(suiteTotals.failed))),
          suiteTotals.duration
        );
      } else if (suiteTotals.passed > 0) {
        run.passed(test, suiteTotals.duration);
      } else if (suiteTotals.skipped > 0) {
        run.skipped(test);
      }
      // Recursively update class items under the suite
      updateClassItemsUnderSuite(test);
    } else if (isClass(test.id)) {
      // For classes, update based on aggregate results for that class
      const className = test.label;
      const classResult = classResults.get(className);

      if (classResult) {
        if (classResult.failed > 0) {
          run.failed(
            test,
            new vscode.TestMessage(nls.localize('apex_test_aggregate_failed_message', String(classResult.failed))),
            classResult.duration
          );
        } else if (classResult.passed > 0) {
          run.passed(test, classResult.duration);
        } else if (classResult.skipped > 0) {
          run.skipped(test);
        }
      } else {
        // Fallback to total results if class-specific results aren't available
        if (totals.failed > 0) {
          run.failed(
            test,
            new vscode.TestMessage(nls.localize('apex_test_aggregate_failed_message', String(totals.failed))),
            totals.duration
          );
        } else if (totals.passed > 0) {
          run.passed(test, totals.duration);
        } else if (totals.skipped > 0) {
          run.skipped(test);
        }
      }
    }
  }
};
