/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import { ensureCurrentWorkingDirIsProjectPath } from '../../../src';

describe('ensureCurrentWorkingDirIsProjectPath', () => {
  let fsExistsSyncSpy: jest.SpyInstance;
  let processCwdSpy: jest.SpyInstance;
  let processChDirSpy: jest.SpyInstance;
  const dummyProjectPath = 'a/project/path';
  const dummyDefaultPath = '/';

  beforeEach(() => {
    fsExistsSyncSpy = jest.spyOn(fs, 'existsSync');
    processCwdSpy = jest.spyOn(process, 'cwd');
    processChDirSpy = jest
      .spyOn(process, 'chdir')
      .mockImplementation(jest.fn());
  });

  it('should change the processes current working directory to the project directory', () => {
    processCwdSpy.mockReturnValue(dummyDefaultPath);
    fsExistsSyncSpy.mockReturnValue(true);

    ensureCurrentWorkingDirIsProjectPath(dummyProjectPath);

    expect(processChDirSpy).toHaveBeenCalledWith(dummyProjectPath);
  });

  it('should not change the processes current working directory when already in the project directory', () => {
    processCwdSpy.mockReturnValue(dummyProjectPath);

    ensureCurrentWorkingDirIsProjectPath(dummyProjectPath);

    expect(processChDirSpy).not.toHaveBeenCalled();
  });

  it('should not change the processes current working directory when the project path does not exist', () => {
    processCwdSpy.mockReturnValue(dummyDefaultPath);
    fsExistsSyncSpy.mockReturnValue(false);

    ensureCurrentWorkingDirIsProjectPath(dummyProjectPath);

    expect(processChDirSpy).not.toHaveBeenCalled();
  });
});
