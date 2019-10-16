/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { parse } from 'jest-editor-support';
import { Indexer } from 'lightning-lsp-common';
import * as vscode from 'vscode';

import { TestExecutionInfo, TestType } from '../types';
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

const testInfoMap = new Map<vscode.Uri, TestExecutionInfo[]>();

// Lazy parse test information, until expand the test file or provide code lens
export async function findTestInfoFromLwcJestTestFile(testUri: vscode.Uri) {
  if (testInfoMap.has(testUri)) {
    return testInfoMap.get(testUri);
  }
  // parse
  const { fsPath } = testUri;
  const { itBlocks } = parse(fsPath);
  const testInfo = itBlocks.map(itBlock => {
    const { name, nameRange, start, end } = itBlock;
    const testName = name;
    const testRange = new vscode.Range(
      new vscode.Position(nameRange.start.line - 1, nameRange.start.column - 1),
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
  testInfoMap.set(testUri, testInfo);
  return testInfo;
}

// findLwcTestFiles().catch(error => {});
