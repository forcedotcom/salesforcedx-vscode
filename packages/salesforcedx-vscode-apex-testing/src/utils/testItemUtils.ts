/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { SUITE_PARENT_ID, TEST_ID_PREFIXES } from '../constants';

type TestItemType = 'suite' | 'class' | 'method' | 'suite-class' | 'unknown';

interface TestIdInfo {
  type: TestItemType;
  name: string;
  suiteName?: string;
  className?: string;
}

/**
 * Parses a test item ID and returns information about its type and name
 */
export const parseTestId = (id: string): TestIdInfo => {
  if (id.startsWith(TEST_ID_PREFIXES.SUITE)) {
    return {
      type: 'suite',
      name: id.replace(TEST_ID_PREFIXES.SUITE, '')
    };
  }

  if (id.startsWith(TEST_ID_PREFIXES.CLASS)) {
    return {
      type: 'class',
      name: id.replace(TEST_ID_PREFIXES.CLASS, '')
    };
  }

  if (id.startsWith(TEST_ID_PREFIXES.METHOD)) {
    const fullName = id.replace(TEST_ID_PREFIXES.METHOD, '');
    const parts = fullName.split('.');
    return {
      type: 'method',
      name: fullName,
      className: parts.length > 0 ? parts[0] : undefined
    };
  }

  if (id.startsWith(TEST_ID_PREFIXES.SUITE_CLASS)) {
    // Format: suite-class:SuiteName:ClassName
    const parts = id.split(':');
    if (parts.length >= 3) {
      return {
        type: 'suite-class',
        name: parts[2], // Class name
        suiteName: parts[1], // Suite name
        className: parts[2]
      };
    }
  }

  return {
    type: 'unknown',
    name: id
  };
};

/**
 * Checks if a test item ID represents a suite
 */
export const isSuite = (id: string): boolean => id.startsWith(TEST_ID_PREFIXES.SUITE);

/**
 * Checks if a test item ID represents a class
 */
export const isClass = (id: string): boolean => id.startsWith(TEST_ID_PREFIXES.CLASS);

/**
 * Checks if a test item ID represents a method
 */
export const isMethod = (id: string): boolean => id.startsWith(TEST_ID_PREFIXES.METHOD);

/**
 * Checks if a test item ID represents a suite-class placeholder
 */
export const isSuiteClass = (id: string): boolean => id.startsWith(TEST_ID_PREFIXES.SUITE_CLASS);

/**
 * Extracts the test name from a test item
 * For methods: returns Class.Method
 * For classes: returns ClassName
 * For suites: returns SuiteName
 */
export const getTestName = (test: vscode.TestItem): string => {
  const idInfo = parseTestId(test.id);
  return idInfo.name;
};

/**
 * Creates a suite ID from a suite name
 */
export const createSuiteId = (suiteName: string): string => `${TEST_ID_PREFIXES.SUITE}${suiteName}`;

/**
 * Creates a class ID from a class name
 */
export const createClassId = (className: string): string => `${TEST_ID_PREFIXES.CLASS}${className}`;

/**
 * Creates a method ID from a class and method name
 */
export const createMethodId = (className: string, methodName: string): string =>
  `${TEST_ID_PREFIXES.METHOD}${className}.${methodName}`;

/**
 * Creates a suite-class placeholder ID
 */
export const createSuiteClassId = (suiteName: string, className: string): string =>
  `${TEST_ID_PREFIXES.SUITE_CLASS}${suiteName}:${className}`;

/**
 * Extracts the suite name from a suite ID
 */
export const extractSuiteName = (id: string): string | undefined => {
  if (isSuite(id)) {
    return id.replace(TEST_ID_PREFIXES.SUITE, '');
  }
  const idInfo = parseTestId(id);
  return idInfo.suiteName;
};

/**
 * Extracts the class name from a class or method ID
 */
export const extractClassName = (id: string): string | undefined => {
  const idInfo = parseTestId(id);
  return idInfo.className ?? (idInfo.type === 'class' ? idInfo.name : undefined);
};

/**
 * Gathers test items to run based on the test run request
 */
export const gatherTests = (
  request: vscode.TestRunRequest,
  controllerItems: vscode.TestItemCollection,
  suiteItems: Map<string, vscode.TestItem>
): vscode.TestItem[] => {
  const tests: vscode.TestItem[] = [];

  const include = (test: vscode.TestItem): void => {
    // Skip the suite parent node - it's just a container
    if (test.id === SUITE_PARENT_ID) {
      // Expand parent to get its children (suites)
      test.children.forEach(child => include(child));
      return;
    }
    // Don't expand suites - they should be run as-is
    if (isSuite(test.id)) {
      tests.push(test);
    } else if (isSuiteClass(test.id)) {
      // Suite child placeholder - find the parent suite
      const suiteName = extractSuiteName(test.id);
      if (suiteName) {
        const parentSuite = suiteItems.get(suiteName);
        if (parentSuite) {
          tests.push(parentSuite);
        }
      }
      // Skip if parent suite not found
    } else if (test.children.size > 0) {
      // Expand classes to their methods
      test.children.forEach(child => include(child));
    } else {
      // Leaf node (method)
      tests.push(test);
    }
  };

  if (request.include) {
    for (const test of request.include) {
      include(test);
    }
  } else {
    controllerItems.forEach(test => include(test));
  }

  if (request.exclude) {
    const excludeSet = new Set(request.exclude);
    return tests.filter(test => !excludeSet.has(test));
  }

  return tests;
};
