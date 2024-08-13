/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as vscode from 'vscode';
import { ContinueResponse } from '../../../src';
import { LibraryCommandletExecutor } from '../../../src/commands/commandletExecutors';

jest.mock('../../../src/commands/channelService');
jest.mock('vscode');

describe('commandletExecutors Unit Tests.', () => {
  describe('LibraryCommandletExecutor', () => {
    class TestLibraryCommandletExecutor<T> extends LibraryCommandletExecutor<T> {
      // eslint-disable-next-line @typescript-eslint/require-await
      public async run(
        response: ContinueResponse<T>,
        progress?: vscode.Progress<{
          message?: string | undefined;
          increment?: number | undefined; }>
          , token?: vscode.CancellationToken
        ): Promise<boolean> {
          return true;
      }
    }

    it('resolves with boolean success/fail response', async () => {
      const testLibraryCommandletExecutor = new TestLibraryCommandletExecutor('', '', vscode.window.createOutputChannel(''));

      const result = await testLibraryCommandletExecutor.execute({ type: 'CONTINUE', data: {} });

      expect(result).toBe(false);
    });
  });
});
