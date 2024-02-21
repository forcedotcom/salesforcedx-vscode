/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LogStreamConfig } from '../../../../src/telemetry/reporters/logStreamConfig';

const fakePath = '/path/to/logs';
const VSCODE_LOGS = 'VSCODE_LOGS';
const VSCODE_LOG_LEVEL = 'VSCODE_LOG_LEVEL';

describe('LogStreamConfig', () => {
  describe('logFilePath', () => {
    it('should return the value of VSCODE_LOGS environment variable', () => {
      process.env[VSCODE_LOGS] = fakePath;
      expect(LogStreamConfig.logFilePath()).toBe(fakePath);
    });

    it('should return an empty string if VSCODE_LOGS environment variable is not set', () => {
      delete process.env[VSCODE_LOGS];
      expect(LogStreamConfig.logFilePath()).toBe('');
    });
  });

  describe('isEnabled', () => {
    it('should return false if VSCODE_LOGS is not set', () => {
      delete process.env[VSCODE_LOGS];
      expect(LogStreamConfig.isEnabledFor('dummyExtension')).toBe(false);
    });

    it('should return false if VSCODE_LOG_LEVEL is not set to trace', () => {
      process.env[VSCODE_LOGS] = fakePath;
      process.env[VSCODE_LOG_LEVEL] = 'info';
      expect(LogStreamConfig.isEnabledFor('dummyExtension')).toBe(false);
    });

    it('should return true if VSCODE_LOGS is provided and VSCODE_LOG_LEVEL is set to trace', () => {
      process.env[VSCODE_LOGS] = fakePath;
      process.env[VSCODE_LOG_LEVEL] = 'trace';
      expect(LogStreamConfig.isEnabledFor('dummyExtension')).toBe(true);
    });
  });
});
