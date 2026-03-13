/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthRemover } from '@salesforce/core';
import {
  ExtensionProviderService,
  type ExtensionProviderService as ExtensionProviderServiceType
} from '@salesforce/effect-ext-utils';
import type { SalesforceVSCodeServicesApi } from '@salesforce/vscode-services';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { OrgLogoutSelected } from '../../../../src/commands/auth/orgLogout';
import { setAllServicesLayer } from '../../../../src/extensionProvider';
import * as orgUtil from '../../../../src/util/orgUtil';

jest.mock('../../../../src/telemetry', () => ({
  telemetryService: { sendException: jest.fn() }
}));

jest.mock('../../../../src/channels', () => ({
  OUTPUT_CHANNEL: {}
}));

// selectOrgsForLogout imports orgList.ts which has a pre-existing toSorted ts-jest issue
jest.mock('../../../../src/parameterGatherers/selectOrgsForLogout');

describe('OrgLogoutSelected', () => {
  let removeAuthMock: jest.Mock;
  let isCurrentTargetOrgMock: jest.Mock;
  let isCurrentTargetDevHubMock: jest.Mock;
  let unsetTargetOrgMock: jest.Mock;
  let unsetTargetDevHubMock: jest.Mock;
  let unsetAliasesMock: jest.Mock;
  let getAliasesFromUsernameMock: jest.Mock;

  const buildLayer = () => {
    const mockServicesApi = {
      services: {
        ConfigService: {
          isCurrentTargetOrg: isCurrentTargetOrgMock,
          isCurrentTargetDevHub: isCurrentTargetDevHubMock,
          unsetTargetOrg: unsetTargetOrgMock,
          unsetTargetDevHub: unsetTargetDevHubMock
        },
        AliasService: {
          unsetAliases: unsetAliasesMock,
          getAliasesFromUsername: getAliasesFromUsernameMock
        }
      }
    } as unknown as SalesforceVSCodeServicesApi;
    return Layer.succeed(ExtensionProviderService, {
      getServicesApi: Effect.succeed(mockServicesApi) as ExtensionProviderServiceType['getServicesApi']
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();

    removeAuthMock = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(AuthRemover, 'create').mockResolvedValue({
      removeAuth: removeAuthMock
    } as unknown as AuthRemover);

    isCurrentTargetOrgMock = jest.fn().mockReturnValue(Effect.succeed(false));
    isCurrentTargetDevHubMock = jest.fn().mockReturnValue(Effect.succeed(false));
    unsetTargetOrgMock = jest.fn().mockReturnValue(Effect.void);
    unsetTargetDevHubMock = jest.fn().mockReturnValue(Effect.void);
    unsetAliasesMock = jest.fn().mockReturnValue(Effect.void);
    getAliasesFromUsernameMock = jest.fn().mockReturnValue(Effect.succeed([]));

    jest.spyOn(orgUtil, 'updateConfigAndStateAggregators').mockResolvedValue(undefined);

    setAllServicesLayer(buildLayer() as ReturnType<typeof import('../../../../src/extensionProvider').buildAllServicesLayer>);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs out each selected org and calls updateConfigAndStateAggregators', async () => {
    const usernames = ['user1@example.com', 'user2@example.com'];
    const executor = new OrgLogoutSelected();
    const result = await executor.run({ type: 'CONTINUE', data: { usernames } });

    expect(result).toBe(true);
    expect(removeAuthMock).toHaveBeenCalledTimes(2);
    expect(removeAuthMock).toHaveBeenCalledWith('user1@example.com');
    expect(removeAuthMock).toHaveBeenCalledWith('user2@example.com');
    expect(orgUtil.updateConfigAndStateAggregators).toHaveBeenCalled();
  });

  it('unsets target-org when a logged-out org is the current target', async () => {
    isCurrentTargetOrgMock.mockReturnValue(Effect.succeed(true));
    const executor = new OrgLogoutSelected();
    const result = await executor.run({ type: 'CONTINUE', data: { usernames: ['target@example.com'] } });

    expect(result).toBe(true);
    expect(unsetTargetOrgMock).toHaveBeenCalled();
  });

  it('does not unset target-org when no selected org is the target', async () => {
    isCurrentTargetOrgMock.mockReturnValue(Effect.succeed(false));
    const executor = new OrgLogoutSelected();
    const result = await executor.run({ type: 'CONTINUE', data: { usernames: ['other@example.com'] } });

    expect(result).toBe(true);
    expect(unsetTargetOrgMock).not.toHaveBeenCalled();
  });

  it('unsets target-dev-hub when a logged-out org is the current dev hub', async () => {
    isCurrentTargetDevHubMock.mockReturnValue(Effect.succeed(true));
    const executor = new OrgLogoutSelected();
    const result = await executor.run({ type: 'CONTINUE', data: { usernames: ['devhub@example.com'] } });

    expect(result).toBe(true);
    expect(unsetTargetDevHubMock).toHaveBeenCalled();
    expect(unsetTargetOrgMock).not.toHaveBeenCalled();
  });

  it('passes aliases to isCurrentTargetOrg and isCurrentTargetDevHub checks', async () => {
    getAliasesFromUsernameMock.mockReturnValue(Effect.succeed(['myAlias']));
    const executor = new OrgLogoutSelected();
    await executor.run({ type: 'CONTINUE', data: { usernames: ['user@example.com'] } });

    expect(isCurrentTargetOrgMock).toHaveBeenCalledWith('user@example.com', ['myAlias']);
    expect(isCurrentTargetDevHubMock).toHaveBeenCalledWith('user@example.com', ['myAlias']);
  });

  it('returns false and does not update state when auth removal fails', async () => {
    removeAuthMock.mockRejectedValue(new Error('removal failed'));
    const executor = new OrgLogoutSelected();
    const result = await executor.run({ type: 'CONTINUE', data: { usernames: ['user@example.com'] } });

    expect(result).toBe(false);
    expect(orgUtil.updateConfigAndStateAggregators).not.toHaveBeenCalled();
  });
});
