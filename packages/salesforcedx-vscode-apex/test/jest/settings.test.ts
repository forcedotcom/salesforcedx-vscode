/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SFDX_CORE_CONFIGURATION_NAME } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { retrieveAAMethodAnnotations, retrieveEnableSyncInitJobs, retrieveTestCodeCoverage } from '../../src/settings';

describe('settings Unit Tests.', () => {
  const vscodeMocked = jest.mocked(vscode);
  let getConfigurationMock: jest.SpyInstance;
  let getFn: jest.Mock;

  beforeEach(() => {
    getConfigurationMock = jest.spyOn(vscodeMocked.workspace, 'getConfiguration');
    getFn = jest.fn();
  });

  it('Should be able to get retrieveTestCodeCoverage setting.', () => {
    getConfigurationMock.mockReturnValue({
      get: getFn.mockReturnValue(false)
    } as any);

    const result = retrieveTestCodeCoverage();

    expect(result).toBe(false);
    expect(getConfigurationMock).toHaveBeenCalledWith(SFDX_CORE_CONFIGURATION_NAME);
    expect(getFn).toHaveBeenCalledWith('retrieve-test-code-coverage', false);
  });

  it('Should be able to get retrieveEnableSyncInitJobs setting.', () => {
    getConfigurationMock.mockReturnValue({
      get: getFn.mockReturnValue(true)
    } as any);

    const result = retrieveEnableSyncInitJobs();
    expect(result).toBe(true);
    expect(getConfigurationMock).toHaveBeenCalledWith();
    expect(getFn).toHaveBeenCalledWith('salesforcedx-vscode-apex.wait-init-jobs', true);
  });

  it('Should be able to get retrieveAAMethodAnnotations setting.', () => {
    getConfigurationMock.mockReturnValue({
      get: getFn.mockReturnValue(['UserDefinedModifier'])
    } as any);

    const result = retrieveAAMethodAnnotations();
    expect(result).toEqual(['AuraEnabled', 'UserDefinedModifier']);
    expect(getConfigurationMock).toHaveBeenCalledWith();
    expect(getFn).toHaveBeenCalledWith('salesforcedx-vscode-apex.apexoas.aa.method.annotations', []);
  });

  it('Should be able to get lspParityCapabilities setting.', () => {
    getConfigurationMock.mockReturnValue({
      get: getFn.mockReturnValue(true)
    } as any);

    const result = vscode.workspace
      .getConfiguration()
      .get<boolean>('salesforcedx-vscode-apex.advanced.lspParityCapabilities', true);
    expect(result).toBe(true);
    expect(getConfigurationMock).toHaveBeenCalledWith();
    expect(getFn).toHaveBeenCalledWith('salesforcedx-vscode-apex.advanced.lspParityCapabilities', true);
  });
});
