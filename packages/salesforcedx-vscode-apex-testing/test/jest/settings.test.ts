/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import {
  retrieveOutputFormat,
  retrievePerformanceThreshold,
  retrieveTestCodeCoverage,
  retrieveTestRunConcise,
  retrieveTestSortOrder,
  retrieveCoverageThreshold
} from '../../src/settings';

const APEX_TESTING_CONFIGURATION_NAME = 'salesforcedx-vscode-apex-testing';

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
    expect(getConfigurationMock).toHaveBeenCalledWith(APEX_TESTING_CONFIGURATION_NAME);
    expect(getFn).toHaveBeenCalledWith('retrieve-test-code-coverage', false);
  });

  it('Should be able to get retrieveTestRunConcise setting.', () => {
    getConfigurationMock.mockReturnValue({
      get: getFn.mockReturnValue(false)
    } as any);

    const result = retrieveTestRunConcise();

    expect(result).toBe(false);
    expect(getConfigurationMock).toHaveBeenCalledWith(APEX_TESTING_CONFIGURATION_NAME);
    expect(getFn).toHaveBeenCalledWith('test-run-concise', false);
  });

  it('Should be able to get retrieveOutputFormat setting.', () => {
    getConfigurationMock.mockReturnValue({
      get: getFn.mockReturnValue('markdown')
    } as any);

    const result = retrieveOutputFormat();

    expect(result).toBe('markdown');
    expect(getConfigurationMock).toHaveBeenCalledWith(APEX_TESTING_CONFIGURATION_NAME);
    expect(getFn).toHaveBeenCalledWith('outputFormat', 'markdown');
  });

  it('Should be able to get retrieveTestSortOrder setting.', () => {
    getConfigurationMock.mockReturnValue({
      get: getFn.mockReturnValue('runtime')
    } as any);

    const result = retrieveTestSortOrder();

    expect(result).toBe('runtime');
    expect(getConfigurationMock).toHaveBeenCalledWith(APEX_TESTING_CONFIGURATION_NAME);
    expect(getFn).toHaveBeenCalledWith('testSortOrder', 'runtime');
  });

  it('Should be able to get retrievePerformanceThreshold setting.', () => {
    getConfigurationMock.mockReturnValue({
      get: getFn.mockReturnValue(5000)
    } as any);

    const result = retrievePerformanceThreshold();

    expect(result).toBe(5000);
    expect(getConfigurationMock).toHaveBeenCalledWith(APEX_TESTING_CONFIGURATION_NAME);
    expect(getFn).toHaveBeenCalledWith('testPerformanceThresholdMs', 5000);
  });

  it('Should be able to get retrieveCoverageThreshold setting.', () => {
    getConfigurationMock.mockReturnValue({
      get: getFn.mockReturnValue(75)
    } as any);

    const result = retrieveCoverageThreshold();

    expect(result).toBe(75);
    expect(getConfigurationMock).toHaveBeenCalledWith(APEX_TESTING_CONFIGURATION_NAME);
    expect(getFn).toHaveBeenCalledWith('testCoverageThresholdPercent', 75);
  });
});
