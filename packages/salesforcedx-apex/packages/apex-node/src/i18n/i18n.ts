/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Conventions:
 * _message: is for unformatted text that will be shown as-is to
 * the user.
 * _text: is for text that will appear in the UI, possibly with
 * decorations, e.g., $(x) uses the https://octicons.github.com/ and should not
 * be localized
 *
 * If ommitted, we will assume _message.
 */
export const messages = {
  unexpectedExecuteCommandError:
    'Unexpected error while executing anonymous apex. %s',
  fileNotFoundError: 'File not found at the specified path: %s',
  missingInfoLogError:
    'To retrieve logs, specify the log ID or the number of logs.',
  numLogsError: 'Expected number of logs to be greater than 0.',
  optionExecAnonError: 'Please specify an option to execute anonymous Apex.',
  unexpectedExecAnonInputError: 'Unexpected error while reading user input. %s',
  execAnonInputPrompt:
    'Start typing Apex code. Press the Enter key after each line, then press CTRL+D when finished.\n',
  execAnonInputTimeout: 'Timed out while waiting for user input.',
  noTestResultSummary: 'No test results were found for test run %s',
  noTestQueueResults: 'No test results were found in the queue for test run %s',
  noAccessTokenFound:
    'No access token could be found for the provided username',
  streamingHandshakeFail: 'Test run handshake failed: %s',
  streamingTransportUp: 'Listening for streaming state changes...',
  streamingTransportDown: 'Faye client generated a transport:down event.',
  streamingProcessingTestRun: 'Processing test run %s',
  retrievingTestRunSummary: 'Retrieving test run summary record',
  queryingForAggregateCodeCoverage:
    'Querying for aggregate code coverage results',
  abortingTestRun: 'Aborting test run %s',
  abortingTestRunRequested: 'Test run %s is aborted',
  failRate: 'Fail Rate',
  testsRan: 'Tests Ran',
  orgId: 'Org Id',
  outcome: 'Outcome',
  passRate: 'Pass Rate',
  skipRate: 'Skip Rate',
  testStartTime: 'Test Start Time',
  testExecutionTime: 'Test Execution Time',
  testRunId: 'Test Run Id',
  userId: 'User Id',
  username: 'Username',
  orgWideCoverage: 'Org Wide Coverage',
  nameColHeader: 'NAME',
  valueColHeader: 'VALUE',
  testSummaryHeader: 'Test Summary',
  testNameColHeader: 'TEST NAME',
  outcomeColHeader: 'OUTCOME',
  msgColHeader: 'MESSAGE',
  runtimeColHeader: 'RUNTIME (MS)',
  testResultsHeader: 'Test Results',
  classesColHeader: 'CLASSES',
  percentColHeader: 'PERCENT',
  classTestedHeader: 'CLASS BEING TESTED',
  uncoveredLinesColHeader: 'UNCOVERED LINES',
  codeCovHeader: 'Apex Code Coverage by Class',
  detailedCodeCovHeader: 'Apex Code Coverage for Test Run %s',
  syncClassErr:
    'Synchronous test runs can include test methods from only one Apex class. Omit the --synchronous flag or include tests from only one class',
  resultFormatErr:
    'Specified result formats must be of type json, junit, or tap',
  invalidTestRunIdErr: `The test run id %s isn't in the correct format for "id." The ID is a 15- or 18-character string in the format "707xxxxxxxxxxxx"`,
  invalidsObjectErr: `You don't have permissions to access sObject of type %s. Ask your Salesforce admin to give you permissions to access Apex code and the Streaming API. \nError: %s`,
  payloadErr:
    'Specify a test class or test methods when running tests synchronously',
  suitenameErr:
    'Must provide a suite name or suite id to retrieve test classes in suite',
  missingSuiteErr: 'Suite does not exist',
  missingTestClassErr: 'Apex class %s does not exist in the org',
  testSuiteMsg: 'Apex test class %s already exists in Apex test suite %s',
  classSuiteMsg: `Added Apex class %s to your Apex test suite %s`
};
