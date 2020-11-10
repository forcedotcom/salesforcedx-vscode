/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ApexTestResultOutcome, TestResult } from '../../src/tests/types';

export const testResults: TestResult = {
  summary: {
    failRate: '13%',
    numTestsRan: 16,
    orgId: '00D3t000001vIruEAE',
    outcome: 'Completed',
    passRate: '88%',
    skipRate: '0%',
    testStartTime: '2020-11-09T18:02:50.000+0000',
    testExecutionTime: 5463,
    testRunId: '7073t000061uwZI',
    userId: '0053t000007OxppAAC',
    username: 'tpo-3'
  },
  tests: [
    {
      id: '07M3t000003bQwqEAE',
      queueItemId: '7093t000000c0eWAAQ',
      stackTrace: null,
      message: null,
      asyncApexJobId: '7073t000061uwZIAAY',
      methodName: 'should_create_account',
      outcome: ApexTestResultOutcome.Pass,
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
      message: '',
      asyncApexJobId: '7073t000061uwZIAAY',
      methodName: 'testCallout',
      outcome: ApexTestResultOutcome.Fail,
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
      asyncApexJobId: '7073t000061uwZIAAY',
      methodName: 'testGetCurrentUser',
      outcome: ApexTestResultOutcome.Pass,
      apexLogId: null,
      apexClass: {
        id: '01p3t000003qSzaAAE',
        name: 'tt_UtilControllerTest',
        namespacePrefix: 'trlhdtips',
        fullName: 'trlhdtips__tt_UtilControllerTest'
      },
      runTime: 13,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'trlhdtips__tt_UtilControllerTest.testGetCurrentUser'
    },
    {
      id: '07M3t000003bQwXEAU',
      queueItemId: '7093t000000c0eYAAQ',
      stackTrace: null,
      message: null,
      asyncApexJobId: '7073t000061uwZIAAY',
      methodName: 'testResetMyPassword',
      outcome: ApexTestResultOutcome.Pass,
      apexLogId: null,
      apexClass: {
        id: '01p3t000003qSzaAAE',
        name: 'tt_UtilControllerTest',
        namespacePrefix: 'trlhdtips',
        fullName: 'trlhdtips__tt_UtilControllerTest'
      },
      runTime: 179,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'trlhdtips__tt_UtilControllerTest.testResetMyPassword'
    },
    {
      id: '07M3t000003bQwlEAE',
      queueItemId: '7093t000000c0eZAAQ',
      stackTrace: null,
      message: null,
      asyncApexJobId: '7073t000061uwZIAAY',
      methodName: 'testGetCallout',
      outcome: ApexTestResultOutcome.Pass,
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
      stackTrace:
        'Class.AnimalLocatorTest.testMissingAnimal: line 22, column 1',
      message:
        'System.AssertException: Assertion Failed: Should not have found an animal: Expected: FooBar, Actual:',
      asyncApexJobId: '7073t000061uwZIAAY',
      methodName: 'testMissingAnimal',
      outcome: ApexTestResultOutcome.Fail,
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
      asyncApexJobId: '7073t000061uwZIAAY',
      methodName: 'testProcessing',
      outcome: ApexTestResultOutcome.Pass,
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
      asyncApexJobId: '7073t000061uwZIAAY',
      methodName: 'testDashboardPal',
      outcome: ApexTestResultOutcome.Pass,
      apexLogId: null,
      apexClass: {
        id: '01p3t000000i4L1AAI',
        name: 'DashboardPalTest',
        namespacePrefix: 'Dashboard_Pal',
        fullName: 'Dashboard_Pal__DashboardPalTest'
      },
      runTime: 128,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'Dashboard_Pal__DashboardPalTest.testDashboardPal'
    },
    {
      id: '07M3t000003bQx0EAE',
      queueItemId: '7093t000000c0efAAA',
      stackTrace:
        'Class.AccountProcessorTest.testCountContacts: line 47, column 1',
      message:
        'System.AssertException: Assertion Failed: Incorrect count: Expected: 3, Actual: 2',
      asyncApexJobId: '7073t000061uwZIAAY',
      methodName: 'testCountContacts',
      outcome: ApexTestResultOutcome.Fail,
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
      asyncApexJobId: '7073t000061uwZIAAY',
      methodName: 'testCountContactsEmptyList',
      outcome: ApexTestResultOutcome.Pass,
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
      asyncApexJobId: '7073t000061uwZIAAY',
      methodName: 'testCountContactsNullList',
      outcome: ApexTestResultOutcome.Pass,
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
      asyncApexJobId: '7073t000061uwZIAAY',
      methodName: 'testCallout',
      outcome: ApexTestResultOutcome.Pass,
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
      stackTrace: null,
      message: '\r\n\r\nSurrounded by newlines.\r\n  and whitespace.\r\n\r\n',
      asyncApexJobId: '7073t000061uwZIAAY',
      methodName: 'testGetCallout',
      outcome: ApexTestResultOutcome.Fail,
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
      asyncApexJobId: '7073t000061uwZIAAY',
      methodName: 'testPostCallout',
      outcome: ApexTestResultOutcome.Pass,
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
      asyncApexJobId: '7073t000061uwZIAAY',
      methodName: 'testAddContact',
      outcome: ApexTestResultOutcome.Pass,
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
      asyncApexJobId: '7073t000061uwZIAAY',
      methodName: 'testLeadProcessing',
      outcome: ApexTestResultOutcome.Pass,
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
  ]
};
