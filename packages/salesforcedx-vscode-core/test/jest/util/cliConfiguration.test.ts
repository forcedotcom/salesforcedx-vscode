/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Mock child_process
const mockExecSync = jest.fn();
jest.mock('node:child_process', () => ({
  execSync: mockExecSync
}));

import { isCLIInstalled } from '../../../src/util';

describe('SFDX CLI Configuration utility', () => {
  describe('isCLIInstalled', () => {
    let consoleErrorSpy: jest.SpyInstance;
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
      jest.clearAllMocks();
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('Should return true if sfdx command works', () => {
      const mockOutput = Buffer.from('sfdx-cli/7.142.1 darwin-x64 node-v16.16.0');
      mockExecSync.mockReturnValue(mockOutput);

      const response = isCLIInstalled();

      expect(mockExecSync).toHaveBeenCalledWith('sfdx --version');
      expect(consoleLogSpy).toHaveBeenCalledWith(mockOutput.toString());
      expect(response).toEqual(true);
    });

    it('Should return false if sfdx command throws', () => {
      const mockError = new Error('Command not found: sfdx');
      mockExecSync.mockImplementation(() => {
        throw mockError;
      });

      const response = isCLIInstalled();

      expect(mockExecSync).toHaveBeenCalledWith('sfdx --version');
      expect(consoleErrorSpy).toHaveBeenCalledWith('An error happened while looking for sfdx cli', mockError);
      expect(response).toEqual(false);
    });

    it('Should handle non-Error throws', () => {
      mockExecSync.mockImplementation(() => {
        // eslint-disable-next-line no-throw-literal
        throw 'string error';
      });

      const response = isCLIInstalled();

      expect(mockExecSync).toHaveBeenCalledWith('sfdx --version');
      expect(consoleErrorSpy).toHaveBeenCalledWith('An error happened while looking for sfdx cli', 'string error');
      expect(response).toEqual(false);
    });
  });
});
