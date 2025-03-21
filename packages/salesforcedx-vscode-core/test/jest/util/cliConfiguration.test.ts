/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { GlobalCliEnvironment } from '@salesforce/salesforcedx-utils-vscode';
import { ENV_SF_DISABLE_TELEMETRY } from '../../../src/constants';
import { disableCLITelemetry, isCLIInstalled, isCLITelemetryAllowed } from '../../../src/util';

// Mock child_process
jest.mock('node:child_process', () => {
  return {
    execSync: jest.fn()
  };
});

jest.mock('@salesforce/salesforcedx-utils-vscode');

// Import the mocked modules
import { execSync } from 'node:child_process';
import { ConfigUtil } from '@salesforce/salesforcedx-utils-vscode';

describe('SFDX CLI Configuration utility', () => {
  describe('isCLIInstalled', () => {
    let consoleErrorSpy: jest.SpyInstance;
    beforeEach(() => {
      jest.clearAllMocks();
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('Should return true if sfdx command works', () => {
      (execSync as jest.Mock).mockReturnValue(Buffer.from('sfdx-cli/7.142.1 darwin-x64 node-v16.16.0'));

      const response = isCLIInstalled();

      expect(execSync).toHaveBeenCalledWith('sfdx --version');
      expect(response).toEqual(true);
    });

    it('Should return false if sfdx throws', () => {
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('Command not found: sfdx');
      });
      const response = isCLIInstalled();
      expect(execSync).toHaveBeenCalledWith('sfdx --version');
      expect(consoleErrorSpy).toHaveBeenCalled();

      expect(response).toEqual(false);
    });
  });

  describe('CLI Telemetry', () => {
    beforeEach(() => {});

    it('Should return false if telemetry setting is disabled', async () => {
      ConfigUtil.isTelemetryDisabled = jest.fn().mockResolvedValue(true);

      const response = await isCLITelemetryAllowed();
      expect(response).toEqual(false);
    });

    it('Should return true if telemetry setting is undefined', async () => {
      ConfigUtil.isTelemetryDisabled = jest.fn().mockResolvedValue(undefined);

      const response = await isCLITelemetryAllowed();
      expect(response).toEqual(true);
    });

    it('Should return true if telemetry setting is enabled', async () => {
      ConfigUtil.isTelemetryDisabled = jest.fn().mockResolvedValue(false);

      const response = await isCLITelemetryAllowed();
      expect(response).toEqual(true);
    });

    it('Should set an environment variable', async () => {
      const cliEnvSpy = jest.spyOn(GlobalCliEnvironment.environmentVariables, 'set');
      disableCLITelemetry();
      expect(cliEnvSpy).toHaveBeenCalledWith(ENV_SF_DISABLE_TELEMETRY, 'true');
    });
  });
});
