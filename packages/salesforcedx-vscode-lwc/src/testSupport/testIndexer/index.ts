/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { JestTotalResults, parse } from 'jest-editor-support';
import { Indexer } from 'lightning-lsp-common';
import * as vscode from 'vscode';

import { TestExecutionInfo, TestResultStatus, TestType } from '../types';
import { LWC_TEST_GLOB_PATTERN } from '../types/constants';

export class LWCTestIndexer implements Indexer {
  public async configureAndIndex() {
    // find lwc test files
    // watch for file change, create and delete
  }
  public resetIndex() {}

  public async handleWatchedFiles() {}
}

export async function findLwcJestTestFiles(): Promise<vscode.Uri[]> {
  // TODO, infer package directory from sfdx project json
  const lwcJestTestFiles = await vscode.workspace.findFiles(
    LWC_TEST_GLOB_PATTERN
  );
  return lwcJestTestFiles;
}

const testInfoMap = new Map<string, TestExecutionInfo[]>();

// Lazy parse test information, until expand the test file or provide code lens
export async function findTestInfoFromLwcJestTestFile(
  testUri: vscode.Uri
): Promise<TestExecutionInfo[]> {
  // parse
  const { fsPath } = testUri;
  if (testInfoMap.has(fsPath)) {
    return testInfoMap.get(fsPath) || [];
  }
  try {
    const { itBlocks } = parse(fsPath);
    const testInfo: TestExecutionInfo[] = itBlocks.map(itBlock => {
      const { name, nameRange, start, end } = itBlock;
      const testName = name;
      const testRange = new vscode.Range(
        new vscode.Position(
          nameRange.start.line - 1,
          nameRange.start.column - 1
        ),
        new vscode.Position(nameRange.end.line - 1, nameRange.end.column)
      );
      const testLocation = new vscode.Location(testUri, testRange);
      return {
        testType: TestType.LWC,
        testName,
        testUri,
        testLocation
      };
    });
    testInfoMap.set(fsPath, testInfo);
    return testInfo;
  } catch (error) {
    console.error(error);
    return [];
  }
}

export interface LwcJestTestResults {
  numFailedTestSuites: number;
  numFailedTests: number;
  numPassedTestSuites: number;
  numPassedTests: number;
  numPendingTestSuites: number;
  numPendingTests: number;
  numRuntimeErrorTestSuites: number;
  numTotalTestSuites: number;
  numTotalTests: number;
  testResults: LwcJestTestFileResult[];
}

type LwcJestTestResultStatus =
  | 'passed'
  | 'failed'
  | 'pending'
  | 'skipped'
  | 'pending'
  | 'todo'
  | 'disabled';

export interface LwcJestTestFileResult {
  status: LwcJestTestResultStatus;
  startTime: number;
  endTime: number;
  name: string;
  assertionResults: LwcJestTestAssertionResult[];
}

export interface LwcJestTestAssertionResult {
  status: LwcJestTestResultStatus;
  title: string;
  ancestorTitles: string[];
  failureMessages: string[];
  fullName: string;
  location: {
    column: number;
    line: number;
  };
}

export const onDidUpdateTestResultsIndex = new vscode.EventEmitter<undefined>();

export function updateTestResults(testResults: LwcJestTestResults) {
  // update test outline provider
  testResults.testResults.forEach(testResult => {
    const {
      name: testFsPath,
      status: testFileStatus,
      assertionResults
    } = testResult;
    if (testInfoMap.has(testFsPath)) {
      const testInfo = assertionResults.map(assertionResult => {
        const { title: testName, status, location } = assertionResult;
        const testUri = vscode.Uri.file(testFsPath);
        const testRange = new vscode.Range(
          new vscode.Position(location.line - 1, location.column),
          new vscode.Position(location.line - 1, location.column + 5) // TODO
        );
        const testLocation = new vscode.Location(testUri, testRange);
        let testResultStatus: TestResultStatus;
        if (status === 'passed') {
          testResultStatus = TestResultStatus.PASSED;
        } else if (status === 'failed') {
          testResultStatus = TestResultStatus.FAILED;
        } else {
          testResultStatus = TestResultStatus.SKIPPED;
        }
        return {
          testType: TestType.LWC,
          testName,
          testUri,
          testLocation,
          testResult: {
            status: testResultStatus
          }
        };
      });
      testInfoMap.set(testFsPath, testInfo);

      // Update Test Explorer View
      onDidUpdateTestResultsIndex.fire();
    } else {
      // TODO
    }
  });
}

// TODO: reset the test index. Clear & refind test files and test results.
// Resetting index for specific file? for file test explorer view
// export function resetIndex() {}
