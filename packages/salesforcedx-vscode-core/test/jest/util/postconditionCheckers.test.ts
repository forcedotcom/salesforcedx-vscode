/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { OverwriteComponentPrompt } from '../../../src/commands/util';

describe('Postcondition Checkers', () => {
  describe('OverwriteComponentPrompt', () => {
    let statSpy: jest.SpyInstance;
    let promptOverwriteSpy: jest.SpyInstance;
    const checker = new OverwriteComponentPrompt();

    beforeEach(() => {
      statSpy = jest.spyOn(vscode.workspace.fs, 'stat');
      promptOverwriteSpy = jest.spyOn(checker, 'promptOverwrite').mockImplementation(jest.fn());
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    describe('Check Components Exist', () => {
      it('Should prompt overwrite for LightningType components that exist', async () => {
        statSpy.mockResolvedValue({ type: vscode.FileType.File } as vscode.FileStat);
        const data = {
          fileName: 'Test1',
          outputdir: 'package/tests',
          type: 'LightningTypeBundle',
          suffix: 'json'
        };
        await checker.check({ type: 'CONTINUE', data });
        expect(promptOverwriteSpy).toHaveBeenCalledWith([data]);
      });

      it('Should not prompt overwrite for LightningType components that do not exist', async () => {
        statSpy.mockRejectedValue(new Error('File not found'));
        const data = {
          fileName: 'Test1',
          outputdir: 'package/tests',
          type: 'LightningTypeBundle',
          suffix: 'json'
        };
        await checker.check({ type: 'CONTINUE', data });
        expect(promptOverwriteSpy).not.toHaveBeenCalled();
      });
    });
  });
});
