/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Progress, CancellationToken } from 'vscode';
import * as vscode from 'vscode';
import { ContinueResponse, LibraryCommandletExecutor } from '../../../src';
import { ChannelService } from '../../../src/commands/channelService';
import { SettingsService } from '../../../src/settings';

class SimpleTestLibraryCommandletExecutor<T> extends LibraryCommandletExecutor<T> {
  public run(
    response: ContinueResponse<T>,
    progress?: Progress<{ message?: string | undefined; increment?: number | undefined }>,
    token?: CancellationToken): Promise<boolean> {
      return new Promise(resolve => {
        resolve(true);
      });
  }
}
jest.mock('../../../src/commands/channelService');

describe('LibraryCommandletExecutor', () => {

  it('should fire the onLibraryCommandCompletion event once the library command is done', async () => {
    const fireSpy = jest.spyOn(
      LibraryCommandletExecutor.libraryCommandCompletionEventEmitter,
      'fire'
    );
    const channel = vscode.window.createOutputChannel('simpleExecutorChannel');
    const executor = new SimpleTestLibraryCommandletExecutor('simpleExecutor', 'logName', channel);

    await executor.execute({} as ContinueResponse<{}>);

    expect(fireSpy).toHaveBeenCalledWith(false);
  });

  it('should not fire onLibraryCommandCompletion event if an error is thrown before try catch block', async () => {
    const fireSpy = jest.spyOn(
      LibraryCommandletExecutor.libraryCommandCompletionEventEmitter,
      'fire'
    );
    try {
      jest
        .spyOn(SettingsService, 'getEnableClearOutputBeforeEachCommand')
        .mockImplementation(() => {
          throw new Error();
        });
      const channel = vscode.window.createOutputChannel('simpleExecutorChannel');
      const executor = new SimpleTestLibraryCommandletExecutor('simpleExecutor', 'logName', channel);

      await executor.execute({} as ContinueResponse<{}>);
    } catch(e) {
      expect(fireSpy).not.toHaveBeenCalled();
    }
  });
});
