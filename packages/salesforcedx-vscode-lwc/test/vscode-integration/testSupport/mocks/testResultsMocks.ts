/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Test Results mocks for:
// packages/system-tests/assets/sfdx-simple/force-app/main/default/lwc/demoLwcComponent/__tests__/demoLwcComponent.test.js
import { LwcJestTestResults } from '../../../../src/testSupport/types';

// Test Results for the test file
export const testFileResult = {
  numFailedTestSuites: 1,
  numFailedTests: 1,
  numPassedTestSuites: 0,
  numPassedTests: 1,
  numPendingTestSuites: 0,
  numPendingTests: 0,
  numRuntimeErrorTestSuites: 0,
  numTodoTests: 0,
  numTotalTestSuites: 1,
  numTotalTests: 2,
  openHandles: [],
  snapshot: {
    added: 0,
    didUpdate: false,
    failure: false,
    filesAdded: 0,
    filesRemoved: 0,
    filesRemovedList: [],
    filesUnmatched: 0,
    filesUpdated: 0,
    matched: 0,
    total: 0,
    unchecked: 0,
    uncheckedKeysByFile: [],
    unmatched: 0,
    updated: 0
  },
  startTime: 1570000000000,
  success: false,
  testResults: [
    {
      assertionResults: [
        {
          ancestorTitles: ['Demo Lwc Component'],
          failureMessages: [],
          fullName: 'Demo Lwc Component Displays greeting',
          location: {
            column: 2,
            line: 12
          },
          status: 'passed',
          title: 'Displays greeting'
        },
        {
          ancestorTitles: ['Demo Lwc Component'],
          failureMessages: [
            'Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoEqual\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // deep equality\u001b[22m\n\nExpected: \u001b[32m2\u001b[39m\nReceived: \u001b[31m1\u001b[39m\n    at Object.expect (/Users/mockUser/sfdx-simple/force-app/main/default/lwc/demoLwcComponent/__tests__/demoLwcComponent.test.js:22:5)\n    at Object.asyncJestTest (/Users/mockUser/sfdx-simple/node_modules/jest-jasmine2/build/jasmineAsyncInstall.js:102:37)\n    at /Users/mockUser/sfdx-simple/node_modules/jest-jasmine2/build/queueRunner.js:43:12\n    at new Promise (<anonymous>)\n    at mapper (/Users/mockUser/sfdx-simple/node_modules/jest-jasmine2/build/queueRunner.js:26:19)\n    at /Users/mockUser/sfdx-simple/node_modules/jest-jasmine2/build/queueRunner.js:73:41\n    at processTicksAndRejections (internal/process/task_queues.js:93:5)'
          ],
          fullName: 'Demo Lwc Component Failed test',
          location: {
            column: 2,
            line: 21
          },
          status: 'failed',
          title: 'Failed test'
        }
      ],
      endTime: 1570000005000,
      name: 'REPLACE WITH INTEGRATION TEST FILE URI',
      startTime: 1570000000000,
      status: 'failed'
    }
  ]
} as LwcJestTestResults;

// Test results for the first test case
export const testCaseSuccessResult = {
  numFailedTestSuites: 0,
  numFailedTests: 0,
  numPassedTestSuites: 1,
  numPassedTests: 1,
  numPendingTestSuites: 0,
  numPendingTests: 1,
  numRuntimeErrorTestSuites: 0,
  numTodoTests: 0,
  numTotalTestSuites: 1,
  numTotalTests: 2,
  openHandles: [],
  snapshot: {
    added: 0,
    didUpdate: false,
    failure: false,
    filesAdded: 0,
    filesRemoved: 0,
    filesRemovedList: [],
    filesUnmatched: 0,
    filesUpdated: 0,
    matched: 0,
    total: 0,
    unchecked: 0,
    uncheckedKeysByFile: [],
    unmatched: 0,
    updated: 0
  },
  startTime: 1570000000000,
  success: true,
  testResults: [
    {
      assertionResults: [
        {
          ancestorTitles: ['Demo Lwc Component'],
          failureMessages: [],
          fullName: 'Demo Lwc Component Displays greeting',
          location: { column: 2, line: 12 },
          status: 'passed',
          title: 'Displays greeting'
        },
        {
          ancestorTitles: ['Demo Lwc Component'],
          failureMessages: [],
          fullName: 'Demo Lwc Component Failed test',
          location: { column: 2, line: 21 },
          status: 'pending',
          title: 'Failed test'
        }
      ],
      endTime: 1570000005000,
      name: 'REPLACE WITH INTEGRATION TEST FILE URI',
      startTime: 1570000000000,
      status: 'passed'
    }
  ],
  wasInterrupted: false
} as LwcJestTestResults;

// Test results for the second test case
export const testCaseFailureResult = {
  numFailedTestSuites: 1,
  numFailedTests: 1,
  numPassedTestSuites: 0,
  numPassedTests: 0,
  numPendingTestSuites: 0,
  numPendingTests: 1,
  numRuntimeErrorTestSuites: 0,
  numTodoTests: 0,
  numTotalTestSuites: 1,
  numTotalTests: 2,
  openHandles: [],
  snapshot: {
    added: 0,
    didUpdate: false,
    failure: false,
    filesAdded: 0,
    filesRemoved: 0,
    filesRemovedList: [],
    filesUnmatched: 0,
    filesUpdated: 0,
    matched: 0,
    total: 0,
    unchecked: 0,
    uncheckedKeysByFile: [],
    unmatched: 0,
    updated: 0
  },
  startTime: 1570000000000,
  success: false,
  testResults: [
    {
      assertionResults: [
        {
          ancestorTitles: ['Demo Lwc Component'],
          failureMessages: [],
          fullName: 'Demo Lwc Component Displays greeting',
          location: { column: 2, line: 12 },
          status: 'pending',
          title: 'Displays greeting'
        },
        {
          ancestorTitles: ['Demo Lwc Component'],
          failureMessages: [
            'Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoEqual\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // deep equality\u001b[22m\n\nExpected: \u001b[32m2\u001b[39m\nReceived: \u001b[31m1\u001b[39m\n    at Object.expect (/Users/mockUser/sfdx-simple/force-app/main/default/lwc/demoLwcComponent/__tests__/demoLwcComponent.test.js:22:5)\n    at Object.asyncJestTest (/Users/mockUser/sfdx-simple/node_modules/jest-jasmine2/build/jasmineAsyncInstall.js:102:37)\n    at /Users/mockUser/sfdx-simple/node_modules/jest-jasmine2/build/queueRunner.js:43:12\n    at new Promise (<anonymous>)\n    at mapper (/Users/mockUser/sfdx-simple/node_modules/jest-jasmine2/build/queueRunner.js:26:19)\n    at /Users/mockUser/sfdx-simple/node_modules/jest-jasmine2/build/queueRunner.js:73:41'
          ],
          fullName: 'Demo Lwc Component Failed test',
          location: { column: 2, line: 21 },
          status: 'failed',
          title: 'Failed test'
        }
      ],
      endTime: 1570000005000,
      name: 'REPLACE WITH INTEGRATION TEST FILE URI',
      startTime: 1570000000000,
      status: 'failed'
    }
  ],
  wasInterrupted: false
} as LwcJestTestResults;
