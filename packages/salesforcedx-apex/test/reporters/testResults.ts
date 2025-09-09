/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as util from 'util';
import { ApexTestResultOutcome, TestResult } from '../../src/tests/types';

const testStartTime = '2020-11-09T18:02:50.000+0000';
const date = new Date(testStartTime);
const isoStartTime = date.toISOString();
const localStartTime = `${date.toDateString()} ${date.toLocaleTimeString()}`;

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
      outcome: ApexTestResultOutcome.Pass,
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
      outcome: ApexTestResultOutcome.Pass,
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
      stackTrace: null,
      message: null,
      asyncApexJobId: '7073t000061uwZIAAY',
      methodName: 'setup_method',
      apexLogId: null,
      apexClass: {
        id: '01p3t000000ivLzAAI',
        name: 'AccountServiceTest',
        namespacePrefix: null,
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
    ...{
      testsRan: 3,
      failing: 1,
      failRate: '67%',
      passRate: '33%'
    }
  },
  tests: [
    ...coverageResult.tests,
    ...[
      {
        id: '07M3t000003bQwgEAE',
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
      }
    ]
  ],
  setup: [],
  codecoverage: [...coverageResult.codecoverage]
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
      outcome: ApexTestResultOutcome.Pass,
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
      asyncApexJobId: '7073t000061uwZIAAY',
      methodName: 'testResetMyPassword',
      outcome: ApexTestResultOutcome.Pass,
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
        fullName: 'Dashboard_Pal.DashboardPalTest'
      },
      runTime: 128,
      testTimestamp: '2020-11-09T18:02:51.000+0000',
      fullName: 'Dashboard_Pal.DashboardPalTest.testDashboardPal'
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
      message:
        'Weird characters <>&"\'\r\n\r\nSurrounded by newlines.\r\n  and whitespace.\r\n\r\n',
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
  ],
  setup: []
};

export const junitResult = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
    <testsuite name="force.apex" timestamp="2020-11-09T18:02:50.000Z" hostname="https://na139.salesforce.com" tests="16" failures="4"  errors="0"  time="5.46">
        <properties>
            <property name="failRate" value="13%"/>
            <property name="testsRan" value="16"/>
            <property name="orgId" value="00D3t000001vIruEAE"/>
            <property name="outcome" value="Completed"/>
            <property name="passRate" value="88%"/>
            <property name="testStartTime" value="${localStartTime}"/>
            <property name="testExecutionTime" value="5.46 s"/>
            <property name="testTotalTime" value="5.46 s"/>
            <property name="commandTime" value="6.00 s"/>
            <property name="testRunId" value="7073t000061uwZI"/>
            <property name="userId" value="0053t000007OxppAAC"/>
            <property name="username" value="tpo-3"/>
            <property name="failing" value="4"/>
            <property name="skipped" value="0"/>
            <property name="passing" value="12"/>
            <property name="hostname" value="https://na139.salesforce.com"/>
        </properties>
        <testcase name="should_create_account" classname="AccountServiceTest" time="0.09">
        </testcase>
        <testcase name="testCallout" classname="AwesomeCalculatorTest" time="0.02">
            <failure message=""></failure>
        </testcase>
        <testcase name="testGetCurrentUser" classname="trlhdtips.tt_UtilControllerTest" time="0.01">
        </testcase>
        <testcase name="testResetMyPassword" classname="trlhdtips.tt_UtilControllerTest" time="0.18">
        </testcase>
        <testcase name="testGetCallout" classname="AnimalLocatorTest" time="0.02">
        </testcase>
        <testcase name="testMissingAnimal" classname="AnimalLocatorTest" time="0.01">
            <failure message="System.AssertException: Assertion Failed: Should not have found an animal: Expected: FooBar, Actual:"><![CDATA[Class.AnimalLocatorTest.testMissingAnimal: line 22, column 1]]></failure>
        </testcase>
        <testcase name="testProcessing" classname="LeadProcessorTest" time="2.26">
        </testcase>
        <testcase name="testDashboardPal" classname="Dashboard_Pal.DashboardPalTest" time="0.13">
        </testcase>
        <testcase name="testCountContacts" classname="AccountProcessorTest" time="0.24">
            <failure message="System.AssertException: Assertion Failed: Incorrect count: Expected: 3, Actual: 2"><![CDATA[Class.AccountProcessorTest.testCountContacts: line 47, column 1]]></failure>
        </testcase>
        <testcase name="testCountContactsEmptyList" classname="AccountProcessorTest" time="0.01">
        </testcase>
        <testcase name="testCountContactsNullList" classname="AccountProcessorTest" time="0.01">
        </testcase>
        <testcase name="testCallout" classname="ParkLocatorTest" time="0.01">
        </testcase>
        <testcase name="testGetCallout" classname="AnimalsCalloutsTest" time="0.03">\n            <failure message="Weird characters &lt;&gt;&amp;&quot;&apos;\r\n\r\nSurrounded by newlines.\r\n  and whitespace.\r\n\r
"></failure>
        </testcase>
        <testcase name="testPostCallout" classname="AnimalsCalloutsTest" time="0.01">
        </testcase>
        <testcase name="testAddContact" classname="AddPrimaryContactTest" time="0.25">
        </testcase>
        <testcase name="testLeadProcessing" classname="DailyLeadProcessorTest" time="2.20">
        </testcase>
    </testsuite>
