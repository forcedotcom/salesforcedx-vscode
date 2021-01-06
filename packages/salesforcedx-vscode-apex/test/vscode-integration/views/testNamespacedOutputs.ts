/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ApexTestResultData,
  ApexTestResultOutcome
} from '@salesforce/apex-node';
import * as vscode from 'vscode';
import {
  apexLibMultipleSummary,
  apexLibOneFileSummary,
  summaryMultipleFiles,
  summaryOneFile
} from './testJSONOutputs';

const apexLibClass = {
  id: 'fakeId',
  name: 'fakeName',
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
    message: '',
    stackTrace: 'Failure',
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
const location = new vscode.Location(
  vscode.Uri.file('path/to/file0'),
  new vscode.Range(startPos, endPos)
);
const definingType = 'tester.file0';
export const apexLibNsTestInfo = [
  { methodName: 'test0', definingType, location },
  { methodName: 'test1', definingType, location },
  { methodName: 'test2', definingType, location }
];

const fakeApexClass = {
  attributes: { type: 'FakeType' },
  Id: 'fakeId',
  Name: 'fakeName',
  NamespacePrefix: 'tester'
};

export const testResultsOneFile = [
  {
    ApexClass: fakeApexClass,
    MethodName: 'test0',
    Outcome: 'Pass',
    RunTime: 1,
    Message: '',
    StackTrace: '',
    FullName: 'file0.test0'
  }
];

export const testResultsMultipleFiles = [
  {
    ApexClass: fakeApexClass,
    MethodName: 'test0',
    Outcome: 'Pass',
    RunTime: 1,
    Message: '',
    StackTrace: '',
    FullName: 'file0.test0'
  },
  {
    ApexClass: fakeApexClass,
    MethodName: 'test1',
    Outcome: 'Fail',
    RunTime: 1,
    Message: 'System.AssertException: Assertion Failed',
    StackTrace: 'Class.fakeClass.test1: line 40, column 1',
    FullName: 'file0.test1'
  },
  {
    ApexClass: fakeApexClass,
    MethodName: 'test2',
    Outcome: 'Pass',
    RunTime: 1,
    Message: '',
    StackTrace: '',
    FullName: 'file1.test2'
  },
  {
    ApexClass: fakeApexClass,
    MethodName: 'test3',
    Outcome: 'Pass',
    RunTime: 1,
    Message: '',
    StackTrace: '',
    FullName: 'file1.test3'
  },
  {
    ApexClass: fakeApexClass,
    MethodName: 'test4',
    Outcome: 'Pass',
    RunTime: 1,
    Message: '',
    StackTrace: '',
    FullName: 'file2.test4'
  },
  {
    ApexClass: fakeApexClass,
    MethodName: 'test5',
    Outcome: 'Pass',
    RunTime: 1,
    Message: '',
    StackTrace: '',
    FullName: 'file2.test5'
  },
  {
    ApexClass: fakeApexClass,
    MethodName: 'test6',
    Outcome: 'Fail',
    RunTime: 1,
    Message: 'System.AssertException: Assertion Failed',
    StackTrace: 'Class.fakeClass.test6: line 22, column 1',
    FullName: 'file3.test6'
  },
  {
    ApexClass: fakeApexClass,
    MethodName: 'test7',
    Outcome: 'Pass',
    RunTime: 1,
    Message: '',
    StackTrace: '',
    FullName: 'file3.test7'
  }
];

export const jsonOneNSFilePass = {
  summary: summaryOneFile,
  tests: testResultsOneFile
};

export const jsonMultipleNSFiles = {
  summary: summaryMultipleFiles,
  tests: testResultsMultipleFiles
};
