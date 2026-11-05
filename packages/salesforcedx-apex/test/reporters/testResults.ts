/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type TestResult } from '../../src/tests/types';
import { apexClassId, salesforceId } from '../schemaHelpers';

const asyncApexJobId = salesforceId('7073t000061uwZIAAY');
const accountClassId = apexClassId('01p3t000000ivLzAAI');
const calculatorClassId = apexClassId('01p3t000000imbvAAA');
const animalLocatorClassId = apexClassId('01p3t000001ytUmAAI');
const testStartTime = '2020-11-09T18:02:50.000+0000';
const date = new Date(testStartTime);
const isoStartTime = date.toISOString();

export const coverageResult: TestResult = {
  summary: {
    failRate: '0%',
    testsRan: 2,
    orgId: '00D3t000001vIruEAE',
    outcome: 'Completed',
    passRate: '100%',
    skipRate: '0%',
    testStartTime: isoStartTime,
    testExecutionTimeInMs: 5463,
    testTotalTimeInMs: 5463,
    commandTimeInMs: 6000,
    testRunId: '7073t000061uwZI',
    userId: '0053t000007OxppAAC',
    username: 'tpo-3',
    failing: 0,
    skipped: 0,
    passing: 2,
    hostname: 'https://na139.salesforce.com',
    orgWideCoverage: '85%'
  },
  tests: [
    {
      id: '07M3t000003bQwqEAE',
      queueItemId: '7093t000000c0eWAAQ',
      stackTrace: null,
      message: null,
      asyncApexJobId,
      methodName: 'should_create_account',
      outcome: 'Pass',
      apexLogId: null,
      apexClass: {
        id: '01p3t000000ivLzAAI',
        name: 'AccountServiceTest',
        namespacePrefix: null,
        fullName: 'AccountServiceTest'
      },
      runTime: 86,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'AccountServiceTest.should_create_account'
    },
    {
      id: '07M3t000003bQwgEAE',
      queueItemId: '7093t000000c0eXAAQ',
      stackTrace: null,
      message: null,
      asyncApexJobId,
      methodName: 'testCallout',
      outcome: 'Pass',
      apexLogId: null,
      apexClass: {
        id: '01p3t000000imbvAAA',
        name: 'AwesomeCalculatorTest',
        namespacePrefix: null,
        fullName: 'AwesomeCalculatorTest'
      },
      runTime: 23,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'AwesomeCalculatorTest.testCallout'
    }
  ],
  setup: [],
  codecoverage: [
    {
      apexId: '001917xACG',
      name: 'ApexTestClass',
      type: 'ApexClass',
      numLinesCovered: 8,
      numLinesUncovered: 2,
      percentage: '12.5%',
      coveredLines: [1, 2, 3, 4, 5, 6, 7, 8],
      uncoveredLines: [9, 10]
    }
  ]
};

