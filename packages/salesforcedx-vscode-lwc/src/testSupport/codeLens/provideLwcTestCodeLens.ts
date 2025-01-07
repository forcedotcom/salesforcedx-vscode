/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { parse } from 'jest-editor-support';
import { CancellationToken, CodeLens, Command, Position, Range, TextDocument } from 'vscode';
import { nls } from '../../messages';
import { TestExecutionInfo, TestInfoKind, TestType } from '../types';

/**
 * Provide "Run Test" and "Debug Test" Code Lens for LWC tests.
 * We can move this implementation to lightning language server in the future.
 *
 * @param document text document
 * @param token cancellation token
 */
export const provideLwcTestCodeLens = async (
  document: TextDocument,

  token: CancellationToken
): Promise<CodeLens[]> => {
  const fsPath = document.uri.fsPath;
  const parseResults = parse(fsPath, document.getText());
  const { itBlocks } = parseResults;
  return itBlocks
    .map(itBlock => {
      const { name, nameRange } = itBlock;
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
      const runTestTitle = nls.localize('run_test_title');
      const runTestCaseCommand: Command = {
        command: 'sf.lightning.lwc.test.case.run',
        title: runTestTitle,
        tooltip: runTestTitle,
        arguments: [{ testExecutionInfo }]
      };
      const runTestCaseCodeLens = new CodeLens(range, runTestCaseCommand);

      const debugTestTitle = nls.localize('debug_test_title');
      const debugTestCaseCommand: Command = {
        command: 'sf.lightning.lwc.test.case.debug',
        title: debugTestTitle,
        tooltip: debugTestTitle,
        arguments: [{ testExecutionInfo }]
      };
      const debugTestCaseCodeLens = new CodeLens(range, debugTestCaseCommand);
      return [runTestCaseCodeLens, debugTestCaseCodeLens];
    })
    .reduce((xs, x) => xs.concat(x), []);
};
