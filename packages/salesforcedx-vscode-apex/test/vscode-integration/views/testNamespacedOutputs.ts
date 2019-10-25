/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

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
