/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { JestTotalResults, parse } from 'jest-editor-support';
import { Indexer } from 'lightning-lsp-common';
import * as vscode from 'vscode';

import {
  LwcJestTestResults,
  TestCaseInfo,
  TestExecutionInfo,
  TestFileInfo,
  TestInfoKind,
  TestResultStatus,
  TestType
} from '../types';
import { LWC_TEST_GLOB_PATTERN } from '../types/constants';

class LwcTestIndexer implements Indexer {
  private allTestFileInfo?: TestFileInfo[];
  private testFileInfoMap = new Map<string, TestFileInfo>();
  private testCaseInfoMap = new Map<string, TestCaseInfo[]>();
  public onDidUpdateTestResultsIndex = new vscode.EventEmitter<undefined>();

  public async configureAndIndex() {
    // find lwc test files
    // watch for file change, create and delete
  }
  public resetIndex() {
    // TODO: reset the test index. Clear & refind test files and test results.
    // Resetting index for specific file? for file test explorer view
    this.allTestFileInfo = undefined;
    return this.findAllTestFileInfo();
  }
  public async handleWatchedFiles() {}

  public async findAllTestFileInfo(): Promise<TestFileInfo[]> {
    if (this.allTestFileInfo) {
      return this.allTestFileInfo;
    }

    this.testFileInfoMap.clear();
    // TODO, infer package directory from sfdx project json
    const lwcJestTestFiles = await vscode.workspace.findFiles(
      LWC_TEST_GLOB_PATTERN
    );
    const allTestFileInfo = lwcJestTestFiles.map(lwcJestTestFile => {
      const { fsPath } = lwcJestTestFile;
      const testLocation = new vscode.Location(
        lwcJestTestFile,
        new vscode.Position(0, 0)
      );
      const testFileInfo: TestFileInfo = {
        kind: TestInfoKind.TEST_FILE,
        testType: TestType.LWC,
        testUri: lwcJestTestFile,
        testLocation
      };
      this.testFileInfoMap.set(fsPath, testFileInfo);
      return testFileInfo;
    });
    this.allTestFileInfo = allTestFileInfo;
    return allTestFileInfo;
  }

  // Lazy parse test information, until expand the test file or provide code lens
  public async findTestInfoFromLwcJestTestFile(
    testUri: vscode.Uri
  ): Promise<TestCaseInfo[]> {
    // parse
    const { fsPath } = testUri;
    if (this.testCaseInfoMap.has(fsPath)) {
      return this.testCaseInfoMap.get(fsPath) || [];
    }
    try {
      const { itBlocks } = parse(fsPath);
      const testInfo: TestCaseInfo[] = itBlocks.map(itBlock => {
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
        const testCaseInfo: TestCaseInfo = {
          kind: TestInfoKind.TEST_CASE,
          testType: TestType.LWC,
          testName,
          testUri,
          testLocation
        };
        return testCaseInfo;
      });
      this.testCaseInfoMap.set(fsPath, testInfo);
      return testInfo;
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  public updateTestResults(testResults: LwcJestTestResults) {
    // update test outline provider
    testResults.testResults.forEach(testResult => {
      const {
        name: testFsPath,
        status: testFileStatus,
        assertionResults
      } = testResult;
      const testFileInfo = this.testFileInfoMap.get(testFsPath);
      if (testFileInfo) {
        let testResultStatus: TestResultStatus = TestResultStatus.UNKNOWN;
        if (testFileStatus === 'passed') {
          testResultStatus = TestResultStatus.PASSED;
        } else if (testFileStatus === 'failed') {
          testResultStatus = TestResultStatus.FAILED;
        }
        testFileInfo.testResult = {
          status: testResultStatus
        };
        // TODO (if testFileInfo not found index it by fsPath)
        // it should be handled by file watcher on creating file, but just in case.
      }
      if (this.testCaseInfoMap.has(testFsPath)) {
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
          const testCaseInfo: TestCaseInfo = {
            kind: TestInfoKind.TEST_CASE,
            testType: TestType.LWC,
            testName,
            testUri,
            testLocation,
            testResult: {
              status: testResultStatus
            }
          };
          return testCaseInfo;
        });
        this.testCaseInfoMap.set(testFsPath, testInfo);
      } else {
        // TODO
        // test case hasn't been indexed.
        // example run a test file without expanding on from the explorer
      }
    });
    // Update Test Explorer View
    this.onDidUpdateTestResultsIndex.fire();
  }
}
export const lwcTestIndexer = new LwcTestIndexer();
