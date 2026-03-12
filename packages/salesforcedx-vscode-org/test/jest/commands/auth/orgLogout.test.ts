/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthRemover, Config, StateAggregator, OrgConfigProperties, type StateAggregator as StateAggregatorType } from '@salesforce/core';
import { ConfigUtil, ConfigAggregatorProvider, workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import { OrgLogoutDefault } from '../../../../src/commands/auth/orgLogout';

jest.mock('../../../../src/telemetry', () => ({
  telemetryService: { sendException: jest.fn() }
}));

jest.mock('../../../../src/channels', () => ({
  OUTPUT_CHANNEL: {}
}));

describe('OrgLogoutDefault', () => {
  let removeAuthMock: jest.Mock;
  let getTargetOrgOrAliasSpy: jest.SpyInstance;
  let configCreateSpy: jest.SpyInstance;
  let unsetMock: jest.Mock;
  let writeMock: jest.Mock;
  let reloadConfigAggregatorsMock: jest.Mock;
  let clearInstanceSpy: jest.SpyInstance;

  beforeEach(() => {
    removeAuthMock = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(AuthRemover, 'create').mockResolvedValue({
      removeAuth: removeAuthMock
    } as unknown as AuthRemover);

    getTargetOrgOrAliasSpy = jest.spyOn(ConfigUtil, 'getTargetOrgOrAlias');

    unsetMock = jest.fn();
    writeMock = jest.fn();
    configCreateSpy = jest.spyOn(Config, 'create').mockResolvedValue({
      unset: unsetMock,
      write: writeMock
    } as unknown as Config);

    reloadConfigAggregatorsMock = jest.fn();
    jest.spyOn(ConfigAggregatorProvider, 'getInstance').mockReturnValue({
      reloadConfigAggregators: reloadConfigAggregatorsMock
    } as unknown as ConfigAggregatorProvider);

    clearInstanceSpy = jest.spyOn(StateAggregator, 'clearInstance').mockReturnValue(undefined);
    jest.spyOn(StateAggregator, 'getInstance').mockResolvedValue({
      aliases: { getAll: jest.fn().mockReturnValue([]), unsetAndSave: jest.fn().mockResolvedValue(undefined) }
    } as unknown as StateAggregatorType);

    jest.spyOn(workspaceUtils, 'getRootWorkspacePath').mockReturnValue('/fake/workspace');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('unsets target-org when target-org matches an alias from TargetOrgRef', async () => {
    const username = 'user@example.com';
    const aliases = ['myAlias', 'otherAlias'];
    getTargetOrgOrAliasSpy.mockResolvedValue('myAlias');

    const executor = new OrgLogoutDefault(aliases);
    const result = await executor.run({ type: 'CONTINUE', data: username });

    expect(result).toBe(true);
    expect(removeAuthMock).toHaveBeenCalledWith(username);
    expect(unsetMock).toHaveBeenCalledWith(OrgConfigProperties.TARGET_ORG);
    expect(writeMock).toHaveBeenCalled();
    expect(reloadConfigAggregatorsMock).toHaveBeenCalled();
    expect(clearInstanceSpy).toHaveBeenCalled();
  });

  it('unsets target-org when target-org is set directly to the username', async () => {
    const username = 'user@example.com';
    getTargetOrgOrAliasSpy.mockResolvedValue(username);

    const executor = new OrgLogoutDefault([]);
    const result = await executor.run({ type: 'CONTINUE', data: username });

    expect(result).toBe(true);
    expect(removeAuthMock).toHaveBeenCalledWith(username);
    expect(unsetMock).toHaveBeenCalledWith(OrgConfigProperties.TARGET_ORG);
    expect(writeMock).toHaveBeenCalled();
  });

  it('does not unset target-org when the logged-out org aliases do not match', async () => {
    const username = 'other@example.com';
    const aliases = ['differentAlias'];
    getTargetOrgOrAliasSpy.mockResolvedValue('myAlias');

    const executor = new OrgLogoutDefault(aliases);
    const result = await executor.run({ type: 'CONTINUE', data: username });

    expect(result).toBe(true);
    expect(removeAuthMock).toHaveBeenCalledWith(username);
    expect(unsetMock).not.toHaveBeenCalled();
    expect(writeMock).not.toHaveBeenCalled();
  });

  it('does not unset target-org when auth removal fails', async () => {
    const username = 'user@example.com';
    const aliases = ['myAlias'];
    getTargetOrgOrAliasSpy.mockResolvedValue('myAlias');
    removeAuthMock.mockRejectedValue(new Error('removal failed'));

    const executor = new OrgLogoutDefault(aliases);
    const result = await executor.run({ type: 'CONTINUE', data: username });

    expect(result).toBe(false);
    expect(unsetMock).not.toHaveBeenCalled();
    expect(writeMock).not.toHaveBeenCalled();
  });

  it('does not unset target-org when no target org is configured', async () => {
    const username = 'user@example.com';
    getTargetOrgOrAliasSpy.mockResolvedValue(undefined);

    const executor = new OrgLogoutDefault([]);
    const result = await executor.run({ type: 'CONTINUE', data: username });

    expect(result).toBe(true);
    expect(removeAuthMock).toHaveBeenCalledWith(username);
    expect(configCreateSpy).not.toHaveBeenCalled();
    expect(unsetMock).not.toHaveBeenCalled();
  });
});
