/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Indexer } from '@salesforce/lightning-lsp-common';
import { parse } from 'jest-editor-support';
import * as vscode from 'vscode';
import {
  LwcJestTestResults,
  RawTestResult,
  TestCaseInfo,
  TestFileInfo,
  TestInfoKind,
  TestResultStatus,
  TestType
} from '../types';
import { LWC_TEST_GLOB_PATTERN } from '../types/constants';
import {
  extractPositionFromFailureMessage,
  IExtendedParseResults,
  ItBlockWithAncestorTitles,
  populateAncestorTitles,
  sanitizeFailureMessage
} from './jestUtils';

class LwcTestIndexer implements Indexer, vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private hasIndexedTestFiles = false;
  private testFileInfoMap = new Map<string, TestFileInfo>();
  private diagnosticCollection = vscode.languages.createDiagnosticCollection('lwcTestErrors');
  private onDidUpdateTestResultsIndexEventEmitter = new vscode.EventEmitter<undefined>();
  private onDidUpdateTestIndexEventEmitter = new vscode.EventEmitter<undefined>();
  public onDidUpdateTestResultsIndex = this.onDidUpdateTestResultsIndexEventEmitter.event;
  public onDidUpdateTestIndex = this.onDidUpdateTestIndexEventEmitter.event;

  /**
   * Register Test Indexer with extension context
   * @param extensionContext extension context
   */
  public register(extensionContext: vscode.ExtensionContext) {
    extensionContext.subscriptions.push(this);
    // It's actually a synchronous function to start file watcher.
    // Finding test files will only happen when going into test explorer
    // Parsing test files will happen when expanding on the test group nodes,
    // or open a test file, or on watched files change
    this.configureAndIndex().catch(error => console.error(error));
  }

  public dispose() {
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Set up file system watcher for test files change/create/delete.
   */
  public async configureAndIndex() {
    const lwcTestWatcher = vscode.workspace.createFileSystemWatcher(LWC_TEST_GLOB_PATTERN);
    lwcTestWatcher.onDidCreate(
      async testUri => {
        await this.indexTestCases(testUri);
        this.onDidUpdateTestIndexEventEmitter.fire(undefined);
      },
      this,
      this.disposables
    );
    lwcTestWatcher.onDidChange(
      async testUri => {
        await this.indexTestCases(testUri);
        this.onDidUpdateTestIndexEventEmitter.fire(undefined);
      },
      this,
      this.disposables
    );
    lwcTestWatcher.onDidDelete(
      testUri => {
        const { fsPath } = testUri;
        this.resetTestFileIndex(fsPath);
        this.onDidUpdateTestIndexEventEmitter.fire(undefined);
      },
      this,
      this.disposables
    );
  }

  /**
   * Reset test indexer
   */
  public resetIndex() {
    this.hasIndexedTestFiles = false;
    this.testFileInfoMap.clear();
    this.diagnosticCollection.clear();
    this.onDidUpdateTestIndexEventEmitter.fire(undefined);
  }

  /**
   * Find test files in the workspace if needed.
   * It lazily index all test files until opening test explorer
   */
  public async findAllTestFileInfo(): Promise<TestFileInfo[]> {
    if (this.hasIndexedTestFiles) {
      return [...this.testFileInfoMap.values()];
    }
    return await this.indexAllTestFiles();
  }

  public async indexTestCases(testUri: vscode.Uri) {
    // parse
    const { fsPath: testFsPath } = testUri;
    let testFileInfo = this.testFileInfoMap.get(testFsPath);
    if (!testFileInfo) {
      testFileInfo = this.indexTestFile(testFsPath);
    }
    return this.parseTestFileAndMergeTestResults(testFileInfo);
  }

  /**
   * Parse and create test case information if needed.
   * It lazily parses test information, until expanding the test file or providing code lens
   * @param testUri uri of test file
   */
  public async findTestInfoFromLwcJestTestFile(testUri: vscode.Uri): Promise<TestCaseInfo[]> {
    // parse
    const { fsPath: testFsPath } = testUri;
    let testFileInfo = this.testFileInfoMap.get(testFsPath);
    if (!testFileInfo) {
      testFileInfo = this.indexTestFile(testFsPath);
    }
    if (testFileInfo.testCasesInfo) {
      return testFileInfo.testCasesInfo;
    }
    return this.parseTestFileAndMergeTestResults(testFileInfo);
  }

  private parseTestFileAndMergeTestResults(testFileInfo: TestFileInfo): TestCaseInfo[] {
    try {
      const { testUri } = testFileInfo;
      const { fsPath: testFsPath } = testUri;
      const parseResults = parse(testFsPath) as IExtendedParseResults;
      populateAncestorTitles(parseResults);
      const itBlocks = (parseResults.itBlocksWithAncestorTitles ||
        parseResults.itBlocks) as ItBlockWithAncestorTitles[];
      const testCasesInfo: TestCaseInfo[] = itBlocks.map(itBlock => {
        const { name, nameRange, ancestorTitles } = itBlock;
        const testName = name;
        const testRange = new vscode.Range(
          new vscode.Position(nameRange.start.line - 1, nameRange.start.column - 1),
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
      testFileInfo.testCasesInfo = [];
      return [];
    }
  }

  /**
   * Find all LWC test files in the workspace by glob pattern.
   * This does not start parsing the test files.
   */
  private async indexAllTestFiles(): Promise<TestFileInfo[]> {
    // TODO, infer package directory from sfdx-project.json
    const lwcJestTestFiles = await vscode.workspace.findFiles(LWC_TEST_GLOB_PATTERN, '**/node_modules/**');
    const allTestFileInfo = lwcJestTestFiles.map(lwcJestTestFile => {
      const { fsPath } = lwcJestTestFile;
      let testFileInfo = this.testFileInfoMap.get(fsPath);
      if (!testFileInfo) {
        testFileInfo = this.indexTestFile(fsPath);
      }
      return testFileInfo;
    });
    this.hasIndexedTestFiles = true;
    return allTestFileInfo;
  }

  private indexTestFile(testFsPath: string): TestFileInfo {
    const testUri = vscode.Uri.file(testFsPath);
    const testLocation = new vscode.Location(testUri, new vscode.Position(0, 0));
    const testFileInfo: TestFileInfo = {
      kind: TestInfoKind.TEST_FILE,
      testType: TestType.LWC,
      testUri,
      testLocation
    };
    this.testFileInfoMap.set(testFsPath, testFileInfo);
    return testFileInfo;
  }

  private resetTestFileIndex(testFsPath: string) {
    this.testFileInfoMap.delete(testFsPath);
  }

  private mergeTestResults(testCasesInfo: TestCaseInfo[], rawTestResults: RawTestResult[]) {
    const rawTestResultsByTitle = new Map<string, RawTestResult[]>();
    rawTestResults.forEach(rawTestResult => {
      const { title } = rawTestResult;
      rawTestResultsByTitle.set(title, [...(rawTestResultsByTitle.get(title) || []), rawTestResult]);
    });

    testCasesInfo.forEach(testCaseInfo => {
      const { testName, ancestorTitles: testCaseAncestorTitles } = testCaseInfo;

      const rawTestResultsOfTestName = rawTestResultsByTitle.get(testName);
      if (rawTestResultsOfTestName) {
        const matchedRawTestResults = rawTestResultsOfTestName.filter(rawTestResultOfTestName => {
          const { title, ancestorTitles } = rawTestResultOfTestName;
          // match ancestor titles if possible
          const isMatched = testCaseAncestorTitles
            ? testName === title && JSON.stringify(testCaseAncestorTitles) === JSON.stringify(ancestorTitles)
            : testName === title;
          return isMatched;
        });
        if (matchedRawTestResults && matchedRawTestResults.length > 0) {
          testCaseInfo.testResult = {
            status: matchedRawTestResults[0].status
          };
        }
      }
    });
  }

  /**
   * Update and merge Jest test results with test locations.
   * Upon finishing update, it emits an event to update the test explorer.
   * @param testResults test result JSON object provided by test result watcher
   */
  public updateTestResults(testResults: LwcJestTestResults) {
    testResults.testResults.forEach(testResult => {
      const { name, status: testFileStatus, assertionResults } = testResult;
      const testFsPath = vscode.Uri.file(name).fsPath;
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

      const testUri = vscode.Uri.file(testFsPath);
      const diagnostics = assertionResults.reduce((diagnosticsResult: vscode.Diagnostic[], assertionResult) => {
        const { failureMessages, location } = assertionResult;
        if (failureMessages && failureMessages.length > 0) {
          const failureMessage = sanitizeFailureMessage(failureMessages[0]);
          const failurePosition =
            extractPositionFromFailureMessage(testFsPath, failureMessage) ||
            new vscode.Position(location.line - 1, location.column - 1);
          const diagnostic = new vscode.Diagnostic(new vscode.Range(failurePosition, failurePosition), failureMessage);
          diagnosticsResult.push(diagnostic);
        }
        return diagnosticsResult;
      }, []);
      this.diagnosticCollection.set(testUri, diagnostics);

      // Generate test results
      const rawTestResults: RawTestResult[] = assertionResults.map(assertionResult => {
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
      });

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
    this.onDidUpdateTestResultsIndexEventEmitter.fire(undefined);
  }
}
export const lwcTestIndexer = new LwcTestIndexer();
