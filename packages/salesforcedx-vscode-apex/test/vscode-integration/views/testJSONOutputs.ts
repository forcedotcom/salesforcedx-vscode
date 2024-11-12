/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ApexTestResultData, ApexTestResultOutcome } from '@salesforce/apex-node-bundle';
import * as vscode from 'vscode';
import { FAIL_RESULT, PASS_RESULT } from '../../../src/constants';

export const apexLibOneFileSummary = {
  outcome: PASS_RESULT,
  testsRan: 1,
  passing: 1,
  failing: 0,
  skipped: 0,
  passRate: '100%',
  failRate: '0%',
  skipRate: '0%',
  testStartTime: 'Now',
  testExecutionTimeInMs: 'Later',
  testTotalTimeInMs: 'two',
  commandTime: '12',
  hostname: 'salesforce',
  orgId: 'org',
  username: 'name',
  testRunId: '1',
  userId: '1'
};

export const apexLibMultipleSummary = {
  outcome: FAIL_RESULT,
  testsRan: 3,
  passing: 2,
  failing: 1,
  skipped: 0,
  passRate: '66%',
  failRate: '33%',
  skipRate: '0%',
  testStartTime: 'Now',
  testExecutionTimeInMs: 'Later',
  testTotalTimeInMs: 'two',
  commandTime: '12',
  hostname: 'salesforce',
  orgId: 'org',
  username: 'name',
  testRunId: '1',
  userId: '1'
};

const apexLibClass = {
  id: 'fakeId',
  name: 'file0',
  namespacePrefix: '',
  fullName: 'file0'
};

const apexLibOneFileTests: ApexTestResultData[] = [
  {
    apexClass: apexLibClass,
    methodName: 'test0',
    outcome: ApexTestResultOutcome.Pass,
    runTime: 1,
    message: '',
    stackTrace: '',
    fullName: 'file0.test0',
    id: '0000x1432',
    queueItemId: '0000QUEUE',
    asyncApexJobId: '0000JOBID',
    apexLogId: '000LogID',
    testTimestamp: '00:00:000'
  }
];

const apexLibMultipleTests: ApexTestResultData[] = [
  {
    apexClass: apexLibClass,
    methodName: 'test0',
    outcome: ApexTestResultOutcome.Pass,
    runTime: 1,
    message: '',
    stackTrace: '',
    fullName: 'file0.test0',
    id: '0000x1432',
    queueItemId: '0000QUEUE',
    asyncApexJobId: '0000JOBID',
    apexLogId: '000LogID',
    testTimestamp: '00:00:000'
  },
  {
    apexClass: apexLibClass,
    methodName: 'test1',
    outcome: ApexTestResultOutcome.Fail,
    runTime: 1,
    message: 'System.AssertException: Assertion Failed',
    stackTrace: 'Class.fakeClass.test1: line 40, column 1',
    fullName: 'file0.test1',
    id: '0000x1432',
    queueItemId: '0000QUEUE',
    asyncApexJobId: '0000JOBID',
    apexLogId: '000LogID',
    testTimestamp: '00:00:000'
  },
  {
    apexClass: apexLibClass,
    methodName: 'test2',
    outcome: ApexTestResultOutcome.Pass,
    runTime: 1,
    message: '',
    stackTrace: '',
    fullName: 'file0.test2',
    id: '0000x1432',
    queueItemId: '0000QUEUE',
    asyncApexJobId: '0000JOBID',
    apexLogId: '000LogID',
    testTimestamp: '00:00:000'
  }
];

export const apexLibOneFileResult = {
  summary: apexLibOneFileSummary,
  tests: apexLibOneFileTests
};

export const apexLibMultipleResult = {
  summary: apexLibMultipleSummary,
  tests: apexLibMultipleTests
};

const startPos = new vscode.Position(2, 0);
const endPos = new vscode.Position(2, 5);
const location = new vscode.Location(vscode.Uri.file('path/to/file0'), new vscode.Range(startPos, endPos));
const definingType = 'file0';
export const apexLibTestInfo = [
  { methodName: 'test0', definingType, location },
  { methodName: 'test1', definingType, location },
  { methodName: 'test2', definingType, location }
];
