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
import { OrgLogoutDefault } from '../../../../src/commands/auth/orgLogout';
import { setAllServicesLayer } from '../../../../src/extensionProvider';

jest.mock('../../../../src/telemetry', () => ({
  telemetryService: { sendException: jest.fn() }
}));

jest.mock('../../../../src/channels', () => ({
  OUTPUT_CHANNEL: {}
}));

// selectOrgsForLogout imports orgList.ts which has a pre-existing toSorted ts-jest issue
jest.mock('../../../../src/parameterGatherers/selectOrgsForLogout');

describe('OrgLogoutDefault', () => {
  let removeAuthMock: jest.Mock;
  let isCurrentTargetOrgMock: jest.Mock;
  let unsetTargetOrgMock: jest.Mock;
  let unsetAliasesMock: jest.Mock;
  let getAliasesFromUsernameMock: jest.Mock;

  const buildLayer = () => {
    const mockServicesApi = {
      services: {
        ConfigService: {
          isCurrentTargetOrg: isCurrentTargetOrgMock,
          unsetTargetOrg: unsetTargetOrgMock
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
    removeAuthMock = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(AuthRemover, 'create').mockResolvedValue({
      removeAuth: removeAuthMock
    } as unknown as AuthRemover);

    isCurrentTargetOrgMock = jest.fn().mockReturnValue(Effect.succeed(false));
    unsetTargetOrgMock = jest.fn().mockReturnValue(Effect.void);
    unsetAliasesMock = jest.fn().mockReturnValue(Effect.void);
    getAliasesFromUsernameMock = jest.fn().mockReturnValue(Effect.succeed([]));

    setAllServicesLayer(buildLayer() as ReturnType<typeof import('../../../../src/extensionProvider').buildAllServicesLayer>);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('unsets target-org when target-org matches an alias from TargetOrgRef', async () => {
    const username = 'user@example.com';
    const aliases = ['myAlias', 'otherAlias'];
    isCurrentTargetOrgMock.mockReturnValue(Effect.succeed(true));
    getAliasesFromUsernameMock.mockReturnValue(Effect.succeed(aliases));

    const executor = new OrgLogoutDefault(aliases);
    const result = await executor.run({ type: 'CONTINUE', data: username });

    expect(result).toBe(true);
    expect(removeAuthMock).toHaveBeenCalledWith(username);
    expect(isCurrentTargetOrgMock).toHaveBeenCalledWith(username, aliases);
    expect(unsetAliasesMock).toHaveBeenCalledWith(aliases);
    expect(unsetTargetOrgMock).toHaveBeenCalled();
  });

  it('removes all aliases from disk including those added after org was set as default', async () => {
    const username = 'user@example.com';
    const aliasesAtSetTime = ['originalAlias'];
    const allAliasesOnDisk = ['originalAlias', 'extraAlias'];
    isCurrentTargetOrgMock.mockReturnValue(Effect.succeed(true));
    getAliasesFromUsernameMock.mockReturnValue(Effect.succeed(allAliasesOnDisk));

    const executor = new OrgLogoutDefault(aliasesAtSetTime);
    const result = await executor.run({ type: 'CONTINUE', data: username });

    expect(result).toBe(true);
    expect(unsetAliasesMock).toHaveBeenCalledWith(allAliasesOnDisk);
    expect(unsetTargetOrgMock).toHaveBeenCalled();
  });

  it('unsets target-org when target-org is set directly to the username', async () => {
    const username = 'user@example.com';
    isCurrentTargetOrgMock.mockReturnValue(Effect.succeed(true));
    getAliasesFromUsernameMock.mockReturnValue(Effect.succeed([]));

    const executor = new OrgLogoutDefault([]);
    const result = await executor.run({ type: 'CONTINUE', data: username });

    expect(result).toBe(true);
    expect(removeAuthMock).toHaveBeenCalledWith(username);
    expect(unsetTargetOrgMock).toHaveBeenCalled();
  });

  it('does not unset target-org when the logged-out org aliases do not match', async () => {
    const username = 'other@example.com';
    const aliases = ['differentAlias'];
    isCurrentTargetOrgMock.mockReturnValue(Effect.succeed(false));
    getAliasesFromUsernameMock.mockReturnValue(Effect.succeed(aliases));

    const executor = new OrgLogoutDefault(aliases);
    const result = await executor.run({ type: 'CONTINUE', data: username });

    expect(result).toBe(true);
    expect(removeAuthMock).toHaveBeenCalledWith(username);
    expect(unsetAliasesMock).toHaveBeenCalledWith(aliases);
    expect(unsetTargetOrgMock).not.toHaveBeenCalled();
  });

  it('does not unset target-org when auth removal fails', async () => {
    const username = 'user@example.com';
    const aliases = ['myAlias'];
    isCurrentTargetOrgMock.mockReturnValue(Effect.succeed(true));
    removeAuthMock.mockRejectedValue(new Error('removal failed'));

    const executor = new OrgLogoutDefault(aliases);
    const result = await executor.run({ type: 'CONTINUE', data: username });

    expect(result).toBe(false);
    expect(unsetTargetOrgMock).not.toHaveBeenCalled();
  });

  it('does not unset target-org when no target org is configured', async () => {
    const username = 'user@example.com';
    isCurrentTargetOrgMock.mockReturnValue(Effect.succeed(false));
    getAliasesFromUsernameMock.mockReturnValue(Effect.succeed([]));

    const executor = new OrgLogoutDefault([]);
    const result = await executor.run({ type: 'CONTINUE', data: username });

    expect(result).toBe(true);
    expect(removeAuthMock).toHaveBeenCalledWith(username);
    expect(unsetTargetOrgMock).not.toHaveBeenCalled();
  });
});