export const setupResult: TestResult = {
  summary: {
    failRate: '0%',
    testsRan: 2,
    orgId: '00D3t000001vIruEAE',
    outcome: 'Completed',
    passRate: '100%',
    skipRate: '0%',
    testStartTime: isoStartTime,
    testExecutionTimeInMs: 5463,
    testTotalTimeInMs: 5487,
    testSetupTimeInMs: 24,
    commandTimeInMs: 6000,
    testRunId: '7073t000061uwZI',
    userId: '0053t000007OxppAAC',
    username: 'tpo-3',
    failing: 0,
    skipped: 0,
    passing: 2,
    hostname: 'https://na139.salesforce.com'
  },
  tests: [
    {
      id: '07M3t000003bQwqEAE',
      queueItemId: '7093t000000c0eWAAQ',
      stackTrace: null,
      message: null,
      asyncApexJobId,
      methodName: 'should_create_account',
      outcome: 'Pass',
      apexLogId: null,
      apexClass: {
        id: '01p3t000000ivLzAAI',
        name: 'AccountServiceTest',
        namespacePrefix: null,
        fullName: 'AccountServiceTest'
      },
      runTime: 86,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'AccountServiceTest.should_create_account'
    },
    {
      id: '07M3t000003bQwgEAE',
      queueItemId: '7093t000000c0eXAAQ',
      stackTrace: null,
      message: null,
      asyncApexJobId,
      methodName: 'testCallout',
      outcome: 'Pass',
      apexLogId: null,
      apexClass: {
        id: '01p3t000000imbvAAA',
        name: 'AwesomeCalculatorTest',
        namespacePrefix: null,
        fullName: 'AwesomeCalculatorTest'
      },
      runTime: 23,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'AwesomeCalculatorTest.testCallout'
    }
  ],
  setup: [
    {
      id: '07M3t000003bQwqEAE',
      asyncApexJobId,
      methodName: 'setup_method',
      apexClass: {
        id: '01p3t000000ivLzAAI',
        name: 'AccountServiceTest',
        fullName: 'AccountServiceTest'
      },
      testSetupTime: 24,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'AccountServiceTest.setup_method'
    }
  ],
  codecoverage: []
};
export const coverageFailResult: TestResult = {
  summary: {
    ...coverageResult.summary,

    testsRan: 3,
    failing: 1,
    failRate: '67%',
    passRate: '33%'
  },
  tests: [
    ...coverageResult.tests,

    {
      id: '07M3t000003bQwgEAE',
      queueItemId: '7093t000000c0eZAAQ',
      stackTrace: 'Class.AnimalLocatorTest.testMissingAnimal: line 22, column 1',
      message: 'System.AssertException: Assertion Failed: Should not have found an animal: Expected: FooBar, Actual:',
      asyncApexJobId,
      methodName: 'testMissingAnimal',
      outcome: 'Fail',
      apexLogId: null,
      apexClass: {
        id: '01p3t000001ytUmAAI',
        name: 'AnimalLocatorTest',
        namespacePrefix: null,
        fullName: 'AnimalLocatorTest'
      },
      runTime: 5,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'AnimalLocatorTest.testMissingAnimal'
    }
  ],
  setup: [],
  codecoverage: [...(coverageResult.codecoverage ?? [])]
};

export const successResult: TestResult = {
  summary: {
    failRate: '0%',
    testsRan: 2,
    orgId: '00D3t000001vIruEAE',
    outcome: 'Completed',
    passRate: '100%',
    skipRate: '0%',
    testStartTime: isoStartTime,
    testExecutionTimeInMs: 5463,
    testTotalTimeInMs: 5463,
    commandTimeInMs: 6000,
    testRunId: '7073t000061uwZI',
    userId: '0053t000007OxppAAC',
    username: 'tpo-3',
    failing: 0,
    skipped: 0,
    passing: 2,
    hostname: 'https://na139.salesforce.com'
  },
  tests: [
    {
      id: '07M3t000003bQwqEAE',
      queueItemId: '7093t000000c0eWAAQ',
      stackTrace: null,
      message: null,
      asyncApexJobId,
      methodName: 'should_create_account',
      outcome: 'Pass',
      apexLogId: null,
      apexClass: {
        id: '01p3t000000ivLzAAI',
        name: 'AccountServiceTest',
        namespacePrefix: null,
        fullName: 'AccountServiceTest'
      },
      runTime: 86,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'AccountServiceTest.should_create_account'
    },
    {
      id: '07M3t000003bQwgEAE',
      queueItemId: '7093t000000c0eXAAQ',
      stackTrace: null,
      message: null,
      asyncApexJobId,
      methodName: 'testCallout',
      outcome: 'Pass',
      apexLogId: null,
      apexClass: {
        id: '01p3t000000imbvAAA',
        name: 'AwesomeCalculatorTest',
        namespacePrefix: null,
        fullName: 'AwesomeCalculatorTest'
      },
      runTime: 23,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'AwesomeCalculatorTest.testCallout'
    }
  ],
  setup: []
};