</testsuites>\n`;

const successProperties = `            <property name="failRate" value="0%"/>
            <property name="testsRan" value="2"/>
            <property name="orgId" value="00D3t000001vIruEAE"/>
            <property name="outcome" value="Completed"/>
            <property name="passRate" value="100%"/>
            <property name="testStartTime" value="${localStartTime}"/>
            <property name="testExecutionTime" value="5.46 s"/>
            <property name="testTotalTime" value="5.46 s"/>
            <property name="commandTime" value="6.00 s"/>
            <property name="testRunId" value="7073t000061uwZI"/>
            <property name="userId" value="0053t000007OxppAAC"/>
            <property name="username" value="tpo-3"/>
            <property name="failing" value="0"/>
            <property name="skipped" value="0"/>
            <property name="passing" value="2"/>
            <property name="hostname" value="https://na139.salesforce.com"/>`;
const missingValProperties = `            <property name="failRate" value="0%"/>
            <property name="testsRan" value="2"/>
            <property name="orgId" value="00D3t000001vIruEAE"/>
            <property name="outcome" value="Completed"/>
            <property name="passRate" value="100%"/>
            <property name="testStartTime" value="${localStartTime}"/>
            <property name="testExecutionTime" value="5.46 s"/>
            <property name="testTotalTime" value="5.46 s"/>
            <property name="commandTime" value="6.00 s"/>
            <property name="username" value="tpo-3"/>
            <property name="failing" value="0"/>
            <property name="skipped" value="0"/>
            <property name="passing" value="2"/>
            <property name="hostname" value="https://na139.salesforce.com"/>`;
const setupProperties = `            <property name="failRate" value="0%"/>
            <property name="testsRan" value="2"/>
            <property name="orgId" value="00D3t000001vIruEAE"/>
            <property name="outcome" value="Completed"/>
            <property name="passRate" value="100%"/>
            <property name="testStartTime" value="${localStartTime}"/>
            <property name="testExecutionTime" value="5.46 s"/>
            <property name="testTotalTime" value="5.49 s"/>
            <property name="testSetupTimeInMs" value="24"/>
            <property name="commandTime" value="6.00 s"/>
            <property name="testRunId" value="7073t000061uwZI"/>
            <property name="userId" value="0053t000007OxppAAC"/>
            <property name="username" value="tpo-3"/>
            <property name="failing" value="0"/>
            <property name="skipped" value="0"/>
            <property name="passing" value="2"/>
            <property name="hostname" value="https://na139.salesforce.com"/>`;
const codeCovProperties = `${missingValProperties}\n            <property name="orgWideCoverage" value="85%"/>`;

const successTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
    <testsuite name="force.apex" timestamp="2020-11-09T18:02:50.000Z" hostname="https://na139.salesforce.com" tests="2" failures="0"  errors="0"  time="5.46">
        <properties>
%s
        </properties>
        <testcase name="should_create_account" classname="AccountServiceTest" time="0.09">
        </testcase>
        <testcase name="testCallout" classname="AwesomeCalculatorTest" time="0.02">
        </testcase>
    </testsuite>
</testsuites>\n`;

export const junitSuccess = util.format(successTemplate, successProperties);
export const junitCodeCov = util.format(successTemplate, codeCovProperties);
export const junitMissingVal = util.format(
  successTemplate,
  missingValProperties
);
export const junitSetup = util.format(successTemplate, setupProperties);

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
      fullName: 'AccountServiceTest.should_create_account',
      category: 'Apex'
    },
    {
      id: '07M3t000003bQwgEAE',
      queueItemId: '7093t000000c0eXAAQ',
      stackTrace: null,
      message: '',
      asyncApexJobId: '7073t000061uwZIAAY',
      methodName: 'testCallout',
      outcome: ApexTestResultOutcome.Pass,
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
          apexClassOrTriggerId: '01p3t000000ivLzAAI',
          apexTestClassId: '01p3t000000ivLzAAI',
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
          apexClassOrTriggerId: '01p3t000000imbvAAA',
          apexTestClassId: '01p3t000000imbvAAA',
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
          apexClassOrTriggerId: '01p3t000000ivLzAAI',
          apexTestClassId: '01p3t000000ivLzAAI',
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
          apexClassOrTriggerId: '01p3t000000imbvAAA',
          apexTestClassId: '01p3t000000imbvAAA',
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
          apexClassOrTriggerId: '01p3t000001ytUmAAI',
          apexTestClassId: '01p3t000001ytUmAAI',
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
    junitResult: junitResult.toString(),
    junitSuccess: junitSuccess.toString(),
    junitCodeCov: junitCodeCov.toString(),
    junitMissingVal: junitMissingVal.toString(),
    junitSetup: junitSetup.toString(),
    setupResult: structuredClone(setupResult),
    successResult: structuredClone(successResult),
    testResultsWithCategory: structuredClone(testResultsWithCategory),
    coverageResultWithCategory: structuredClone(coverageResultWithCategory),
    coverageFailResultWithCategory: structuredClone(
      coverageFailResultWithCategory
    )
  };
}
