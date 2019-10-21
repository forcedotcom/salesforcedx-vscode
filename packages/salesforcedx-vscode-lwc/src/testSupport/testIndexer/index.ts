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
  IExtendedParseResults,
  ItBlockWithAncestorTitles,
  populateAncestorTitles
} from './jestUtils';

import {
  LwcJestTestResults,
  RawTestResult,
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
    const { fsPath: testFsPath } = testUri;
    let testFileInfo = this.testFileInfoMap.get(testFsPath);
    if (!testFileInfo) {
      testFileInfo = this.indexTestFile(testFsPath);
    }
    if (testFileInfo.testCasesInfo) {
      return testFileInfo.testCasesInfo;
    }
    try {
      const parseResults = parse(testFsPath) as IExtendedParseResults;
      populateAncestorTitles(parseResults);
      const itBlocks = (parseResults.itBlocksWithAncestorTitles ||
        parseResults.itBlocks) as ItBlockWithAncestorTitles[];
      const testCasesInfo: TestCaseInfo[] = itBlocks.map(itBlock => {
        const { name, nameRange, ancestorTitles } = itBlock;
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
          testLocation,
          ancestorTitles
        };
        return testCaseInfo;
      });
      if (testFileInfo.rawTestResults) {
        this.mergeTestResults(testCasesInfo, testFileInfo.rawTestResults);
      }
      testFileInfo.testCasesInfo = testCasesInfo;
      return testCasesInfo;
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  public indexTestFile(testFsPath: string): TestFileInfo {
    const testUri = vscode.Uri.file(testFsPath);
    const testLocation = new vscode.Location(
      testUri,
      new vscode.Position(0, 0)
    );
    const testFileInfo: TestFileInfo = {
      kind: TestInfoKind.TEST_FILE,
      testType: TestType.LWC,
      testUri,
      testLocation
    };
    this.testFileInfoMap.set(testFsPath, testFileInfo);
    return testFileInfo;
  }

  private mergeTestResults(
    testCasesInfo: TestCaseInfo[],
    rawTestResults: RawTestResult[]
  ) {
    const rawTestResultsByTitle = new Map<string, RawTestResult[]>();
    rawTestResults.forEach(rawTestResult => {
      const { title } = rawTestResult;
      rawTestResultsByTitle.set(title, [
        ...(rawTestResultsByTitle.get(title) || []),
        rawTestResult
      ]);
    });

    testCasesInfo.forEach(testCaseInfo => {
      const { testName, ancestorTitles: testCaseAncestorTitles } = testCaseInfo;

      const rawTestResultsOfTestName = rawTestResultsByTitle.get(testName);
      if (rawTestResultsOfTestName) {
        const matchedRawTestResults = rawTestResultsOfTestName.filter(
          rawTestResultOfTestName => {
            const { title, ancestorTitles } = rawTestResultOfTestName;
            // match ancestor titles if possible
            const isMatched = testCaseAncestorTitles
              ? testName === title &&
                JSON.stringify(testCaseAncestorTitles) ===
                  JSON.stringify(ancestorTitles)
              : testName === title;
            return isMatched;
          }
        );
        if (matchedRawTestResults && matchedRawTestResults.length > 0) {
          testCaseInfo.testResult = {
            status: matchedRawTestResults[0].status
          };
        }
      }
    });
  }

  public updateTestResults(testResults: LwcJestTestResults) {
    testResults.testResults.forEach(testResult => {
      const {
        name: testFsPath,
        status: testFileStatus,
        assertionResults
      } = testResult;
      let testFileInfo = this.testFileInfoMap.get(testFsPath);
      if (!testFileInfo) {
        // If testFileInfo not found index it by fsPath.
        // it should be handled by file watcher on creating file, but just in case.
        testFileInfo = this.indexTestFile(testFsPath);
      }
      let testFileResultStatus: TestResultStatus = TestResultStatus.UNKNOWN;
      if (testFileStatus === 'passed') {
        testFileResultStatus = TestResultStatus.PASSED;
      } else if (testFileStatus === 'failed') {
        testFileResultStatus = TestResultStatus.FAILED;
      }
      testFileInfo.testResult = {
        status: testFileResultStatus
      };

      // Generate test results
      const rawTestResults: RawTestResult[] = assertionResults.map(
        assertionResult => {
          const { title, status, ancestorTitles } = assertionResult;
          let testResultStatus: TestResultStatus;
          if (status === 'passed') {
            testResultStatus = TestResultStatus.PASSED;
          } else if (status === 'failed') {
            testResultStatus = TestResultStatus.FAILED;
          } else {
            testResultStatus = TestResultStatus.SKIPPED;
          }
          const testCaseInfo: RawTestResult = {
            title,
            status: testResultStatus,
            ancestorTitles
          };
          return testCaseInfo;
        }
      );

      // Set raw test results
      testFileInfo.rawTestResults = rawTestResults;
      const testCasesInfo = testFileInfo.testCasesInfo;
      if (testCasesInfo) {
        // Merge if test case info is available,
        // If it's not available at the moment, merging will happen on parsing the test file
        this.mergeTestResults(testCasesInfo, rawTestResults);
      }
    });
    // Update Test Explorer View
    this.onDidUpdateTestResultsIndex.fire();
  }
}
export const lwcTestIndexer = new LwcTestIndexer();
