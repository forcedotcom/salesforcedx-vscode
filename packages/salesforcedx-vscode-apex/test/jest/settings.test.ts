/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Mock as VitestMock, MockInstance as VitestMockInstance } from 'vitest';
import * as vscode from 'vscode';
import { retrieveAAMethodAnnotations, retrieveEnableSyncInitJobs } from '../../src/settings';

describe('settings Unit Tests.', () => {
  const vscodeMocked = vi.mocked(vscode);
  let getConfigurationMock: VitestMockInstance;
  let getFn: VitestMock;

  beforeEach(() => {
    getConfigurationMock = vi.spyOn(vscodeMocked.workspace, 'getConfiguration');
    getFn = vi.fn();
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
      get: getFn.mockReturnValue(['AuraEnabled', 'UserDefinedModifier', 'UserDefinedModifier'])
    } as any);

    const result = retrieveAAMethodAnnotations();
    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining(['AuraEnabled', 'UserDefinedModifier']));
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
