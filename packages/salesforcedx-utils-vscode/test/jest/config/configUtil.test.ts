/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Config, Org, StateAggregator } from '@salesforce/core-bundle';
import { ConfigUtil, TARGET_ORG_KEY, workspaceUtils } from '../../../src';
import { ConfigAggregatorProvider } from './../../../src/providers/configAggregatorProvider';

describe('testing setTargetOrgOrAlias and private method setUsernameOrAlias', () => {
  const fakeOriginalDirectory = 'test/directory';
  const fakeWorkspace = 'test/workspace/';

  let workspacePathStub: jest.SpyInstance;
  let originalDirectoryStub: jest.SpyInstance;
  let configStub: jest.SpyInstance;
  let orgStub: jest.SpyInstance;
  let chdirStub: jest.SpyInstance;
  let setMock: jest.SpyInstance;
  let writeMock: jest.SpyInstance;
  let mockConfigAggregatorProvider: jest.SpyInstance;
  const mockConfigAggregatorProviderInstance = {
    reloadConfigAggregators: jest.fn()
  };
  let stateAggregatorClearInstanceMock: jest.SpyInstance;

  beforeEach(() => {
    workspacePathStub = jest.spyOn(workspaceUtils, 'getRootWorkspacePath').mockReturnValue(fakeWorkspace);
    originalDirectoryStub = jest.spyOn(process, 'cwd').mockReturnValue(fakeOriginalDirectory);
    setMock = jest.fn();
    writeMock = jest.fn();
    configStub = jest.spyOn(Config, 'create');
    configStub.mockResolvedValue({ set: setMock, write: writeMock });
    orgStub = jest.spyOn(Org, 'create').mockResolvedValue(undefined as any);
    chdirStub = jest.spyOn(process, 'chdir').mockReturnValue();
    mockConfigAggregatorProvider = jest
      .spyOn(ConfigAggregatorProvider, 'getInstance')
      .mockReturnValue(mockConfigAggregatorProviderInstance as any);
    stateAggregatorClearInstanceMock = jest.spyOn(StateAggregator, 'clearInstance');
  });

  it('should set provided username or alias as default configs', async () => {
    const username = 'vscodeOrgs';
    await ConfigUtil.setTargetOrgOrAlias(username);
    expect(orgStub).toHaveBeenCalled();
    expect(setMock).toHaveBeenCalledWith(TARGET_ORG_KEY, username);
    expect(writeMock).toHaveBeenCalled();
  });

  it('should change the current working directory to the original working directory', async () => {
    const username = 'vscodeO';
    await ConfigUtil.setTargetOrgOrAlias(username);
    expect(workspacePathStub).toHaveBeenCalledTimes(2);
    expect(chdirStub).toHaveBeenCalledTimes(2);
    expect(chdirStub).toHaveBeenNthCalledWith(1, fakeWorkspace);
    expect(chdirStub).toHaveBeenNthCalledWith(2, fakeOriginalDirectory);
  });

  it('should be able to set username or alias to an empty string', async () => {
    const username = '';
    await ConfigUtil.setTargetOrgOrAlias(username);
    expect(orgStub).not.toHaveBeenCalled();
    expect(setMock).toHaveBeenCalledWith(TARGET_ORG_KEY, username);
    expect(writeMock).toHaveBeenCalled();
    expect(mockConfigAggregatorProvider).toHaveBeenCalled();
    expect(mockConfigAggregatorProviderInstance.reloadConfigAggregators).toHaveBeenCalled();
    expect(stateAggregatorClearInstanceMock).toHaveBeenCalled();

    const writeCallOrder = writeMock.mock.invocationCallOrder[0];
    const reloadCallOrder = mockConfigAggregatorProviderInstance.reloadConfigAggregators.mock.invocationCallOrder[0];
    const clearInstanceCallOrder = stateAggregatorClearInstanceMock.mock.invocationCallOrder[0];

    expect(writeCallOrder).toBeLessThan(reloadCallOrder);
    expect(reloadCallOrder).toBeLessThan(clearInstanceCallOrder);
  });
});

describe('testing unsetTargetOrg', () => {
  const fakeOriginalDirectory = 'test/directory';
  const fakeWorkspace = 'test/workspace/';

  let workspacePathStub: jest.SpyInstance;
  let originalDirectoryStub: jest.SpyInstance;
  let configStub: jest.SpyInstance;
  let chdirStub: jest.SpyInstance;
  let unsetMock: jest.SpyInstance;
  let writeMock: jest.SpyInstance;
  let mockConfigAggregatorProvider: jest.SpyInstance;
  const mockConfigAggregatorProviderInstance = {
    reloadConfigAggregators: jest.fn()
  };
  let stateAggregatorClearInstanceMock: jest.SpyInstance;

  beforeEach(() => {
    workspacePathStub = jest.spyOn(workspaceUtils, 'getRootWorkspacePath').mockReturnValue(fakeWorkspace);
    originalDirectoryStub = jest.spyOn(process, 'cwd').mockReturnValue(fakeOriginalDirectory);
    unsetMock = jest.fn();
    writeMock = jest.fn();
    configStub = jest.spyOn(Config, 'create');
    configStub.mockResolvedValue({ unset: unsetMock, write: writeMock });
    chdirStub = jest.spyOn(process, 'chdir').mockReturnValue();
    mockConfigAggregatorProvider = jest
      .spyOn(ConfigAggregatorProvider, 'getInstance')
      .mockReturnValue(mockConfigAggregatorProviderInstance as any);
    stateAggregatorClearInstanceMock = jest.spyOn(StateAggregator, 'clearInstance');
  });

  it('should unset provided username or alias', async () => {
    await ConfigUtil.unsetTargetOrg();
    expect(unsetMock).toHaveBeenCalledWith(TARGET_ORG_KEY);
    expect(writeMock).toHaveBeenCalled();
    expect(mockConfigAggregatorProvider).toHaveBeenCalled();
    expect(mockConfigAggregatorProviderInstance.reloadConfigAggregators).toHaveBeenCalled();
    expect(stateAggregatorClearInstanceMock).toHaveBeenCalled();
  });

  it('should change the current working directory to the original working directory', async () => {
    await ConfigUtil.unsetTargetOrg();
    expect(workspacePathStub).toHaveBeenCalledTimes(2);
    expect(chdirStub).toHaveBeenCalledTimes(2);
    expect(chdirStub).toHaveBeenNthCalledWith(1, fakeWorkspace);
    expect(chdirStub).toHaveBeenNthCalledWith(2, fakeOriginalDirectory);
  });
});
