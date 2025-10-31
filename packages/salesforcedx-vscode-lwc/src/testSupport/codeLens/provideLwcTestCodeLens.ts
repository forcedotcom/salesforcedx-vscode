/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { parse, ItBlock, DescribeBlock } from 'jest-editor-support';
import { CancellationToken, CodeLens, Command, Position, Range, TextDocument, extensions } from 'vscode';
import { nls } from '../../messages';
import { TestExecutionInfo, TestInfoKind, TestType } from '../types';

/**
 * Check if the Jest Runner extension is present and active
 */
const isJestRunnerExtensionPresent = (): boolean => {
  const jestRunnerExtension = extensions.getExtension('firsttris.vscode-jest-runner');
  return jestRunnerExtension?.isActive ?? false;
};

/**
 * Provide "Run Test" and "Debug Test" Code Lens for LWC tests (both it and describe blocks).
 * We can move this implementation to lightning language server in the future.
 * Code lenses are hidden when Jest Runner extension is present to avoid duplicate code lenses.
 *
 * @param document text document
 * @param token cancellation token
 */
/**
 * Create code lenses for a test block (it or describe)
 */
const createCodeLensesForTestBlock = (
  testBlock: ItBlock | DescribeBlock,
  document: TextDocument,
  isDescribeBlock: boolean
): CodeLens[] => {
  const { name, nameRange } = testBlock;
  // VS Code position is zero-based
  const range = new Range(
    new Position(nameRange.start.line - 1, nameRange.start.column - 1),
    new Position(nameRange.end.line - 1, nameRange.end.column - 1)
  );

  const testExecutionInfo: TestExecutionInfo = {
    kind: TestInfoKind.TEST_CASE,
    testType: TestType.LWC,
    testUri: document.uri,
    testName: name
  };

  // Use different titles for describe blocks vs it blocks
  const runTestTitle = isDescribeBlock
    ? nls.localize('run_all_tests_title') || 'Run All Tests'
    : nls.localize('run_test_title') || 'Run Test';
  const runTestCaseCommand: Command = {
    command: 'sf.lightning.lwc.test.case.run',
    title: runTestTitle,
    tooltip: runTestTitle,
    arguments: [{ testExecutionInfo }]
  };
  const runTestCaseCodeLens = new CodeLens(range, runTestCaseCommand);

  const debugTestTitle = isDescribeBlock
    ? nls.localize('debug_all_tests_title') || 'Debug All Tests'
    : nls.localize('debug_test_title') || 'Debug Test';
  const debugTestCaseCommand: Command = {
    command: 'sf.lightning.lwc.test.case.debug',
    title: debugTestTitle,
    tooltip: debugTestTitle,
    arguments: [{ testExecutionInfo }]
  };
  const debugTestCaseCodeLens = new CodeLens(range, debugTestCaseCommand);

  return [runTestCaseCodeLens, debugTestCaseCodeLens];
};

export const provideLwcTestCodeLens = (document: TextDocument, _token: CancellationToken): CodeLens[] => {
  // Hide code lenses if Jest Runner extension is present to avoid duplicate code lenses
  if (isJestRunnerExtensionPresent()) {
    return [];
  }

  const fsPath = document.uri.fsPath;
  const parseResults = parse(fsPath, document.getText());
  const { itBlocks, describeBlocks } = parseResults;

  const itBlockCodeLenses = itBlocks.flatMap(itBlock => createCodeLensesForTestBlock(itBlock, document, false));
  const describeBlockCodeLenses = describeBlocks.flatMap(describeBlock =>
    createCodeLensesForTestBlock(describeBlock, document, true)
  );

  return [...itBlockCodeLenses, ...describeBlockCodeLenses];
};
