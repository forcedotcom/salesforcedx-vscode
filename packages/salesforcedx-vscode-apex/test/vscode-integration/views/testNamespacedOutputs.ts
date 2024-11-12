/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ApexTestResultData, ApexTestResultOutcome } from '@salesforce/apex-node-bundle';
import * as vscode from 'vscode';
import { apexLibMultipleSummary, apexLibOneFileSummary } from './testJSONOutputs';

const apexLibClass = {
  id: 'fakeId',
  name: 'file0',
  namespacePrefix: 'tester',
  fullName: 'tester.file0'
};

const apexLibOneFileTests: ApexTestResultData[] = [
  {
    apexClass: apexLibClass,
    methodName: 'test0',
    outcome: ApexTestResultOutcome.Pass,
    runTime: 1,
    message: '',
    stackTrace: '',
    fullName: 'tester.file0.test0',
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
    fullName: 'tester.file0.test0',
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
    fullName: 'tester.file0.test1',
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
    fullName: 'tester.file0.test2',
    id: '0000x1432',
    queueItemId: '0000QUEUE',
    asyncApexJobId: '0000JOBID',
    apexLogId: '000LogID',
    testTimestamp: '00:00:000'
  }
];

export const apexLibNsResult = {
  summary: apexLibOneFileSummary,
  tests: apexLibOneFileTests
};

export const apexLibMultipleNsResult = {
  summary: apexLibMultipleSummary,
  tests: apexLibMultipleTests
};

const startPos = new vscode.Position(2, 0);
const endPos = new vscode.Position(2, 5);
const location = new vscode.Location(vscode.Uri.file('path/to/file0'), new vscode.Range(startPos, endPos));
const definingType = 'tester.file0';
export const apexLibNsTestInfo = [
  { methodName: 'test0', definingType, location },
  { methodName: 'test1', definingType, location },
  { methodName: 'test2', definingType, location }
];

const fakeApexClasses = [];
for (let i = 0; i < 4; i++) {
  fakeApexClasses.push({
    attributes: { type: 'FakeType' },
    Id: 'fakeId',
    Name: `file${i}`,
    NamespacePrefix: 'tester'
  });
}