export const testResults: TestResult = {
  summary: {
    failRate: '13%',
    testsRan: 16,
    orgId: '00D3t000001vIruEAE',
    outcome: 'Completed',
    passRate: '88%',
    skipRate: '0%',
    testStartTime: isoStartTime,
    testExecutionTimeInMs: 5463,
    testTotalTimeInMs: 5463,
    commandTimeInMs: 6000,
    testRunId: '7073t000061uwZI',
    userId: '0053t000007OxppAAC',
    username: 'tpo-3',
    failing: 4,
    skipped: 0,
    passing: 12,
    hostname: 'https://na139.salesforce.com'
  },
  tests: [
    {
      id: '07M3t000003bQwqEAE',
      queueItemId: '7093t000000c0eWAAQ',
      stackTrace: null,
      message: null,
      asyncApexJobId,
      methodName: 'should_create_account',
      outcome: 'Pass',
      apexLogId: null,
      apexClass: {
        id: '01p3t000000ivLzAAI',
        name: 'AccountServiceTest',
        namespacePrefix: null,
        fullName: 'AccountServiceTest'
      },
      runTime: 86,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'AccountServiceTest.should_create_account'
    },
    {
      id: '07M3t000003bQwgEAE',
      queueItemId: '7093t000000c0eXAAQ',
      stackTrace: null,
      message: null,
      asyncApexJobId,
      methodName: 'testCallout',
      outcome: 'Fail',
      apexLogId: null,
      apexClass: {
        id: '01p3t000000imbvAAA',
        name: 'AwesomeCalculatorTest',
        namespacePrefix: null,
        fullName: 'AwesomeCalculatorTest'
      },
      runTime: 23,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'AwesomeCalculatorTest.testCallout'
    },
    {
      id: '07M3t000003bQwWEAU',
      queueItemId: '7093t000000c0eYAAQ',
      stackTrace: null,
      message: null,
      asyncApexJobId,
      methodName: 'testGetCurrentUser',
      outcome: 'Pass',
      apexLogId: null,
      apexClass: {
        id: '01p3t000003qSzaAAE',
        name: 'tt_UtilControllerTest',
        namespacePrefix: 'trlhdtips',
        fullName: 'trlhdtips.tt_UtilControllerTest'
      },
      runTime: 13,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'trlhdtips.tt_UtilControllerTest.testGetCurrentUser'
    },
    {
      id: '07M3t000003bQwXEAU',
      queueItemId: '7093t000000c0eYAAQ',
      stackTrace: null,
      message: null,
      asyncApexJobId,
      methodName: 'testResetMyPassword',
      outcome: 'Pass',
      apexLogId: null,
      apexClass: {
        id: '01p3t000003qSzaAAE',
        name: 'tt_UtilControllerTest',
        namespacePrefix: 'trlhdtips',
        fullName: 'trlhdtips.tt_UtilControllerTest'
      },
      runTime: 179,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'trlhdtips.tt_UtilControllerTest.testResetMyPassword'
    },
    {
      id: '07M3t000003bQwlEAE',
      queueItemId: '7093t000000c0eZAAQ',
      stackTrace: null,
      message: null,
      asyncApexJobId,
      methodName: 'testGetCallout',
      outcome: 'Pass',
      apexLogId: null,
      apexClass: {
        id: '01p3t000001ytUmAAI',
        name: 'AnimalLocatorTest',
        namespacePrefix: null,
        fullName: 'AnimalLocatorTest'
      },
      runTime: 16,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'AnimalLocatorTest.testGetCallout'
    },
    {
      id: '07M3t000003bQwmEAE',
      queueItemId: '7093t000000c0eZAAQ',
      stackTrace: 'Class.AnimalLocatorTest.testMissingAnimal: line 22, column 1',
      message: 'System.AssertException: Assertion Failed: Should not have found an animal: Expected: FooBar, Actual:',
      asyncApexJobId,
      methodName: 'testMissingAnimal',
      outcome: 'Fail',
      apexLogId: null,
      apexClass: {
        id: '01p3t000001ytUmAAI',
        name: 'AnimalLocatorTest',
        namespacePrefix: null,
        fullName: 'AnimalLocatorTest'
      },
      runTime: 5,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'AnimalLocatorTest.testMissingAnimal'
    },
    {
      id: '07M3t000003bQxFEAU',
      queueItemId: '7093t000000c0ebAAA',
      stackTrace: null,
      message: null,
      asyncApexJobId,
      methodName: 'testProcessing',
      outcome: 'Pass',
      apexLogId: null,
      apexClass: {
        id: '01p3t000000i6dtAAA',
        name: 'LeadProcessorTest',
        namespacePrefix: null,
        fullName: 'LeadProcessorTest'
      },
      runTime: 2256,
      testTimestamp: '2020-11-09T18:02:52.000+0000',
      fullName: 'LeadProcessorTest.testProcessing'
    },
    {
      id: '07M3t000003bQwvEAE',
      queueItemId: '7093t000000c0eeAAA',
      stackTrace: null,
      message: null,
      asyncApexJobId,
      methodName: 'testDashboardPal',
      outcome: 'Pass',
      apexLogId: null,
      apexClass: {
        id: '01p3t000000i4L1AAI',
        name: 'DashboardPalTest',
        namespacePrefix: 'Dashboard_Pal',
        fullName: 'Dashboard_Pal.DashboardPalTest'
      },
      runTime: 128,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'Dashboard_Pal.DashboardPalTest.testDashboardPal'
    },
    {
      id: '07M3t000003bQx0EAE',
      queueItemId: '7093t000000c0efAAA',
      stackTrace: 'Class.AccountProcessorTest.testCountContacts: line 47, column 1',
      message: 'System.AssertException: Assertion Failed: Incorrect count: Expected: 3, Actual: 2',
      asyncApexJobId,
      methodName: 'testCountContacts',
      outcome: 'Fail',
      apexLogId: null,
      apexClass: {
        id: '01p3t000001zSjkAAE',
        name: 'AccountProcessorTest',
        namespacePrefix: null,
        fullName: 'AccountProcessorTest'
      },
      runTime: 241,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'AccountProcessorTest.testCountContacts'
    },
    {
      id: '07M3t000003bQx1EAE',
      queueItemId: '7093t000000c0efAAA',
      stackTrace: null,
      message: null,
      asyncApexJobId,
      methodName: 'testCountContactsEmptyList',
      outcome: 'Pass',
      apexLogId: null,
      apexClass: {
        id: '01p3t000001zSjkAAE',
        name: 'AccountProcessorTest',
        namespacePrefix: null,
        fullName: 'AccountProcessorTest'
      },
      runTime: 10,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'AccountProcessorTest.testCountContactsEmptyList'
    },
    {
      id: '07M3t000003bQx2EAE',
      queueItemId: '7093t000000c0efAAA',
      stackTrace: null,
      message: null,
      asyncApexJobId,
      methodName: 'testCountContactsNullList',
      outcome: 'Pass',
      apexLogId: null,
      apexClass: {
        id: '01p3t000001zSjkAAE',
        name: 'AccountProcessorTest',
        namespacePrefix: null,
        fullName: 'AccountProcessorTest'
      },
      runTime: 10,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'AccountProcessorTest.testCountContactsNullList'
    },
    {
      id: '07M3t000003bQwbEAE',
      queueItemId: '7093t000000c0ehAAA',
      stackTrace: null,
      message: null,
      asyncApexJobId,
      methodName: 'testCallout',
      outcome: 'Pass',
      apexLogId: null,
      apexClass: {
        id: '01p3t000000ime6AAA',
        name: 'ParkLocatorTest',
        namespacePrefix: null,
        fullName: 'ParkLocatorTest'
      },
      runTime: 15,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'ParkLocatorTest.testCallout'
    },
    {
      id: '07M3t000003bQwREAU',
      queueItemId: '7093t000000c0eiAAA',
      message: 'Weird characters <>&"\'\r\n\r\nSurrounded by newlines.\r\n  and whitespace.\r\n\r\n',
      stackTrace: null,
      asyncApexJobId,
      methodName: 'testGetCallout',
      outcome: 'Fail',
      apexLogId: null,
      apexClass: {
        id: '01p3t000001ytK6AAI',
        name: 'AnimalsCalloutsTest',
        namespacePrefix: null,
        fullName: 'AnimalsCalloutsTest'
      },
      runTime: 28,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'AnimalsCalloutsTest.testGetCallout'
    },
    {
      id: '07M3t000003bQwSEAU',
      queueItemId: '7093t000000c0eiAAA',
      stackTrace: null,
      message: null,
      asyncApexJobId,
      methodName: 'testPostCallout',
      outcome: 'Pass',
      apexLogId: null,
      apexClass: {
        id: '01p3t000001ytK6AAI',
        name: 'AnimalsCalloutsTest',
        namespacePrefix: null,
        fullName: 'AnimalsCalloutsTest'
      },
      runTime: 7,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'AnimalsCalloutsTest.testPostCallout'
    },
    {
      id: '07M3t000003bQx5EAE',
      queueItemId: '7093t000000c0ejAAA',
      stackTrace: null,
      message: null,
      asyncApexJobId,
      methodName: 'testAddContact',
      outcome: 'Pass',
      apexLogId: null,
      apexClass: {
        id: '01p3t000000iADsAAM',
        name: 'AddPrimaryContactTest',
        namespacePrefix: null,
        fullName: 'AddPrimaryContactTest'
      },
      runTime: 250,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'AddPrimaryContactTest.testAddContact'
    },
    {
      id: '07M3t000003bQxAEAU',
      queueItemId: '7093t000000c0ekAAA',
      stackTrace: null,
      message: null,
      asyncApexJobId,
      methodName: 'testLeadProcessing',
      outcome: 'Pass',
      apexLogId: null,
      apexClass: {
        id: '01p3t000000iAZFAA2',
        name: 'DailyLeadProcessorTest',
        namespacePrefix: null,
        fullName: 'DailyLeadProcessorTest'
      },
      runTime: 2196,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'DailyLeadProcessorTest.testLeadProcessing'
    }
  ],
  setup: []
};

