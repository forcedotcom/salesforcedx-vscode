/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { ensureCurrentWorkingDirIsProjectPath } from '../../../src';

jest.mock('vscode');
const vscodeMocked = jest.mocked(vscode);

describe('ensureCurrentWorkingDirIsProjectPath', () => {
  let fsExistsSpy: jest.SpyInstance;
  let processCwdSpy: jest.SpyInstance;
  let processChDirSpy: jest.SpyInstance;
  const dummyProjectPath = 'a/project/path';
  const dummyDefaultPath = '/';

  beforeEach(() => {
    fsExistsSpy = jest.spyOn(vscodeMocked.workspace.fs, 'stat');
    processCwdSpy = jest.spyOn(process, 'cwd');
    processChDirSpy = jest.spyOn(process, 'chdir').mockImplementation(jest.fn());
  });

  it('should change the processes current working directory to the project directory', async () => {
    processCwdSpy.mockReturnValue(dummyDefaultPath);
    fsExistsSpy.mockResolvedValue({ type: 2 });

    await ensureCurrentWorkingDirIsProjectPath(dummyProjectPath);

    expect(processChDirSpy).toHaveBeenCalledWith(dummyProjectPath);
  });

  it('should not change the processes current working directory when already in the project directory', async () => {
    processCwdSpy.mockReturnValue(dummyProjectPath);

    await ensureCurrentWorkingDirIsProjectPath(dummyProjectPath);

    expect(processChDirSpy).not.toHaveBeenCalled();
  });

  it('should not change the processes current working directory when the project path does not exist', async () => {
    processCwdSpy.mockReturnValue(dummyDefaultPath);
    fsExistsSpy.mockRejectedValue(new Error('File not found'));

    await ensureCurrentWorkingDirIsProjectPath(dummyProjectPath);

    expect(processChDirSpy).not.toHaveBeenCalled();
  });
});
