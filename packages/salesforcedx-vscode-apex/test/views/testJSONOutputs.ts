const summaryOneFile = {
  outcome: 'Pass',
  testsRan: 1,
  passing: 1,
  failing: 0,
  skipped: 0,
  passRate: '100%',
  failRate: '0%',
  testStartTime: 'Now',
  testExecutionTime: 'Later',
  testTotalTime: 'two',
  commandTime: '12',
  hostname: 'salesforce',
  orgId: 'org',
  username: 'name',
  testRunId: '1',
  userId: '1'
};

const summaryMultipleFiles = {
  outcome: 'Pass',
  testsRan: 8,
  passing: 6,
  failing: 0,
  skipped: 0,
  passRate: '75%',
  failRate: '25%',
  testStartTime: 'Now',
  testExecutionTime: 'Later',
  testTotalTime: 'two',
  commandTime: '12',
  hostname: 'salesforce',
  orgId: 'org',
  username: 'name',
  testRunId: '1',
  userId: '1'
};

const fakeApexClass = {
  attributes: { type: 'FakeType' },
  Id: 'fakeId',
  Name: 'fakeName',
  NamespacPrefix: 'fakeNamespace'
};
const testResultsOneFile = [
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

const testResultsMultipleFiles = [
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
    Message: '',
    StackTrace: '',
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
    Message: '',
    StackTrace: '',
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

export const jsonSummaryMultipleFiles = {
  summary: summaryMultipleFiles,
  tests: testResultsMultipleFiles
};

export const jsonSummaryOneFilePass = {
  summary: summaryOneFile,
  tests: testResultsOneFile
};