// Test data with category field for testing showCategory functionality
export const testResultsWithCategory: TestResult = {
  summary: {
    failRate: '33%',
    testsRan: 3,
    orgId: '00D3t000001vIruEAE',
    outcome: 'Completed',
    passRate: '67%',
    skipRate: '0%',
    testStartTime: isoStartTime,
    testExecutionTimeInMs: 5463,
    testTotalTimeInMs: 5463,
    commandTimeInMs: 6000,
    testRunId: '7073t000061uwZI',
    userId: '0053t000007OxppAAC',
    username: 'tpo-3',
    failing: 1,
    skipped: 0,
    passing: 2,
    hostname: 'https://na139.salesforce.com'
  },
  tests: [
    {
      id: '07M3t000003bQwqEAE',
      queueItemId: '7093t000000c0eWAAQ',
      stackTrace: null,
      message: null,
      asyncApexJobId,
      methodName: 'should_create_account',
      outcome: 'Pass',
      apexLogId: null,
      apexClass: {
        id: '01p3t000000ivLzAAI',
        name: 'AccountServiceTest',
        namespacePrefix: null,
        fullName: 'AccountServiceTest'
      },
      runTime: 86,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'AccountServiceTest.should_create_account',
      category: 'Apex'
    },
    {
      id: '07M3t000003bQwgEAE',
      queueItemId: '7093t000000c0eXAAQ',
      stackTrace: null,
      message: null,
      asyncApexJobId,
      methodName: 'testCallout',
      outcome: 'Pass',
      apexLogId: null,
      apexClass: {
        id: '01p3t000000imbvAAA',
        name: 'AwesomeCalculatorTest',
        namespacePrefix: null,
        fullName: 'AwesomeCalculatorTest'
      },
      runTime: 23,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'AwesomeCalculatorTest.testCallout',
      category: 'Flow'
    },
    {
      id: '07M3t000003bQwmEAE',
      queueItemId: '7093t000000c0eZAAQ',
      stackTrace: 'Class.AnimalLocatorTest.testMissingAnimal: line 22, column 1',
      message: 'System.AssertException: Assertion Failed: Should not have found an animal: Expected: FooBar, Actual:',
      asyncApexJobId,
      methodName: 'testMissingAnimal',
      outcome: 'Fail',
      apexLogId: null,
      apexClass: {
        id: '01p3t000001ytUmAAI',
        name: 'AnimalLocatorTest',
        namespacePrefix: null,
        fullName: 'AnimalLocatorTest'
      },
      runTime: 5,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'AnimalLocatorTest.testMissingAnimal',
      category: 'Apex'
    }
  ],
  setup: []
};

