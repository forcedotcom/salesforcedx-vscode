/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export type FullTestResult = {
  summary: TestSummary;
  tests: TestResult[];
};

export type TestSummary = {
  outcome: string;
  testsRan: number;
  passing: number;
  failing: number;
  skipped: number;
  passRate: string;
  failRate: string;
  testStartTime: string;
  testExecutionTime: string;
  testTotalTime: string;
  commandTime: string;
  hostname: string;
  orgId: string;
  username: string;
  testRunId: string;
  userId: string;
};

export class TestSummarizer {
  public static summarize(summary: TestSummary): string {
    let summString = '';
    summString = summString + 'Outcome: ' + summary.outcome + '\n';
    summString = summString + 'Tests Ran: ' + summary.testsRan + '\n';
    summString = summString + 'Passing: ' + summary.passing + '\n';
    summString = summString + 'Failing: ' + summary.failing + '\n';
    summString = summString + 'Skipped: ' + summary.skipped + '\n';
    summString = summString + 'Pass Rate: ' + summary.passRate + '\n';
    summString = summString + 'Fail Rate: ' + summary.failRate + '\n';
    summString = summString + 'Test Start Time: ' + summary.testStartTime + '\n';
    summString = summString + 'Test Execution Time: ' + summary.testExecutionTime + '\n';
    summString = summString + 'Test Total Time: ' + summary.testTotalTime + '\n';
    summString = summString + 'Command Time: ' + summary.commandTime + '\n';
    summString = summString + 'Hostname: ' + summary.hostname + '\n';
    summString = summString + 'Org Id: ' + summary.orgId + '\n';
    summString = summString + 'Username: ' + summary.username + '\n';
    summString = summString + 'Test Run Id: ' + summary.testRunId + '\n';
    summString = summString + 'User Id: ' + summary.userId;
    return summString;
  }
}

export type TestResult = {
  ApexClass: ApexClass;
  MethodName: string;
  Outcome: string;
  RunTime: number;
  Message: string;
  StackTrace: string;
  FullName: string;
};

export type ApexClass = {
  attributes: { type: string };
  Id: string;
  Name: string;
  NamespacePrefix: string;
};
