/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LocalComponent, workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { OverwriteComponentPrompt } from '../../../src/commands/util';

describe('Postcondition Checkers', () => {
  describe('OverwriteComponentPrompt', () => {
    let existsSyncSpy: jest.SpyInstance;
    let promptOverwriteSpy: jest.SpyInstance;
    const checker = new OverwriteComponentPrompt();

    beforeEach(() => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation(jest.fn());
      promptOverwriteSpy = jest.spyOn(checker, 'promptOverwrite').mockImplementation(jest.fn());
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    describe('Check Components Exist', () => {
      const pathExists = (value: boolean, forComponent: LocalComponent, withExtension: string) => {
        const path = join(
          workspaceUtils.getRootWorkspacePath(),
          `package/tests/${forComponent.fileName}${withExtension}`
        );
        existsSyncSpy.mockImplementation(inputPath => inputPath === path && value);
      };

      it('Should prompt overwrite for LightningType components that exist', async () => {
        existsSyncSpy.mockReturnValue(true);
        const data = {
          fileName: 'Test1',
          outputdir: 'package/tests',
          type: 'LightningTypeBundle',
          suffix: 'json'
        };
        pathExists(true, data, '/schema.json');
        await checker.check({ type: 'CONTINUE', data });
        expect(promptOverwriteSpy).toHaveBeenCalledWith([data]);
      });

      it('Should not prompt overwrite for LightningType components that do not exist', async () => {
        existsSyncSpy.mockReturnValue(false);
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