// Test data with category field and code coverage for detailed coverage tests
export const coverageResultWithCategory: TestResult = {
  ...coverageResult,
  tests: [
    {
      ...coverageResult.tests[0],
      category: 'Apex',
      perClassCoverage: [
        {
          apexClassOrTriggerName: 'AccountService',
          apexClassOrTriggerId: accountClassId,
          apexTestClassId: accountClassId,
          apexTestMethodName: 'should_create_account',
          numLinesCovered: 17,
          numLinesUncovered: 3,
          percentage: '85%'
        }
      ]
    },
    {
      ...coverageResult.tests[1],
      category: 'Flow',
      perClassCoverage: [
        {
          apexClassOrTriggerName: 'CalculatorUtils',
          apexClassOrTriggerId: calculatorClassId,
          apexTestClassId: calculatorClassId,
          apexTestMethodName: 'testCallout',
          numLinesCovered: 23,
          numLinesUncovered: 2,
          percentage: '92%'
        }
      ]
    }
  ]
};

// Test data with category field, code coverage and failed tests for concise mode testing
export const coverageFailResultWithCategory: TestResult = {
  ...coverageFailResult,
  tests: [
    {
      ...coverageFailResult.tests[0],
      category: 'Apex',
      perClassCoverage: [
        {
          apexClassOrTriggerName: 'AccountService',
          apexClassOrTriggerId: accountClassId,
          apexTestClassId: accountClassId,
          apexTestMethodName: 'should_create_account',
          numLinesCovered: 17,
          numLinesUncovered: 3,
          percentage: '85%'
        }
      ]
    },
    {
      ...coverageFailResult.tests[1],
      category: 'Flow',
      perClassCoverage: [
        {
          apexClassOrTriggerName: 'CalculatorUtils',
          apexClassOrTriggerId: calculatorClassId,
          apexTestClassId: calculatorClassId,
          apexTestMethodName: 'testCallout',
          numLinesCovered: 23,
          numLinesUncovered: 2,
          percentage: '92%'
        }
      ]
    },
    {
      ...coverageFailResult.tests[2],
      category: 'Apex',
      perClassCoverage: [
        {
          apexClassOrTriggerName: 'AnimalLocator',
          apexClassOrTriggerId: animalLocatorClassId,
          apexTestClassId: animalLocatorClassId,
          apexTestMethodName: 'testMissingAnimal',
          numLinesCovered: 5,
          numLinesUncovered: 8,
          percentage: '38%'
        }
      ]
    }
  ]
};

export function getTestData() {
  return {
    testResults: structuredClone(testResults),
    setupResult: structuredClone(setupResult),
    successResult: structuredClone(successResult),
    testResultsWithCategory: structuredClone(testResultsWithCategory),
    coverageResultWithCategory: structuredClone(coverageResultWithCategory),
    coverageFailResultWithCategory: structuredClone(coverageFailResultWithCategory)
  };
}
