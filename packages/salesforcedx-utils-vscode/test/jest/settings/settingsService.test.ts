/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { SETTING_CLEAR_OUTPUT_TAB, SFDX_CORE_CONFIGURATION_NAME } from '../../../src';
import { AdvancedSettings, SettingsService } from '../../../src/settings/settingsService';

const mockedVSCode = jest.mocked(vscode);

describe('SettingsService', () => {
  let getConfigurationMock: jest.SpyInstance;
  const mockConfiguration = {
    get: jest.fn().mockReturnValue('true')
  };

  beforeEach(() => {
    getConfigurationMock = jest
      .spyOn(mockedVSCode.workspace, 'getConfiguration')
      .mockReturnValue(mockConfiguration as any);
  });

  describe('getEnableClearOutputBeforeEachCommand', () => {
    it('should return the value of SETTING_CLEAR_OUTPUT_TAB from SFDX_CORE_CONFIGURATION_NAME configuration', () => {
      mockConfiguration.get.mockReturnValue(true);

      const result = SettingsService.getEnableClearOutputBeforeEachCommand();

      expect(result).toBe(true);
      expect(getConfigurationMock).toHaveBeenCalledWith(SFDX_CORE_CONFIGURATION_NAME);
      expect(mockConfiguration.get).toHaveBeenCalledWith(SETTING_CLEAR_OUTPUT_TAB, false);
    });
  });

  describe('isAdvancedSettingEnabledFor', () => {
    const fakeExtensionName = 'myExtension';
    it('should return true if the advanced setting is enabled for the given extension', () => {
      mockConfiguration.get.mockReturnValue('true');

      const result = SettingsService.isAdvancedSettingEnabledFor(
        fakeExtensionName,
        AdvancedSettings.LOCAL_TELEMETRY_LOGGING
      );

      expect(getConfigurationMock).toHaveBeenCalled();
      expect(mockConfiguration.get).toHaveBeenCalledWith('myExtension.advanced.localTelemetryLogging');
      expect(result).toBe(true);
    });

    it('should return false if the advanced setting is disabled for the given extension', () => {
      mockConfiguration.get.mockReturnValue('false');

      const result = SettingsService.isAdvancedSettingEnabledFor(
        fakeExtensionName,
        AdvancedSettings.LOCAL_TELEMETRY_LOGGING
      );

      expect(getConfigurationMock).toHaveBeenCalledWith();
      expect(mockConfiguration.get).toHaveBeenCalledWith('myExtension.advanced.localTelemetryLogging');
      expect(result).toBe(false);
    });
  });
});
